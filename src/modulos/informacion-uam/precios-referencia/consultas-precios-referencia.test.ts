import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import consultaLocal from "./consulta-referencia.json";
import { obtenerConsultaPreciosReferencia, obtenerPreciosReferencia } from "./consultas-precios-referencia";

const { obtenerRemoto } = vi.hoisted(() => ({ obtenerRemoto: vi.fn() }));

vi.mock("./cache-diario", () => ({ obtenerConsultaDiariaWebservice: obtenerRemoto }));

beforeEach(() => vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "local"));
afterEach(() => {
    vi.unstubAllEnvs();
    obtenerRemoto.mockReset();
});

describe("selección de la fuente de precios de referencia", () => {
    it("usa el relevamiento local mientras no se active el webservice", async () => {
        vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "local");

        await expect(obtenerConsultaPreciosReferencia()).resolves.toEqual(consultaLocal);
        expect(obtenerRemoto).not.toHaveBeenCalled();
    });

    it("usa la caché del webservice cuando se activa explícitamente", async () => {
        vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "webservice");
        obtenerRemoto.mockResolvedValue(consultaLocal);

        await expect(obtenerConsultaPreciosReferencia()).resolves.toEqual(consultaLocal);
        expect(obtenerRemoto).toHaveBeenCalledOnce();
    });

    it("usa el TXT si la variable del despliegue queda vacia", async () => {
        vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "");

        await expect(obtenerConsultaPreciosReferencia()).resolves.toEqual(consultaLocal);
        expect(obtenerRemoto).not.toHaveBeenCalled();
    });

    it("rechaza un valor de fuente desconocido", async () => {
        vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "otra");

        await expect(obtenerConsultaPreciosReferencia()).rejects.toThrow("debe ser local o webservice");
        expect(obtenerRemoto).not.toHaveBeenCalled();
    });
});

describe("precios de referencia desde la consulta local", () => {
    it("incluye todas las bandas y conserva la marca de referencia", async () => {
        const resultado = await obtenerPreciosReferencia();

        expect(resultado.fechaRelevamiento).toBe("2026-08-27");
        expect(resultado.filas).toHaveLength(363);
        expect(resultado.filas.filter((fila) => fila.esReferencia)).toHaveLength(67);
        expect(new Set(resultado.filas.map((fila) => fila.id)).size).toBe(363);
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
