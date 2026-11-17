import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { Secret, TOTP } from "otpauth";

export function obtenerVersionSegundoFactor(secretoCifrado: string): string {
    return createHash("sha256").update(secretoCifrado).digest("hex");
}

function obtenerClaveCifrado() {
    const valor = process.env.TWO_FACTOR_ENCRYPTION_KEY;
    if (!valor || !/^[a-fA-F0-9]{64}$/.test(valor)) {
        throw new Error("TWO_FACTOR_ENCRYPTION_KEY debe contener 32 bytes en hexadecimal.");
    }
    return Buffer.from(valor, "hex");
}

export function cifrarSecreto(secreto: string, usuarioId: number): string {
    const iv = randomBytes(12);
    const cifrador = createCipheriv("aes-256-gcm", obtenerClaveCifrado(), iv);
    cifrador.setAAD(Buffer.from(`uam:2fa:${usuarioId}`));
    const contenido = Buffer.concat([cifrador.update(secreto, "utf8"), cifrador.final()]);
    return ["v1", iv.toString("base64url"), cifrador.getAuthTag().toString("base64url"), contenido.toString("base64url")].join(".");
}

export function descifrarSecreto(valor: string, usuarioId: number): string {
    const [version, iv, etiqueta, contenido, extra] = valor.split(".");
    if (version !== "v1" || !iv || !etiqueta || !contenido || extra !== undefined) {
        throw new Error("El secreto del segundo factor no es válido.");
    }
    const descifrador = createDecipheriv("aes-256-gcm", obtenerClaveCifrado(), Buffer.from(iv, "base64url"));
    descifrador.setAAD(Buffer.from(`uam:2fa:${usuarioId}`));
    descifrador.setAuthTag(Buffer.from(etiqueta, "base64url"));
    return Buffer.concat([descifrador.update(Buffer.from(contenido, "base64url")), descifrador.final()]).toString("utf8");
}

export function generarSecreto(): string {
    return new Secret({ size: 20 }).base32;
}

function crearTotp(secreto: string, correo = "") {
    return new TOTP({ issuer: "UAM", label: correo, algorithm: "SHA1", digits: 6, period: 30, secret: Secret.fromBase32(secreto) });
}

export function obtenerUriVinculacion(secreto: string, correo: string): string {
    return crearTotp(secreto, correo).toString();
}

export function verificarCodigo(secreto: string, codigo: string, ahora: number, ultimoPaso: number | null): number | null {
    if (!/^[0-9]{6}$/.test(codigo)) return null;
    // Se acepta el período actual y el anterior para tolerar el tiempo de ingreso.
    const pasoActual = Math.floor(ahora / 30);
    for (const paso of [pasoActual, pasoActual - 1]) {
        if (ultimoPaso !== null && paso <= ultimoPaso) continue;
        if (crearTotp(secreto).validate({ token: codigo, timestamp: paso * 30_000, window: 0 }) === 0) return paso;
    }
    return null;
}
