import { describe, expect, it, vi } from "vitest";
import { consultarUltimoRelevamiento } from "./cliente-webservice";

const opciones = { baseUrl: "https://datos.uam.test/", token: "jwt-de-prueba" };

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
        const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response("credencial inválida", { status: 401 }));

        await expect(consultarUltimoRelevamiento(opciones, fetcher)).rejects.toThrow("El webservice de precios respondió con estado 401.");
    });

    it("rechaza una respuesta JSON que no tenga la estructura esperada", async () => {
        const fetcher = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response(JSON.stringify({ survey_date: "2026-08-27", types: [] }), { status: 200 }));

        await expect(consultarUltimoRelevamiento(opciones, fetcher)).rejects.toThrow("Respuesta de precios de referencia inválida");
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
        } finally {
            vi.useRealTimers();
        }
    });
});
