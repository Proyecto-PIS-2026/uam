// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspect } from "node:util";
import { detalleRespuestaFallida, registrarErrorWebservice } from "./registro-errores";

afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
});

describe("detalle de respuestas fallidas del webservice", () => {
    it("conserva el estado HTTP y el cuerpo de error sin modificar las cabeceras", async () => {
        const respuesta = new Response("Servicio temporalmente no disponible", {
            status: 503, statusText: "Service Unavailable", headers: { "X-Request-Id": "consulta-1" },
        });

        expect(await detalleRespuestaFallida(respuesta)).toEqual({
            estadoHTTP: 503, textoEstado: "Service Unavailable", cuerpoRespuesta: "Servicio temporalmente no disponible",
        });
        expect(respuesta.status).toBe(503);
        expect(respuesta.headers.get("X-Request-Id")).toBe("consulta-1");
    });

    it("tolera respuestas sin cuerpo", async () => {
        expect(await detalleRespuestaFallida(new Response(null, { status: 401, statusText: "Unauthorized" }))).toEqual({
            estadoHTTP: 401, textoEstado: "Unauthorized", cuerpoRespuesta: "",
        });
    });

    it("informa el fallo de lectura junto al estado HTTP original", async () => {
        const errorLectura = new Error("Se interrumpió el cuerpo");
        const stream = new ReadableStream<Uint8Array>({ start(controlador) { controlador.error(errorLectura); } });

        expect(await detalleRespuestaFallida(new Response(stream, { status: 502, statusText: "Bad Gateway" }))).toEqual({
            estadoHTTP: 502, textoEstado: "Bad Gateway", cuerpoRespuesta: "", cuerpoTruncado: true, errorLectura,
        });
    });

    it("conserva texto UTF-8 aunque un carácter se reparta entre fragmentos", async () => {
        const bytes = new TextEncoder().encode("Información de la UAM");
        const stream = new ReadableStream<Uint8Array>({ start(controlador) {
            controlador.enqueue(bytes.subarray(0, 10));
            controlador.enqueue(bytes.subarray(10));
            controlador.close();
        } });

        expect(await detalleRespuestaFallida(new Response(stream, { status: 500 }))).toMatchObject({
            cuerpoRespuesta: "Información de la UAM",
        });
    });

    it("limita el cuerpo a 64 KiB y cancela sin esperar una cancelación que no termina", async () => {
        const cancelar = vi.fn(() => new Promise<void>(() => undefined));
        const stream = new ReadableStream<Uint8Array>({
            start(controlador) { controlador.enqueue(new Uint8Array(70 * 1024).fill(65)); },
            cancel: cancelar,
        });

        const detalle = await detalleRespuestaFallida(new Response(stream, { status: 503 }));

        expect(detalle.cuerpoRespuesta).toBe("A".repeat(64 * 1024));
        expect(detalle.cuerpoTruncado).toBe(true);
        expect(detalle.estadoHTTP).toBe(503);
        expect(cancelar).toHaveBeenCalledOnce();
    });

    it("no marca como truncado un cuerpo que termina exactamente en el límite", async () => {
        const detalle = await detalleRespuestaFallida(new Response("A".repeat(64 * 1024), { status: 500 }));

        expect(detalle.cuerpoRespuesta).toHaveLength(64 * 1024);
        expect(detalle).not.toHaveProperty("cuerpoTruncado");
    });

    it("limita a un segundo la lectura total y conserva los fragmentos recibidos", async () => {
        vi.useFakeTimers();
        const cancelar = vi.fn(() => new Promise<void>(() => undefined));
        const stream = new ReadableStream<Uint8Array>({
            start(controlador) { controlador.enqueue(new TextEncoder().encode("Respuesta parcial")); },
            cancel: cancelar,
        });
        const pendiente = detalleRespuestaFallida(new Response(stream, { status: 504, statusText: "Gateway Timeout" }));

        await vi.advanceTimersByTimeAsync(1_000);
        const detalle = await pendiente;

        expect(detalle).toMatchObject({ estadoHTTP: 504, textoEstado: "Gateway Timeout", cuerpoRespuesta: "Respuesta parcial", cuerpoTruncado: true });
        expect(detalle.errorLectura).toBeInstanceOf(Error);
        expect((detalle.errorLectura as Error).message).toContain("Se agotó el tiempo");
        expect(cancelar).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
});

describe("registro seguro de fallos del webservice", () => {
    it("registra la cadena de causas y todos los errores de AggregateError sin alterar el error ni el contexto", () => {
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const primerError = Object.assign(new Error("Sin conexión IPv4"), { code: "ETIMEDOUT", address: "192.0.2.1", port: 443 });
        const segundoError = Object.assign(new Error("Sin conexión IPv6"), { code: "ENETUNREACH", address: "2001:db8::1", port: 443 });
        const agregado = new AggregateError([primerError, segundoError], "Ninguna dirección respondió");
        const conexion = new Error("No se estableció la conexión", { cause: agregado });
        const original = new TypeError("fetch failed", { cause: conexion });
        const contexto = Object.freeze({ especie: 60, desde: "2020-11-18", hasta: "2022-11-18", duracionMs: 10_506 });

        registrarErrorWebservice("precios históricos", original, contexto, "token-conocido");

        expect(registrar).toHaveBeenCalledOnce();
        const [mensaje, detalle] = registrar.mock.calls[0];
        expect(mensaje).toBe("Falló el webservice de precios históricos.");
        for (const texto of ["fetch failed", "Ninguna dirección respondió", "ETIMEDOUT", "ENETUNREACH", "192.0.2.1", "2001:db8::1", "2020-11-18", "2022-11-18"]) {
            expect(detalle).toContain(texto);
        }
        expect(original.cause).toBe(conexion);
        expect(conexion.cause).toBe(agregado);
        expect(agregado.errors).toEqual([primerError, segundoError]);
        expect(contexto).toEqual({ especie: 60, desde: "2020-11-18", hasta: "2022-11-18", duracionMs: 10_506 });
    });

    it("oculta el token conocido y su versión codificada en mensajes, causas y cuerpo HTTP", () => {
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const token = "jwt-secreto/+=.firma";
        const codificado = encodeURIComponent(token);
        const original = new Error(`Falló Bearer ${token}`, { cause: new Error(`Ruta ?token=${codificado}`) });
        const contexto = { cuerpoRespuesta: `Token rechazado ${token}`, url: `https://datos.uam.test/error?credencial=${codificado}` };

        registrarErrorWebservice("precios de referencia", original, contexto, token);

        const detalle = registrar.mock.calls[0][1];
        expect(detalle).toContain("[REDACTADO]");
        expect(detalle).not.toContain(token);
        expect(detalle).not.toContain(codificado);
        expect(original.message).toContain(token);
        expect(contexto.cuerpoRespuesta).toContain(token);
    });

    it("no ejecuta inspect personalizado y admite causas circulares", () => {
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const inspeccionar = vi.fn(() => "inspección ejecutada");
        const original = new Error("Error circular");
        original.cause = original;
        Object.assign(original, { [inspect.custom]: inspeccionar });

        registrarErrorWebservice("precios históricos", original, {}, "");

        expect(inspeccionar).not.toHaveBeenCalled();
        expect(registrar.mock.calls[0][1]).toContain("Circular");
        expect(registrar.mock.calls[0][1]).toContain("Error circular");
    });

    it.each([false, true])("oculta un token que queda cortado al truncar el cuerpo, codificado %s", (codificado) => {
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const token = "jwt-secreto/+=.firma";
        const prefijo = (codificado ? encodeURIComponent(token) : token).slice(0, -3);
        const contexto = { cuerpoRespuesta: `Token rechazado ${prefijo}`, cuerpoTruncado: true };

        registrarErrorWebservice("precios de referencia", new Error("HTTP 401"), contexto, token);

        expect(registrar.mock.calls[0][1]).toContain("Token rechazado [REDACTADO]");
        expect(registrar.mock.calls[0][1]).not.toContain(prefijo);
        expect(contexto.cuerpoRespuesta).toBe(`Token rechazado ${prefijo}`);
    });
});
