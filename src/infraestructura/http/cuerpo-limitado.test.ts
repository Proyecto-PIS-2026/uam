import { describe, expect, it, vi } from "vitest";
import {
    ErrorCuerpoDemasiadoGrande,
    leerFormularioLimitado,
    leerJsonLimitado,
    LIMITE_FORMULARIO_PUBLICACION,
    LIMITE_JSON_PUBLICACION,
} from "./cuerpo-limitado";

function solicitudEnPartes(fragmentos: Uint8Array[], cabeceras: Record<string, string> = {}) {
    const cancelar = vi.fn();
    let posicion = 0;
    const flujo = new ReadableStream<Uint8Array>({
        pull(controlador) {
            if (posicion < fragmentos.length) controlador.enqueue(fragmentos[posicion++]);
            else controlador.close();
        },
        cancel: cancelar,
    }, { highWaterMark: 0 });
    const opciones: RequestInit & { duplex: "half" } = {
        method: "POST", body: flujo, headers: cabeceras, duplex: "half",
    };
    return { solicitud: new Request("http://localhost/api/publicaciones", opciones), cancelar };
}

describe("lectura limitada de publicaciones", () => {
    it("rechaza el tamaño declarado antes de consumir el cuerpo", async () => {
        const { solicitud, cancelar } = solicitudEnPartes([], { "content-length": String(LIMITE_JSON_PUBLICACION + 1) });
        await expect(leerJsonLimitado(solicitud)).rejects.toBeInstanceOf(ErrorCuerpoDemasiadoGrande);
        expect(cancelar).toHaveBeenCalledOnce();
    });

    it.each<Record<string, string>>([{}, { "content-length": "2" }])("corta el cuerpo real aunque el tamaño declarado falte o sea menor", async (cabeceras) => {
        const { solicitud, cancelar } = solicitudEnPartes([
            new Uint8Array(LIMITE_JSON_PUBLICACION), new Uint8Array(1), new Uint8Array(10),
        ], cabeceras);
        await expect(leerJsonLimitado(solicitud)).rejects.toBeInstanceOf(ErrorCuerpoDemasiadoGrande);
        expect(cancelar).toHaveBeenCalledOnce();
    });

    it("acepta JSON de tamaño exactamente igual al límite", async () => {
        const cuerpo = new TextEncoder().encode(`"${"a".repeat(LIMITE_JSON_PUBLICACION - 2)}"`);
        const { solicitud } = solicitudEnPartes([cuerpo]);
        const resultado = await leerJsonLimitado(solicitud);
        expect(typeof resultado).toBe("string");
        expect((resultado as string).length).toBe(LIMITE_JSON_PUBLICACION - 2);
    });

    it("decodifica texto UTF-8 repartido entre fragmentos", async () => {
        const cuerpo = new TextEncoder().encode('{"nombre":"Ñandú"}');
        const { solicitud } = solicitudEnPartes([cuerpo.subarray(0, 12), cuerpo.subarray(12)]);
        expect(await leerJsonLimitado(solicitud)).toEqual({ nombre: "Ñandú" });
    });

    it("propaga los errores de sintaxis del JSON", async () => {
        const { solicitud } = solicitudEnPartes([new TextEncoder().encode("{incompleto")]);
        await expect(leerJsonLimitado(solicitud)).rejects.toBeInstanceOf(SyntaxError);
    });

    it("lee los campos multipart dentro del límite", async () => {
        const cuerpo = [
            "--prueba", 'Content-Disposition: form-data; name="cambios"', "", '{"precio":"10"}',
            "--prueba--", "",
        ].join("\r\n");
        const { solicitud } = solicitudEnPartes([new TextEncoder().encode(cuerpo)], {
            "content-type": "multipart/form-data; boundary=prueba",
        });
        const formulario = await leerFormularioLimitado(solicitud);
        expect(formulario.get("cambios")).toBe('{"precio":"10"}');
    });

    it("corta multipart excesivo antes de procesar sus campos", async () => {
        const { solicitud, cancelar } = solicitudEnPartes([
            new Uint8Array(LIMITE_FORMULARIO_PUBLICACION), new Uint8Array(1),
        ], { "content-type": "multipart/form-data; boundary=prueba" });
        await expect(leerFormularioLimitado(solicitud)).rejects.toBeInstanceOf(ErrorCuerpoDemasiadoGrande);
        expect(cancelar).toHaveBeenCalledOnce();
    });
});
