import { inspect } from "node:util";

const MAXIMO_CUERPO_RESPUESTA_BYTES = 64 * 1024;
const TIEMPO_LECTURA_RESPUESTA_MS = 1_000;

export async function detalleRespuestaFallida(respuesta: Response): Promise<Record<string, unknown>> {
    const detalle = { estadoHTTP: respuesta.status, textoEstado: respuesta.statusText };
    let lector: ReadableStreamDefaultReader<Uint8Array> | undefined;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let cuerpoRespuesta = "";
    let bytesLeidos = 0;
    const decodificador = new TextDecoder();
    const cancelarLectura = () => {
        try {
            void lector?.cancel().catch(() => undefined);
        } catch {
            // El diagnóstico conserva el error original aunque el stream no admita cancelación.
        }
    };
    try {
        if (!respuesta.body) return { ...detalle, cuerpoRespuesta };
        lector = respuesta.body.getReader();
        const limiteLectura = new Promise<never>((_resolve, reject) => {
            temporizador = setTimeout(() => reject(new Error("Se agotó el tiempo para leer el cuerpo de la respuesta de error.")), TIEMPO_LECTURA_RESPUESTA_MS);
        });
        while (true) {
            const { done, value } = await Promise.race([lector.read(), limiteLectura]);
            if (done) {
                cuerpoRespuesta += decodificador.decode();
                return { ...detalle, cuerpoRespuesta };
            }
            const disponibles = MAXIMO_CUERPO_RESPUESTA_BYTES - bytesLeidos;
            const fragmento = value.subarray(0, disponibles);
            cuerpoRespuesta += decodificador.decode(fragmento, { stream: true });
            bytesLeidos += fragmento.byteLength;
            if (value.byteLength > disponibles) {
                cuerpoRespuesta += decodificador.decode();
                cancelarLectura();
                return { ...detalle, cuerpoRespuesta, cuerpoTruncado: true };
            }
        }
    } catch (errorLectura) {
        cancelarLectura();
        cuerpoRespuesta += decodificador.decode();
        return { ...detalle, cuerpoRespuesta, cuerpoTruncado: true, errorLectura };
    } finally {
        clearTimeout(temporizador);
        try {
            lector?.releaseLock();
        } catch {
            // La lectura pendiente puede impedir liberar el lector después del timeout.
        }
    }
}

export function registrarErrorWebservice(
    servicio: "precios de referencia" | "precios históricos",
    error: unknown,
    contexto: Record<string, unknown>,
    token: string,
): void {
    const contextoSeguro = { ...contexto };
    const secretos = token ? [token, encodeURIComponent(token)] : [];
    if (contextoSeguro.cuerpoTruncado === true && typeof contextoSeguro.cuerpoRespuesta === "string") {
        let cuerpo = contextoSeguro.cuerpoRespuesta;
        for (const secreto of secretos) {
            for (let longitud = Math.min(secreto.length - 1, cuerpo.length); longitud > 0; longitud--) {
                if (cuerpo.endsWith(secreto.slice(0, longitud))) {
                    cuerpo = cuerpo.slice(0, -longitud) + "[REDACTADO]";
                    break;
                }
            }
        }
        contextoSeguro.cuerpoRespuesta = cuerpo;
    }
    const detalleExcepcion = error instanceof DOMException
        ? { nombreError: error.name, mensajeError: error.message, trazaError: error.stack }
        : {};
    let detalle = inspect({ ...contextoSeguro, ...detalleExcepcion, error }, {
        depth: null,
        maxArrayLength: null,
        maxStringLength: null,
        colors: false,
        customInspect: false,
    });
    for (const secreto of secretos) {
        detalle = detalle.replaceAll(secreto, "[REDACTADO]");
    }
    console.error(`Falló el webservice de ${servicio}.`, detalle);
}
