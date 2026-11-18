import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarHistorico, ErrorWebserviceHistorico } from "./cliente-webservice";
import type { ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";

const opciones = { baseUrl: "https://datos.uam.test/servicio/", token: "jwt-de-prueba" };
const consulta: ConsultaHistorica = {
    speciesId: 60, desde: "2025-10-01", hasta: "2025-10-31",
};
const plantilla = "api/prices/prueba/{species_id}?from={from}&to={to}";
const consultaValida: HistoricoProducto = {
    classification_id: 2,
    classification: "Exóticos/Importados",
    species_id: 60,
    species: "Banana",
    from: consulta.desde,
    to: consulta.hasta,
    series: [{
        date: "2025-10-01",
        volume_kg: 1000,
        presentations: [{
            variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
            prices: [{ category: "I", min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: true }],
        }],
    }],
};

function respuestaValida(): Response {
    return new Response(JSON.stringify(consultaValida), { status: 200 });
}

beforeEach(() => {
    vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", plantilla);
});

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
});

describe("cliente del webservice de precios históricos", () => {
    it("consulta la ruta documentada de testing por especie y período sin exigir clasificación en la URL", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", "/api/prices/history/{species_id}?from={from}&to={to}");
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respuestaValida());

        await expect(consultarHistorico({
            baseUrl: "https://uam-pyv-testing.flow-labs.io", token: "jwt-de-prueba",
        }, consulta, fetcher)).resolves.toEqual(consultaValida);

        expect(fetcher).toHaveBeenCalledExactlyOnceWith(
            "https://uam-pyv-testing.flow-labs.io/api/prices/history/60?from=2025-10-01&to=2025-10-31",
            expect.objectContaining({
                method: "GET",
                headers: { Authorization: "Bearer jwt-de-prueba", Accept: "application/json" },
            }),
        );
    });

    it("sustituye parámetros de ruta y query relativos y envía el JWT solamente en la cabecera", async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respuestaValida());

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toEqual(consultaValida);

        expect(fetcher).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledWith(
            "https://datos.uam.test/servicio/api/prices/prueba/60?from=2025-10-01&to=2025-10-31",
            expect.objectContaining({
                method: "GET",
                headers: { Authorization: "Bearer jwt-de-prueba", Accept: "application/json" },
                cache: "no-store",
                redirect: "error",
                signal: expect.any(AbortSignal),
            }),
        );
        const [url, request] = fetcher.mock.calls[0];
        expect(String(url)).not.toContain(opciones.token);
        expect(request?.body).toBeUndefined();
    });

    it("resuelve una ruta desde la raíz aunque la URL base incluya un prefijo", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", "/consulta?species_id={species_id}&from={from}&to={to}");
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respuestaValida());

        await consultarHistorico(opciones, consulta, fetcher);

        expect(fetcher.mock.calls[0][0]).toBe("https://datos.uam.test/consulta?species_id=60&from=2025-10-01&to=2025-10-31");
    });

    it("acepta una plantilla absoluta HTTPS del mismo origen", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", "https://datos.uam.test/consulta/{species_id}/{from}/{to}");
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(respuestaValida());

        await consultarHistorico(opciones, consulta, fetcher);

        expect(fetcher.mock.calls[0][0]).toBe("https://datos.uam.test/consulta/60/2025-10-01/2025-10-31");
    });

    it.each([undefined, "", "   "])("rechaza un endpoint sin configurar antes de hacer fetch: %s", async (endpoint) => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", endpoint);
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("Falta configurar el endpoint");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each(["species_id", "from", "to"])(
        "rechaza una plantilla sin el parámetro obligatorio %s", async (campo) => {
            vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", plantilla.replace(`{${campo}}`, "fijo"));
            const fetcher = vi.fn<typeof fetch>();

            await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow(`debe incluir el parámetro {${campo}}`);
            expect(fetcher).not.toHaveBeenCalled();
        },
    );

    it.each(["classification_id", "desconocido", "constructor", "toString"])("rechaza el marcador desconocido {%s}", async (campo) => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", plantilla + `&extra={${campo}}`);
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("parámetro desconocido");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each([
        "http://datos.uam.test",
        "https://usuario:clave@datos.uam.test",
        "https://datos.uam.test?token=secreto-de-prueba",
        "https://datos.uam.test#fragmento",
        "ruta-relativa",
    ])("rechaza una URL base inválida o insegura: %s", async (baseUrl) => {
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico({ ...opciones, baseUrl }, consulta, fetcher)).rejects.toThrow("URL del webservice");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each([
        "http://datos.uam.test/",
        "https://otro-servicio.example.test/",
        "//otro-servicio.example.test/",
        "https://datos.uam.test:8443/",
        "https://usuario:clave@datos.uam.test/",
    ])("rechaza un endpoint que podría enviar el JWT a un origen no autorizado: %s", async (prefijo) => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", prefijo + plantilla);
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("mismo servicio HTTPS");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("rechaza fragmentos del endpoint antes de hacer la solicitud", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", plantilla + "#fragmento");
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("fragmentos");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("rechaza una URL malformada en la plantilla antes de hacer fetch", async () => {
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", "https://[host-invalido]/" + plantilla);
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("URL del webservice");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "jwt\r\ncabecera: valor"])("rechaza un token inválido antes de hacer fetch", async (token) => {
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico({ ...opciones, token }, consulta, fetcher)).rejects.toThrow("Falta un token válido");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("valida los parámetros de la consulta antes de acceder al servicio", async () => {
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarHistorico(opciones, { ...consulta, speciesId: 0 }, fetcher)).rejects.toThrow("speciesId");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("informa estado HTTP, duración, especie y período sin mostrar cuerpo, URL ni JWT", async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("credencial inválida jwt-de-prueba", { status: 401 }));

        const error = await consultarHistorico(opciones, consulta, fetcher).catch((causa) => causa as Error);

        expect(error).toBeInstanceOf(ErrorWebserviceHistorico);
        expect((error as Error).name).toBe("ErrorWebserviceHistorico");
        expect((error as Error).message).toBe(
            "El webservice de precios históricos respondió con estado 401. Duración: 0 ms. Especie: 60. Período: 2025-10-01 a 2025-10-31.",
        );
        expect((error as Error).message).not.toContain(opciones.token);
        expect((error as Error).message).not.toContain(opciones.baseUrl);
        expect((error as Error).message).not.toContain("credencial inválida");
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rechaza un cuerpo que no sea JSON válido", async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("{", { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow(
            "El webservice de precios históricos devolvió un JSON inválido.",
        );
    });

    it("rechaza un JSON que no tiene la estructura del histórico", async () => {
        const recibido = { series: [] };
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("Respuesta de precios históricos inválida");
    });

    it("conserva una fecha anidada inválida junto con los demás registros", async () => {
        const recibido = JSON.parse(JSON.stringify(consultaValida)) as HistoricoProducto;
        recibido.series[0].date = "2025-02-30";
        const diaValido = { ...consultaValida.series[0], date: "2025-10-02" };
        recibido.series.push(diaValido);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        const historico = await consultarHistorico(opciones, consulta, fetcher);

        expect(historico).toStrictEqual(recibido);
    });

    it("rechaza la respuesta de otra especie", async () => {
        const recibido = { ...consultaValida, species_id: 61 };
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("inválida en species_id:");
    });

    it("conserva la clasificación informada por el servicio como metadato de la respuesta", async () => {
        const recibido = { ...consultaValida, classification_id: 3, classification: "Otra clasificación" };
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(recibido);
    });

    it("conserva una cancelación durante la lectura del cuerpo", async () => {
        const error = new DOMException("Solicitud cancelada", "AbortError");
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue({
            ok: true,
            json: vi.fn().mockRejectedValue(error),
        } as unknown as Response);

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toBe(error);
    });

    it("conserva mínimos que superan al máximo y las demás categorías", async () => {
        const recibido = JSON.parse(JSON.stringify(consultaValida)) as HistoricoProducto;
        Object.assign(recibido.series[0].presentations[0].prices[0], {
            min_kg: 100, max_kg: 75, min_un: 200, max_un: 75,
        });
        const precioValido = { ...consultaValida.series[0].presentations[0].prices[0], category: "II" };
        recibido.series[0].presentations[0].prices.push(precioValido);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        const historico = await consultarHistorico(opciones, consulta, fetcher);

        expect(historico).toStrictEqual(recibido);
    });

    it("conserva el valor Ñ sin generar logs ni cambiar las otras categorías", async () => {
        const advertir = vi.spyOn(console, "warn").mockImplementation(() => undefined);
        try {
            const recibido = JSON.parse(JSON.stringify(consultaValida)) as HistoricoProducto;
            const precioValido = { ...recibido.series[0].presentations[0].prices[0], category: "II" };
            Object.assign(recibido.series[0].presentations[0].prices[0], { min_kg: "Ñ" });
            recibido.series[0].presentations[0].prices.push(precioValido);
            const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

            const historico = await consultarHistorico(opciones, consulta, fetcher);

            expect(historico).toStrictEqual(recibido);
            expect(advertir).not.toHaveBeenCalled();
            expect(fetcher).toHaveBeenCalledOnce();
        } finally {
            advertir.mockRestore();
        }
    });

    it.each([
        { nombre: "nulos", precios: { min_kg: null, max_kg: null, min_un: null, max_un: null }, volumen: null },
        { nombre: "negativos", precios: { min_kg: -10, max_kg: -5, min_un: -20, max_un: -15 }, volumen: -1 },
        { nombre: "texto numérico", precios: { min_kg: "0010.50", max_kg: "20.00", min_un: "10", max_un: "20" }, volumen: "001.25" },
    ])("devuelve íntegros los precios y volumen de $nombre", async ({ precios, volumen }) => {
        const recibido = structuredClone(consultaValida);
        Object.assign(recibido.series[0].presentations[0].prices[0], precios);
        Object.assign(recibido.series[0], { volume_kg: volumen });
        const original = structuredClone(recibido);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(original);
        expect(recibido).toStrictEqual(original);
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it("conserva un precio negativo dentro de su presentación", async () => {
        const recibido = structuredClone(consultaValida);
        recibido.series[0].presentations[0].prices[0].min_kg = -1;
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(recibido);
    });

    it.each([null, false, { fecha: "2025-10-01" }, [2025, 10, 1]])
        ("conserva la fecha anidada inesperada %j", async (fecha) => {
            const recibido = structuredClone(consultaValida);
            Object.assign(recibido.series[0], { date: fecha });
            const original = structuredClone(recibido);
            const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

            await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(original);
            expect(recibido).toStrictEqual(original);
        });

    it("conserva objetos, arrays, booleanos y nulos dentro de atributos y precios sin rechazar el histórico", async () => {
        const recibido = structuredClone(consultaValida);
        Object.assign(recibido.series[0], { volume_kg: { cantidad: [1000, null] } });
        Object.assign(recibido.series[0].presentations[0], {
            variety: { nombre: "Especial" }, country: ["URUGUAY", false], caliber: false, measure_unit: null,
        });
        Object.assign(recibido.series[0].presentations[0].prices[0], {
            category: { nombre: "Primera" }, min_kg: { precio: 10 }, max_kg: [75, "Ñ"],
            min_un: false, max_un: null, is_reference: { publicado: true },
        });
        const original = structuredClone(recibido);
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(original);

        expect(recibido).toStrictEqual(original);
        expect(fetcher).toHaveBeenCalledOnce();
    });

    it("descarta solamente un elemento de precios que no es objeto y conserva el precio vecino", async () => {
        const recibido = structuredClone(consultaValida);
        const original = structuredClone(recibido);
        Object.assign(recibido.series[0].presentations[0], {
            prices: [false, original.series[0].presentations[0].prices[0]],
        });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(original);
        expect(recibido.series[0].presentations[0].prices).toHaveLength(2);
    });

    it("descarta solamente una presentación sin array de precios y conserva la otra presentación", async () => {
        const recibido = structuredClone(consultaValida);
        const original = structuredClone(recibido);
        const invalida = { ...original.series[0].presentations[0], prices: null };
        Object.assign(recibido.series[0], {
            presentations: [invalida, original.series[0].presentations[0]],
        });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(original);
        expect(recibido.series[0].presentations).toHaveLength(2);
    });

    it("descarta solamente el día sin array de presentaciones y conserva el día vecino", async () => {
        const recibido = structuredClone(consultaValida);
        const original = structuredClone(recibido);
        Object.assign(recibido, {
            series: [{ ...original.series[0], presentations: null }, original.series[0]],
        });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(original);
        expect(recibido.series).toHaveLength(2);
    });

    it("rechaza la respuesta completa si ninguno de sus días tiene una estructura operable", async () => {
        const recibido = structuredClone(consultaValida);
        Object.assign(recibido, { series: [null, { date: consulta.desde, presentations: null }] });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("Respuesta de precios históricos inválida");
    });

    it("permite superar 60 segundos y aborta al alcanzar el límite de cinco minutos definido en el código", async () => {
        vi.useFakeTimers();
        let signal!: AbortSignal;
        const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
            signal = init!.signal!;
            signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")));
        }));
        const resultado = expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow(
            "El webservice de precios históricos superó el tiempo máximo de 300000 ms.",
        );

        await vi.advanceTimersByTimeAsync(60_000);
        expect(signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(239_999);
        expect(signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await resultado;

        expect(signal.aborted).toBe(true);
        expect(fetcher).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("incluye el contexto de la consulta al alcanzar el timeout", async () => {
        vi.useFakeTimers();
        const limiteMs = 300_000;
        let signal!: AbortSignal;
        const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
            signal = init!.signal!;
            signal.addEventListener("abort", () => reject(new DOMException("Abortado", "AbortError")));
        }));
        const resultado = consultarHistorico(opciones, consulta, fetcher).catch((causa) => causa as Error);

        await vi.advanceTimersByTimeAsync(limiteMs - 1);
        expect(signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        const error = await resultado;

        expect((error as Error).message).toBe(
            `El webservice de precios históricos superó el tiempo máximo de ${limiteMs} ms. Duración: ${limiteMs} ms. Especie: 60. Período: 2025-10-01 a 2025-10-31.`,
        );
        expect(signal.aborted).toBe(true);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("el timeout cubre la lectura del JSON aunque ya se hayan recibido las cabeceras", async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn<typeof fetch>(async (_url, init) => ({
            ok: true,
            json: () => new Promise((_resolve, reject) => {
                init!.signal!.addEventListener("abort", () => reject(new DOMException("Abortado al leer cuerpo", "AbortError")));
            }),
        } as unknown as Response));
        const resultado = expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow(
            "El webservice de precios históricos superó el tiempo máximo de 300000 ms.",
        );

        await vi.advanceTimersByTimeAsync(300_000);
        await resultado;

        expect(fetcher).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("distingue un HTTP 500 rápido de un timeout e informa su duración sin leer el cuerpo", async () => {
        vi.useFakeTimers();
        const json = vi.fn();
        const fetcher = vi.fn<typeof fetch>(() => new Promise((resolve) => {
            setTimeout(() => resolve({ ok: false, status: 500, json } as unknown as Response), 120);
        }));
        const resultado = consultarHistorico(opciones, consulta, fetcher).catch((causa) => causa as Error);

        await vi.advanceTimersByTimeAsync(120);
        const error = await resultado;

        expect(error).toBeInstanceOf(ErrorWebserviceHistorico);
        expect((error as Error).message).toBe(
            "El webservice de precios históricos respondió con estado 500. Duración: 120 ms. Especie: 60. Período: 2025-10-01 a 2025-10-31.",
        );
        expect((error as Error).message).not.toContain("superó");
        expect(json).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
    });

    it("informa el código seguro de un fallo de red sin copiar mensajes, URL, token ni causa", async () => {
        vi.useFakeTimers();
        const causa = Object.assign(new Error(`${opciones.baseUrl} ${opciones.token}`), { code: "UND_ERR_CONNECT_TIMEOUT" });
        const original = new TypeError(`fetch failed ${opciones.baseUrl} ${opciones.token}`, { cause: causa });
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(original);

        const error = await consultarHistorico(opciones, consulta, fetcher).catch((fallo) => fallo as Error);

        expect((error as Error).message).toContain("TypeError, código UND_ERR_CONNECT_TIMEOUT");
        expect((error as Error).message).toContain("Duración: 0 ms. Especie: 60.");
        expect((error as Error).message).not.toContain(opciones.baseUrl);
        expect((error as Error).message).not.toContain(opciones.token);
        expect((error as Error).cause).toBeUndefined();
        expect(vi.getTimerCount()).toBe(0);
    });

    it.each([`${opciones.baseUrl} ${opciones.token}`, "BAD\nCODE", 123, undefined])
        ("omite códigos de red no seguros: %j", async (code) => {
            const fetcher = vi.fn<typeof fetch>().mockRejectedValue(new TypeError("mensaje privado", { cause: { code } }));

            const error = await consultarHistorico(opciones, consulta, fetcher).catch((causa) => causa as Error);

            expect((error as Error).message).toContain("error de red (TypeError)");
            expect((error as Error).message).not.toContain("mensaje privado");
            expect((error as Error).message).not.toContain(opciones.token);
            expect((error as Error).message).not.toContain(opciones.baseUrl);
        });

    it("conserva un AbortError ajeno al timeout y cancela el temporizador", async () => {
        vi.useFakeTimers();
        const error = new DOMException("Cancelación externa", "AbortError");
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error);

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toBe(error);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("libera el temporizador después de una respuesta exitosa o un JSON inválido", async () => {
        vi.useFakeTimers();
        const fetcher = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(respuestaValida())
            .mockResolvedValueOnce(new Response("{", { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toEqual(consultaValida);
        expect(vi.getTimerCount()).toBe(0);
        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("JSON inválido");
        expect(vi.getTimerCount()).toBe(0);
    });
});
