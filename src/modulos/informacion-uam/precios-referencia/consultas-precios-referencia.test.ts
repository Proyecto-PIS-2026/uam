import { beforeEach, describe, expect, it, vi } from "vitest";
import { relevamiento } from "../../../../tests/fixtures/precios-referencia.mjs";
import { obtenerConsultaPreciosReferencia, obtenerPreciosReferencia } from "./consultas-precios-referencia";

const { obtenerRemoto } = vi.hoisted(() => ({ obtenerRemoto: vi.fn() }));

vi.mock("./cache-diario", () => ({ obtenerConsultaDiariaWebservice: obtenerRemoto }));

beforeEach(() => {
    obtenerRemoto.mockReset().mockResolvedValue(relevamiento);
});

describe("consulta de precios de referencia", () => {
    it("obtiene los precios exclusivamente del servicio con caché en base de datos", async () => {
        await expect(obtenerConsultaPreciosReferencia()).resolves.toEqual(relevamiento);
        expect(obtenerRemoto).toHaveBeenCalledOnce();
    });

    it("propaga la falta de precios disponibles sin generar datos de ejemplo", async () => {
        obtenerRemoto.mockRejectedValue(new Error("No hay relevamientos disponibles"));

        await expect(obtenerConsultaPreciosReferencia()).rejects.toThrow("No hay relevamientos disponibles");
    });

    it("incluye todas las bandas y conserva la marca de referencia", async () => {
        const resultado = await obtenerPreciosReferencia();

        expect(resultado.fechaRelevamiento).toBe("2026-08-27");
        expect(resultado.filas).toHaveLength(89);
        expect(resultado.filas.filter((fila) => fila.esReferencia)).toHaveLength(44);
        expect(new Set(resultado.filas.map((fila) => fila.id)).size).toBe(89);
    });

    it("conserva los campos y los valores decimales originales", async () => {
        const resultado = await obtenerPreciosReferencia();
        const acelga = resultado.filas.find(
            (fila) => fila.especie === "Acelga" && fila.variedad === "-" && fila.calibre === "M" && fila.categoria === "I",
        );

        expect(acelga).toMatchObject({
            pais: "URUGUAY",
            unidad: "DOC",
            precioMinimoUnidad: 250,
            precioMaximoUnidad: 300,
            precioMinimoKg: 16.666666666666668,
            precioMaximoKg: 20,
            esReferencia: true,
        });
    });
});
