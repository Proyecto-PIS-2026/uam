import { describe, expect, it, vi } from "vitest";
import { relevamiento } from "../../../../tests/fixtures/precios-referencia.mjs";
import type { ConsultaPreciosReferencia } from "./consultas-precios-referencia";
import { leerEstadoCacheDiaria, resolverCacheDiaria, type EstadoCacheDiaria } from "./politica-cache-diaria";
import { validarConsultaPreciosReferencia } from "./validar-consulta-webservice";

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
    return { version: 1, ultimoIntento: fecha, intentosDelDia: 1, ultimoIntentoExitoso: true, ultimoExito: fecha, consulta: dato };
}

describe("resolverCacheDiaria", () => {
    it("consulta y guarda el primer relevamiento", async () => {
        const dato = consulta("2026-10-01");
        const consultar = vi.fn().mockResolvedValue(dato);
        const resultado = await resolverCacheDiaria(null, "2026-10-01", consultar);

        expect(consultar).toHaveBeenCalledOnce();
        expect(resultado).toEqual({ consulta: dato, nuevoEstado: estadoDe("2026-10-01", dato) });
    });

    it("guarda como exitoso un relevamiento con rangos invertidos y lo reutiliza sin consumir más intentos", async () => {
        const recibido = consulta("2026-11-19");
        Object.assign(recibido.types[0].products[0].varieties[0].presentations[0].prices[0], {
            min_kg: 1600, max_kg: 200, min_un: 80, max_un: 10,
        });
        const consultar = vi.fn(async () => validarConsultaPreciosReferencia(recibido));

        const resultado = await resolverCacheDiaria(null, "2026-11-20", consultar);
        const guardado = leerEstadoCacheDiaria(JSON.stringify(resultado.nuevoEstado));

        expect(guardado).toEqual(estadoDe("2026-11-20", recibido));
        expect(await resolverCacheDiaria(guardado, "2026-11-20", consultar)).toEqual({ consulta: recibido, nuevoEstado: null });
        expect(consultar).toHaveBeenCalledOnce();
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

    it("conserva el último relevamiento y permite reintentar tras un fallo", async () => {
        const anterior = consulta("2026-10-01");
        const consultar = vi.fn().mockRejectedValue(new Error("Servicio no disponible"));
        const primero = await resolverCacheDiaria(estadoDe("2026-10-01", anterior), "2026-10-02", consultar);
        const segundo = await resolverCacheDiaria(primero.nuevoEstado, "2026-10-02", consultar);

        expect(consultar).toHaveBeenCalledTimes(2);
        expect(primero).toEqual({
            consulta: anterior,
            nuevoEstado: { version: 1, ultimoIntento: "2026-10-02", intentosDelDia: 1, ultimoIntentoExitoso: false, ultimoExito: "2026-10-01", consulta: anterior },
        });
        expect(segundo).toEqual({ consulta: anterior, nuevoEstado: { ...primero.nuevoEstado, intentosDelDia: 2 } });
    });

    it("limita a cinco intentos totales por día aunque no haya datos previos", async () => {
        const consultar = vi.fn().mockRejectedValue(new Error("Servicio no disponible"));
        let estado: EstadoCacheDiaria | null = null;
        for (let intento = 1; intento <= 5; intento++) {
            const resultado = await resolverCacheDiaria(estado, "2026-10-01", consultar);
            expect(resultado.consulta).toBeNull();
            expect(resultado.nuevoEstado?.intentosDelDia).toBe(intento);
            estado = leerEstadoCacheDiaria(JSON.stringify(resultado.nuevoEstado));
        }

        expect(await resolverCacheDiaria(estado, "2026-10-01", consultar)).toEqual({ consulta: null, nuevoEstado: null });
        expect(consultar).toHaveBeenCalledTimes(5);

        const siguienteDia = await resolverCacheDiaria(estado, "2026-10-02", consultar);
        expect(siguienteDia.nuevoEstado).toMatchObject({ ultimoIntento: "2026-10-02", intentosDelDia: 1, ultimoIntentoExitoso: false });
        expect(consultar).toHaveBeenCalledTimes(6);
    });

    it("deja de reintentar al primer éxito y conserva el número de intentos", async () => {
        const dato = consulta("2026-10-02");
        const consultar = vi.fn().mockRejectedValueOnce(new Error("Servicio no disponible")).mockResolvedValue(dato);
        const fallo = await resolverCacheDiaria(null, "2026-10-02", consultar);
        const exito = await resolverCacheDiaria(fallo.nuevoEstado, "2026-10-02", consultar);

        expect(exito.nuevoEstado).toEqual({ ...estadoDe("2026-10-02", dato), intentosDelDia: 2 });
        expect(await resolverCacheDiaria(exito.nuevoEstado, "2026-10-02", consultar)).toEqual({ consulta: dato, nuevoEstado: null });
        expect(consultar).toHaveBeenCalledTimes(2);
    });

    it("un respaldo actualizado hoy no convierte en exitoso el intento de la fuente actual", async () => {
        const dato = consulta("2026-10-02");
        const respaldo: EstadoCacheDiaria = { ...estadoDe("2026-10-02", dato), intentosDelDia: 4, ultimoIntentoExitoso: false };
        const consultar = vi.fn().mockRejectedValue(new Error("Servicio no disponible"));
        const resultado = await resolverCacheDiaria(respaldo, "2026-10-02", consultar);

        expect(consultar).toHaveBeenCalledOnce();
        expect(resultado.nuevoEstado).toEqual({ ...respaldo, intentosDelDia: 5 });
        expect(await resolverCacheDiaria(resultado.nuevoEstado, "2026-10-02", consultar)).toEqual({ consulta: dato, nuevoEstado: null });
        expect(consultar).toHaveBeenCalledOnce();
    });
});

describe("leerEstadoCacheDiaria", () => {
    it("recupera un estado válido serializado", () => {
        const estado = estadoDe("2026-10-01", consulta("2026-10-01"));
        expect(leerEstadoCacheDiaria(JSON.stringify(estado))).toEqual(estado);
    });

    it("reconoce un relevamiento guardado antes de agregar el contador de intentos", () => {
        const estado = { version: 1, ultimoIntento: "2026-10-01", ultimoExito: "2026-10-01", consulta: relevamiento };

        expect(leerEstadoCacheDiaria(JSON.stringify(estado))).toEqual({ ...estado, intentosDelDia: 1, ultimoIntentoExitoso: true });
    });

    it("cuenta un fallo de la caché anterior como primer intento del día", () => {
        const estado = { version: 1, ultimoIntento: "2026-10-01", ultimoExito: null, consulta: null };
        expect(leerEstadoCacheDiaria(JSON.stringify(estado))).toEqual({ ...estado, intentosDelDia: 1, ultimoIntentoExitoso: false });
    });

    it.each([-1, 1.5, "2", null])("descarta un contador de intentos inválido %s", (intentosDelDia) => {
        const estado = { ...estadoDe("2026-10-01", consulta("2026-10-01")), intentosDelDia };
        expect(leerEstadoCacheDiaria(JSON.stringify(estado))).toBeNull();
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
                    consulta: { survey_date: "2026-10-01", types: null },
                }),
            ),
        ).toBeNull();
        expect(
            leerEstadoCacheDiaria(JSON.stringify({ version: 1, ultimoIntento: "2026-10-01", ultimoExito: "2026-10-01", consulta: null })),
        ).toBeNull();
    });
});
