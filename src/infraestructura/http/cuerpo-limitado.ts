const TAMANO_IMAGEN = 10 * 1024 * 1024;
const MARGEN_FORMULARIO = 64 * 1024;

export const LIMITE_JSON_PUBLICACION = Math.ceil(TAMANO_IMAGEN / 3) * 4 + MARGEN_FORMULARIO;
export const LIMITE_FORMULARIO_PUBLICACION = TAMANO_IMAGEN + MARGEN_FORMULARIO;

export class ErrorCuerpoDemasiadoGrande extends Error {
    constructor() {
        super("La solicitud es demasiado grande. La fotografía debe pesar hasta 10 MB.");
    }
}

async function leerCuerpoLimitado(solicitud: Request, limite: number): Promise<Uint8Array<ArrayBuffer>> {
    const longitud = solicitud.headers.get("content-length");
    if (longitud && /^\d+$/.test(longitud) && Number(longitud) > limite) {
        await solicitud.body?.cancel().catch(() => undefined);
        throw new ErrorCuerpoDemasiadoGrande();
    }
    if (!solicitud.body) return new Uint8Array();
    const lector = solicitud.body.getReader();
    const fragmentos: Uint8Array[] = [];
    let total = 0;
    try {
        while (true) {
            const { done, value } = await lector.read();
            if (done) break;
            total += value.byteLength;
            if (total > limite) {
                await lector.cancel().catch(() => undefined);
                throw new ErrorCuerpoDemasiadoGrande();
            }
            fragmentos.push(value);
        }
    } finally {
        lector.releaseLock();
    }
    const cuerpo = new Uint8Array(total);
    let posicion = 0;
    for (const fragmento of fragmentos) {
        cuerpo.set(fragmento, posicion);
        posicion += fragmento.byteLength;
    }
    return cuerpo;
}

export async function leerJsonLimitado(solicitud: Request): Promise<unknown> {
    const cuerpo = await leerCuerpoLimitado(solicitud, LIMITE_JSON_PUBLICACION);
    return JSON.parse(new TextDecoder().decode(cuerpo));
}

export async function leerFormularioLimitado(solicitud: Request): Promise<FormData> {
    const cuerpo = await leerCuerpoLimitado(solicitud, LIMITE_FORMULARIO_PUBLICACION);
    return new Response(cuerpo, { headers: solicitud.headers }).formData();
}
