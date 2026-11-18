import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consultarUltimoRelevamiento } from "./cliente-webservice";

const opciones = { baseUrl: "https://datos.uam.test/", token: "jwt-de-prueba" };

beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

const consultaValida = {
    survey_date: "2026-08-27",
    types: [
        {
            classification_id: 1,
            classification: "Hortalizas",
            products: [
                {
                    species_id: 2,
                    species: "Acelga",
                    varieties: [
                        {
                            variety: "-",
                            presentations: [
                                {
                                    caliber: "M",
                                    country: "URUGUAY",
                                    measure_unit: "DOC",
                                    prices: [{ category: "I", min_kg: 10, max_kg: 20, min_un: 100, max_un: 200, is_reference: true }],
                                },
                            ],
                        },
                    ],
                },
            ],
        },
    ],
};

describe("cliente del webservice de precios", () => {
    it("consulta el último relevamiento con el token solo en la cabecera", async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(consultaValida), { status: 200 }));

        const resultado = await consultarUltimoRelevamiento(opciones, fetcher);

        expect(resultado).toEqual(consultaValida);
        expect(console.error).not.toHaveBeenCalled();
        expect(fetcher).toHaveBeenCalledOnce();
        expect(fetcher).toHaveBeenCalledWith(
            "https://datos.uam.test/api/prices/latest",
            expect.objectContaining({
                method: "GET",
                headers: { Authorization: "Bearer jwt-de-prueba", Accept: "application/json" },
                cache: "no-store",
                signal: expect.any(AbortSignal),
            }),
        );
    });

    it.each(["http://datos.uam.test", "https://usuario:clave@datos.uam.test", "https://datos.uam.test?token=secreto", "ruta-relativa"])(
        "rechaza URL insegura o inválida: %s",
        async (baseUrl) => {
            const fetcher = vi.fn<typeof fetch>();

            await expect(consultarUltimoRelevamiento({ ...opciones, baseUrl }, fetcher)).rejects.toThrow();
            expect(fetcher).not.toHaveBeenCalled();
        },
    );

    it("rechaza un token vacío antes de hacer la solicitud", async () => {
        const fetcher = vi.fn<typeof fetch>();

        await expect(consultarUltimoRelevamiento({ ...opciones, token: " " }, fetcher)).rejects.toThrow("Falta un token válido");
        expect(fetcher).not.toHaveBeenCalled();
    });

    it("propaga el estado HTTP sin mostrar la respuesta ni el token", async () => {
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(`credencial inválida ${opciones.token}`, { status: 401 }));

        await expect(consultarUltimoRelevamiento(opciones, fetcher)).rejects.toThrow("El webservice de precios respondió con estado 401.");
        expect(console.error).toHaveBeenCalledExactlyOnceWith("Falló el webservice de precios de referencia.", expect.any(String));
        const detalle = vi.mocked(console.error).mock.calls[0][1] as string;
        expect(detalle).toContain("estadoHTTP: 401");
        expect(detalle).toContain("credencial inválida [REDACTADO]");
        expect(detalle).not.toContain(opciones.token);
    });

    it("registra la causa original de red y conserva el error propagado", async () => {
        const causa = Object.assign(new Error("connect timeout"), { code: "UND_ERR_CONNECT_TIMEOUT", address: "192.0.2.1", port: 443 });
        const error = new TypeError("fetch failed", { cause: causa });
        const fetcher = vi.fn<typeof fetch>().mockRejectedValue(error);

        await expect(consultarUltimoRelevamiento(opciones, fetcher)).rejects.toBe(error);

        expect(console.error).toHaveBeenCalledOnce();
        const detalle = vi.mocked(console.error).mock.calls[0][1] as string;
        expect(detalle).toContain("TypeError: fetch failed");
        expect(detalle).toContain("UND_ERR_CONNECT_TIMEOUT");
        expect(detalle).toContain("192.0.2.1");
        expect(detalle).toContain("port: 443");
    });

    it("registra el error original al recibir un JSON inválido", async () => {
        const error = new SyntaxError("Respuesta JSON incompleta");
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, json: vi.fn().mockRejectedValue(error) } as unknown as Response);

        await expect(consultarUltimoRelevamiento(opciones, fetcher)).rejects.toBe(error);
        expect(console.error).toHaveBeenCalledExactlyOnceWith(
            "Falló el webservice de precios de referencia.", expect.stringContaining("SyntaxError: Respuesta JSON incompleta"),
        );
    });

    it("rechaza una respuesta JSON que no tenga la estructura esperada", async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ survey_date: "2026-08-27", types: [] }), { status: 200 }));

        await expect(consultarUltimoRelevamiento(opciones, fetcher)).rejects.toThrow("Respuesta de precios de referencia inválida");
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("aborta solicitudes que superan los 15 segundos", async () => {
        vi.useFakeTimers();

        try {
            const fetcher = vi.fn<typeof fetch>(
                (_url, init) =>
                    new Promise<Response>((_resolve, reject) => {
                        init?.signal?.addEventListener("abort", () => reject(new DOMException("Timeout", "AbortError")));
                    }),
            );

            const consulta = consultarUltimoRelevamiento(opciones, fetcher);
            const resultado = expect(consulta).rejects.toMatchObject({ name: "AbortError" });

            await vi.advanceTimersByTimeAsync(15_000);
            await resultado;
            expect(fetcher).toHaveBeenCalledOnce();
            expect(console.error).toHaveBeenCalledExactlyOnceWith(
                "Falló el webservice de precios de referencia.", expect.stringContaining("AbortError"),
            );
        } finally {
            vi.useRealTimers();
        }
    });
});
