import { describe, expect, it, vi } from "vitest";
import consultaLocal from "./consulta-referencia.json";
import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import { leerEstadoCacheDiaria, resolverCacheDiaria, type EstadoCacheDiaria } from "./politica-cache-diaria";

function consulta(fecha: string): ConsultaPreciosReferencia {
    return {
        survey_date: fecha,
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
                                variety: "Común",
                                presentations: [
                                    {
                                        caliber: "Mediano",
                                        country: "Uruguay",
                                        measure_unit: "Docena",
                                        prices: [{ category: "I", min_kg: 10, max_kg: 15, min_un: 100, max_un: 150, is_reference: true }],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },
        ],
    };
}

function estadoDe(fecha: string, dato: ConsultaPreciosReferencia): EstadoCacheDiaria {
    return { version: 1, ultimoIntento: fecha, ultimoExito: fecha, consulta: dato };
}

describe("resolverCacheDiaria", () => {
    it("consulta y guarda el primer relevamiento", async () => {
        const dato = consulta("2026-10-01");
        const consultar = vi.fn().mockResolvedValue(dato);
        const resultado = await resolverCacheDiaria(null, "2026-10-01", consultar);

        expect(consultar).toHaveBeenCalledOnce();
        expect(resultado).toEqual({ consulta: dato, nuevoEstado: estadoDe("2026-10-01", dato) });
    });

    it("reutiliza el estado en el mismo día sin consultar", async () => {
        const dato = consulta("2026-10-01");
        const consultar = vi.fn();
        const resultado = await resolverCacheDiaria(estadoDe("2026-10-01", dato), "2026-10-01", consultar);

        expect(consultar).not.toHaveBeenCalled();
        expect(resultado).toEqual({ consulta: dato, nuevoEstado: null });
    });

    it("actualiza cuando empieza el día siguiente en Montevideo", async () => {
        const anterior = consulta("2026-10-01");
        const actual = consulta("2026-10-02");
        const consultar = vi.fn().mockResolvedValue(actual);
        const resultado = await resolverCacheDiaria(estadoDe("2026-10-01", anterior), "2026-10-02", consultar);

        expect(consultar).toHaveBeenCalledOnce();
        expect(resultado).toEqual({ consulta: actual, nuevoEstado: estadoDe("2026-10-02", actual) });
    });

    it("conserva el último relevamiento si falla y no reintenta ese día", async () => {
        const anterior = consulta("2026-10-01");
        const consultar = vi.fn().mockRejectedValue(new Error("Servicio no disponible"));
        const primero = await resolverCacheDiaria(estadoDe("2026-10-01", anterior), "2026-10-02", consultar);
        const segundo = await resolverCacheDiaria(primero.nuevoEstado, "2026-10-02", consultar);

        expect(consultar).toHaveBeenCalledOnce();
        expect(primero).toEqual({
            consulta: anterior,
            nuevoEstado: { version: 1, ultimoIntento: "2026-10-02", ultimoExito: "2026-10-01", consulta: anterior },
        });
        expect(segundo).toEqual({ consulta: anterior, nuevoEstado: null });
    });

    it("registra un primer fallo sin datos y no reintenta ese día", async () => {
        const consultar = vi.fn().mockRejectedValue(new Error("Servicio no disponible"));
        const primero = await resolverCacheDiaria(null, "2026-10-01", consultar);
        const segundo = await resolverCacheDiaria(primero.nuevoEstado, "2026-10-01", consultar);

        expect(consultar).toHaveBeenCalledOnce();
        expect(primero).toEqual({
            consulta: null,
            nuevoEstado: { version: 1, ultimoIntento: "2026-10-01", ultimoExito: null, consulta: null },
        });
        expect(segundo).toEqual({ consulta: null, nuevoEstado: null });
    });
});

describe("leerEstadoCacheDiaria", () => {
    it("recupera un estado válido serializado", () => {
        const estado = estadoDe("2026-10-01", consulta("2026-10-01"));
        expect(leerEstadoCacheDiaria(JSON.stringify(estado))).toEqual(estado);
    });

    it("reconoce el relevamiento local completo guardado como caché", () => {
        const estado = { version: 1, ultimoIntento: "2026-10-01", ultimoExito: "2026-10-01", consulta: consultaLocal };

        expect(leerEstadoCacheDiaria(JSON.stringify(estado))).toEqual(estado);
    });

    it("descarta estados ilegibles, incompletos o con datos inválidos", () => {
        expect(leerEstadoCacheDiaria(null)).toBeNull();
        expect(leerEstadoCacheDiaria("{")).toBeNull();
        expect(leerEstadoCacheDiaria(JSON.stringify({ version: 2, ultimoIntento: "2026-10-01" }))).toBeNull();
        expect(
            leerEstadoCacheDiaria(
                JSON.stringify({
                    version: 1,
                    ultimoIntento: "2026-10-01",
                    ultimoExito: "2026-10-01",
                    consulta: { survey_date: "2026-10-01", types: [] },
                }),
            ),
        ).toBeNull();
        expect(
            leerEstadoCacheDiaria(JSON.stringify({ version: 1, ultimoIntento: "2026-10-01", ultimoExito: "2026-10-01", consulta: null })),
        ).toBeNull();
    });
});
