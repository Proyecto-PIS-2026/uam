import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Secret, TOTP } from "otpauth";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { cifrarSecreto, generarSecreto } from "./segundo-factor-criptografia";
import { cancelarSegundoFactor, confirmarSegundoFactor, iniciarSegundoFactor, obtenerSegundoFactorPendiente } from "./segundo-factor";

describe("segundo factor obligatorio de administradores", () => {
    let usuarioId: number;

    beforeEach(async () => {
        vi.stubEnv("TWO_FACTOR_ENCRYPTION_KEY", "ab".repeat(32));
        const nombre = `test-2fa-${randomUUID()}`;
        const usuario = await db.orm.public.Usuario.create({ username: nombre, passwordHash: "hash-no-utilizado", rol: "ADMINISTRADOR" });
        usuarioId = usuario.id;
        await db.orm.public.Administrador.create({ usuarioId, email: `${nombre}@example.com` });
    });

    afterEach(async () => {
        if (usuarioId) await db.orm.public.Usuario.where({ id: usuarioId }).delete();
        vi.unstubAllEnvs();
    });

    async function iniciar() {
        const resultado = await iniciarSegundoFactor(usuarioId);
        if (!("token" in resultado)) throw new Error(resultado.error);
        return resultado.token;
    }

    function codigo(secreto: string, segundos = Math.floor(Date.now() / 1000)) {
        return new TOTP({ secret: Secret.fromBase32(secreto), algorithm: "SHA1", digits: 6, period: 30 }).generate({ timestamp: segundos * 1000 });
    }

    async function codigoIncorrecto(token: string) {
        const pendiente = await obtenerSegundoFactorPendiente(token);
        const secreto = pendiente?.secreto;
        if (!secreto) throw new Error("No hay secreto pendiente.");
        const validos = [codigo(secreto), codigo(secreto, Math.floor(Date.now() / 1000) - 30)];
        return ["000000", "111111", "222222"].find((valor) => !validos.includes(valor))!;
    }

    it("no vincula hasta confirmar un código y consume la verificación una sola vez", async () => {
        const token = await iniciar();
        const pendiente = await obtenerSegundoFactorPendiente(token);
        expect(pendiente?.vinculacion).toBe(true);
        const usuario = await db.orm.public.Usuario.where({ id: usuarioId }).first();
        expect(usuario?.twoFactorEnabled).toBe(false);
        expect(usuario?.twoFactorSecret).toBeNull();
        expect(usuario?.twoFactorPendingSecret).not.toContain(pendiente!.secreto!);
        expect(usuario?.twoFactorChallengeHash).not.toBe(token);
        const resultados = await Promise.all([
            confirmarSegundoFactor(token, codigo(pendiente!.secreto!)),
            confirmarSegundoFactor(token, codigo(pendiente!.secreto!)),
        ]);
        expect(resultados.filter((resultado) => resultado && "usuarioId" in resultado)).toHaveLength(1);
        expect(resultados.filter((resultado) => resultado === null)).toHaveLength(1);
        const confirmado = await db.orm.public.Usuario.where({ id: usuarioId }).first();
        expect(confirmado?.twoFactorEnabled).toBe(true);
        expect(confirmado?.twoFactorSecret).toBe(usuario?.twoFactorPendingSecret);
        expect(confirmado?.twoFactorPendingSecret).toBeNull();
        expect(await obtenerSegundoFactorPendiente(token)).toBeNull();
    });

    it("no expone la clave vinculada durante los siguientes ingresos y rechaza la reutilización", async () => {
        const secreto = generarSecreto();
        const paso = Math.floor(Date.now() / 30_000);
        await db.orm.public.Usuario.where({ id: usuarioId }).update({ twoFactorEnabled: true, twoFactorSecret: cifrarSecreto(secreto, usuarioId), twoFactorLastStep: paso });
        const token = await iniciar();
        expect(await obtenerSegundoFactorPendiente(token)).toMatchObject({ vinculacion: false, secreto: null });
        expect(await confirmarSegundoFactor(token, codigo(secreto))).toHaveProperty("error");
        // Permite un código nuevo sin reemplazar el secreto vinculado.
        await db.orm.public.Usuario.where({ id: usuarioId }).update({ twoFactorLastStep: paso - 1 });
        expect(await confirmarSegundoFactor(token, codigo(secreto))).toMatchObject({ usuarioId, versionSegundoFactor: expect.any(String) });
    });

    it("cancela la vinculación y obliga a utilizar una clave nueva al reiniciar", async () => {
        const token = await iniciar();
        const primero = await obtenerSegundoFactorPendiente(token);
        await cancelarSegundoFactor(token);
        expect(await confirmarSegundoFactor(token, codigo(primero!.secreto!))).toBeNull();
        const usuario = await db.orm.public.Usuario.where({ id: usuarioId }).first();
        expect(usuario?.twoFactorEnabled).toBe(false);
        expect(usuario?.twoFactorPendingSecret).toBeNull();
        expect((await obtenerSegundoFactorPendiente(await iniciar()))?.secreto).not.toBe(primero?.secreto);
    });

    it("cancelar una verificación conserva la vinculación confirmada", async () => {
        const secreto = cifrarSecreto(generarSecreto(), usuarioId);
        await db.orm.public.Usuario.where({ id: usuarioId }).update({ twoFactorEnabled: true, twoFactorSecret: secreto });
        const token = await iniciar();
        await cancelarSegundoFactor(token);
        const usuario = await db.orm.public.Usuario.where({ id: usuarioId }).first();
        expect(usuario?.twoFactorEnabled).toBe(true);
        expect(usuario?.twoFactorSecret).toBe(secreto);
        expect(await obtenerSegundoFactorPendiente(token)).toBeNull();
    });

    it("vence a los diez minutos, descarta la clave y conserva los intentos fallidos", async () => {
        const antes = Math.floor(Date.now() / 1000);
        const token = await iniciar();
        const pendiente = await obtenerSegundoFactorPendiente(token);
        expect(pendiente!.expiraEn).toBeGreaterThanOrEqual(antes + 600);
        await confirmarSegundoFactor(token, await codigoIncorrecto(token));
        await db.orm.public.Usuario.where({ id: usuarioId }).update({ twoFactorExpiresAt: antes - 1 });
        expect(await confirmarSegundoFactor(token, codigo(pendiente!.secreto!))).toBeNull();
        expect((await obtenerSegundoFactorPendiente(await iniciar()))?.intentosRestantes).toBe(4);
    });

    it("no consume intentos por formato inválido", async () => {
        const token = await iniciar();
        for (const valor of ["", "123", "abcdef", "1234567"]) {
            expect(await confirmarSegundoFactor(token, valor)).toEqual({ error: "Ingresá un código de seis dígitos." });
        }
        expect((await obtenerSegundoFactorPendiente(token))?.intentosRestantes).toBe(5);
    });

    it("un código vencido consume un intento y no confirma la vinculación", async () => {
        const token = await iniciar();
        const pendiente = await obtenerSegundoFactorPendiente(token);
        expect(await confirmarSegundoFactor(token, codigo(pendiente!.secreto!, Math.floor(Date.now() / 1000) - 300))).toHaveProperty("error");
        expect((await obtenerSegundoFactorPendiente(token))?.intentosRestantes).toBe(4);
        expect((await db.orm.public.Usuario.where({ id: usuarioId }).first())?.twoFactorEnabled).toBe(false);
    });

    it("mantiene los intentos al cancelar o reiniciar y bloquea la cuenta por cinco minutos", async () => {
        let token = await iniciar();
        for (let i = 0; i < 4; i++) {
            expect(await confirmarSegundoFactor(token, await codigoIncorrecto(token))).toHaveProperty("error");
            await cancelarSegundoFactor(token);
            token = await iniciar();
        }
        expect((await obtenerSegundoFactorPendiente(token))?.intentosRestantes).toBe(1);
        const antes = Math.floor(Date.now() / 1000);
        expect(await confirmarSegundoFactor(token, await codigoIncorrecto(token))).toEqual({ bloqueado: true });
        const bloqueado = await db.orm.public.Usuario.where({ id: usuarioId }).first();
        expect(bloqueado?.twoFactorLockedUntil).toBeGreaterThanOrEqual(antes + 300);
        expect(bloqueado?.twoFactorPendingSecret).toBeNull();
        expect(await iniciarSegundoFactor(usuarioId)).toHaveProperty("error");
        expect(await obtenerSegundoFactorPendiente(token)).toBeNull();
        expect((await db.orm.public.Usuario.where({ id: usuarioId }).first())?.twoFactorLockedUntil).toBe(bloqueado?.twoFactorLockedUntil);
        await db.orm.public.Usuario.where({ id: usuarioId }).update({ twoFactorLockedUntil: antes - 1 });
        expect((await obtenerSegundoFactorPendiente(await iniciar()))?.intentosRestantes).toBe(5);
    });

    it("cuenta los intentos concurrentes sin perder actualizaciones", async () => {
        const token = await iniciar();
        const incorrecto = await codigoIncorrecto(token);
        const resultados = await Promise.all(Array.from({ length: 8 }, () => confirmarSegundoFactor(token, incorrecto)));
        expect(resultados.filter((resultado) => resultado && "bloqueado" in resultado)).toHaveLength(1);
        expect((await db.orm.public.Usuario.where({ id: usuarioId }).first())?.twoFactorFailedAttempts).toBe(5);
    });

    it("rechaza tokens inventados o reemplazados por un nuevo inicio de sesión", async () => {
        const primero = await iniciar();
        await iniciar();
        expect(await obtenerSegundoFactorPendiente(primero)).toBeNull();
        expect(await obtenerSegundoFactorPendiente("a".repeat(43))).toBeNull();
        expect(await confirmarSegundoFactor("", "123456")).toBeNull();
    });

    it("no permite iniciar el segundo factor de otro rol", async () => {
        await db.orm.public.Usuario.where({ id: usuarioId }).update({ rol: "PRODUCTOR" });
        expect(await iniciarSegundoFactor(usuarioId)).toHaveProperty("error");
    });
});
