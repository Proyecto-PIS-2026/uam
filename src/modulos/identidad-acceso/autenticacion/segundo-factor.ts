import { createHash, randomBytes } from "node:crypto";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { cifrarSecreto, descifrarSecreto, generarSecreto, verificarCodigo } from "./segundo-factor-criptografia";

export const DURACION_SEGUNDO_FACTOR = 10 * 60;
const MAXIMO_INTENTOS = 5;
const DURACION_BLOQUEO = 5 * 60;
type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Usuario = NonNullable<Awaited<ReturnType<typeof db.orm.public.Usuario.first>>>;

const sinPendiente = { twoFactorChallengeHash: null, twoFactorPendingSecret: null, twoFactorExpiresAt: null };

function hashToken(token: string) {
    return createHash("sha256").update(token).digest("hex");
}

async function bloquearUsuario(tx: Transaccion, usuarioId: number) {
    await tx.execute(db.raw.sql`SELECT id FROM usuario WHERE id = ${usuarioId} FOR UPDATE`
        .returnsRow({ id: "pg/int4@1" }).build());
}

async function ahoraEnBase(tx: Transaccion): Promise<number> {
    const [fila] = await tx.query(db.raw.sql`SELECT EXTRACT(EPOCH FROM clock_timestamp())::float8 AS ahora`
        .returnsRow({ ahora: "pg/float8@1" }).build());
    if (!fila || !Number.isFinite(fila.ahora)) throw new Error("No se pudo verificar el vencimiento del segundo factor.");
    return Math.floor(fila.ahora);
}

function estaBloqueado(usuario: Usuario, ahora: number) {
    return usuario.twoFactorLockedUntil !== null && usuario.twoFactorLockedUntil > ahora;
}

export async function iniciarSegundoFactor(usuarioId: number): Promise<{ token: string } | { error: string }> {
    return db.transaction(async (tx) => {
        await bloquearUsuario(tx, usuarioId);
        const usuario = await tx.orm.public.Usuario.where({ id: usuarioId, rol: "ADMINISTRADOR" }).first();
        if (!usuario) return { error: "No se pudo iniciar la verificación en dos pasos." };
        const ahora = await ahoraEnBase(tx);
        if (estaBloqueado(usuario, ahora)) return { error: "Alcanzaste el límite de intentos. Esperá 5 minutos desde el bloqueo para volver a iniciar sesión." };
        if (usuario.twoFactorEnabled && !usuario.twoFactorSecret) throw new Error("La cuenta no tiene un segundo factor válido.");
        const token = randomBytes(32).toString("base64url");
        await tx.orm.public.Usuario.where({ id: usuarioId }).update({
            twoFactorChallengeHash: hashToken(token),
            twoFactorPendingSecret: usuario.twoFactorEnabled ? null : cifrarSecreto(generarSecreto(), usuarioId),
            twoFactorExpiresAt: ahora + DURACION_SEGUNDO_FACTOR,
            ...(usuario.twoFactorLockedUntil !== null ? { twoFactorFailedAttempts: 0, twoFactorLockedUntil: null } : {}),
        });
        return { token };
    });
}

async function conPendiente<T>(token: string, accion: (tx: Transaccion, usuario: Usuario, ahora: number) => Promise<T>): Promise<T | null> {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
    return db.transaction(async (tx) => {
        const encontrado = await tx.orm.public.Usuario.where({ twoFactorChallengeHash: hashToken(token) }).first();
        if (!encontrado) return null;
        await bloquearUsuario(tx, encontrado.id);
        const usuario = await tx.orm.public.Usuario.where({ id: encontrado.id, rol: "ADMINISTRADOR", twoFactorChallengeHash: hashToken(token) }).first();
        if (!usuario) return null;
        const ahora = await ahoraEnBase(tx);
        if (!usuario.twoFactorExpiresAt || usuario.twoFactorExpiresAt <= ahora || estaBloqueado(usuario, ahora)) {
            await tx.orm.public.Usuario.where({ id: usuario.id }).update(sinPendiente);
            return null;
        }
        return accion(tx, usuario, ahora);
    });
}

export async function obtenerSegundoFactorPendiente(token: string) {
    return conPendiente(token, async (tx, usuario) => {
        const administrador = await tx.orm.public.Administrador.where({ usuarioId: usuario.id }).first();
        if (!administrador) return null;
        return {
            vinculacion: !usuario.twoFactorEnabled,
            correo: administrador.email,
            secreto: !usuario.twoFactorEnabled && usuario.twoFactorPendingSecret ? descifrarSecreto(usuario.twoFactorPendingSecret, usuario.id) : null,
            expiraEn: usuario.twoFactorExpiresAt!,
            intentosRestantes: MAXIMO_INTENTOS - usuario.twoFactorFailedAttempts,
        };
    });
}

export async function confirmarSegundoFactor(token: string, codigo: string) {
    return conPendiente(token, async (tx, usuario, ahora) => {
        if (!/^[0-9]{6}$/.test(codigo)) return { error: "Ingresá un código de seis dígitos." };
        const secretoCifrado = usuario.twoFactorEnabled ? usuario.twoFactorSecret : usuario.twoFactorPendingSecret;
        if (!secretoCifrado) throw new Error("No se pudo verificar el segundo factor.");
        const paso = verificarCodigo(descifrarSecreto(secretoCifrado, usuario.id), codigo, ahora, usuario.twoFactorLastStep);
        if (paso === null) {
            const intentos = usuario.twoFactorFailedAttempts + 1;
            const bloqueado = intentos >= MAXIMO_INTENTOS;
            await tx.orm.public.Usuario.where({ id: usuario.id }).update({
                twoFactorFailedAttempts: intentos,
                ...(bloqueado ? { ...sinPendiente, twoFactorLockedUntil: ahora + DURACION_BLOQUEO } : {}),
            });
            return bloqueado
                ? { bloqueado: true as const }
                : { error: `El código es incorrecto, venció o ya fue utilizado. ${intentos === MAXIMO_INTENTOS - 1 ? "Te queda 1 intento." : `Te quedan ${MAXIMO_INTENTOS - intentos} intentos.`}` };
        }
        await tx.orm.public.Usuario.where({ id: usuario.id }).update({
            ...sinPendiente,
            twoFactorSecret: secretoCifrado,
            twoFactorEnabled: true,
            twoFactorLastStep: paso,
            twoFactorFailedAttempts: 0,
            twoFactorLockedUntil: null,
        });
        return { usuarioId: usuario.id };
    });
}

export async function cancelarSegundoFactor(token: string): Promise<void> {
    await conPendiente(token, async (tx, usuario) => {
        await tx.orm.public.Usuario.where({ id: usuario.id }).update(sinPendiente);
    });
}
