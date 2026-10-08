import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarHistorico } from "./cliente-webservice";
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

beforeEach(() => vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", plantilla));

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

    it("propaga solamente el estado HTTP sin mostrar el cuerpo ni el JWT", async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("credencial inválida jwt-de-prueba", { status: 401 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toEqual(
            new Error("El webservice de precios históricos respondió con estado 401."),
        );
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

    it("rechaza una fecha inválida anidada antes de devolver el histórico", async () => {
        const recibido = JSON.parse(JSON.stringify(consultaValida)) as HistoricoProducto;
        recibido.series[0].date = "2025-02-30";
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toThrow("inválida en series[0].date");
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

    it("conserva los precios del servicio aunque el mínimo supere al máximo por kg y por unidad", async () => {
        const recibido = JSON.parse(JSON.stringify(consultaValida)) as HistoricoProducto;
        Object.assign(recibido.series[0].presentations[0].prices[0], {
            min_kg: 100, max_kg: 75, min_un: 200, max_un: 75,
        });
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(recibido), { status: 200 }));

        await expect(consultarHistorico(opciones, consulta, fetcher)).resolves.toStrictEqual(recibido);
    });

    it("aborta una solicitud al alcanzar los 60 segundos", async () => {
        vi.useFakeTimers();
        let signal!: AbortSignal;
        const fetcher = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
            signal = init!.signal!;
            signal.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")));
        }));
        const resultado = expect(consultarHistorico(opciones, consulta, fetcher)).rejects.toMatchObject({ name: "AbortError" });

        await vi.advanceTimersByTimeAsync(59_999);
        expect(signal.aborted).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        await resultado;

        expect(signal.aborted).toBe(true);
        expect(fetcher).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(0);
    });
});
