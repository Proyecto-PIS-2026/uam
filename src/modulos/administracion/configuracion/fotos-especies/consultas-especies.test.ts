import { beforeEach, describe, expect, it, vi } from "vitest";
import obtenerEspecies from "./consultas-especies";

const mocks = vi.hoisted(() => ({
    query: vi.fn(),
    sql: vi.fn(),
    returnsRow: vi.fn(),
    build: vi.fn(),
    plan: { tipo: "consulta-especies" },
    columnas: {
        id: { nombre: "id" },
        nombreEspecie: { nombre: "nombreEspecie" },
        fotoEspecie: { nombre: "fotoEspecie" },
    },
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        runtime: () => ({ query: mocks.query }),
        sql: { public: { especie: { columns: mocks.columnas } } },
        raw: { sql: mocks.sql },
    },
}));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.sql.mockReturnValue({ returnsRow: mocks.returnsRow });
    mocks.returnsRow.mockReturnValue({ build: mocks.build });
    mocks.build.mockReturnValue(mocks.plan);
});

describe("obtenerEspecies", () => {
    it("devuelve las especies con su identificador, nombre y foto", async () => {
        const especies = [
            { id: 1, nombreEspecie: "Acelga", fotoEspecie: "/acelga.webp" },
            { id: 2, nombreEspecie: "Tomate", fotoEspecie: "/tomate.webp" },
        ];
        mocks.query.mockResolvedValue(especies);

        const resultado = await obtenerEspecies();

        expect(resultado).toEqual(especies);
        expect(mocks.query).toHaveBeenCalledExactlyOnceWith(mocks.plan);
    });

    it("conserva las especies que no tienen foto", async () => {
        mocks.query.mockResolvedValue([{ id: 1, nombreEspecie: "Ají", fotoEspecie: null }]);

        const resultado = await obtenerEspecies();

        expect(resultado).toEqual([{ id: 1, nombreEspecie: "Ají", fotoEspecie: null }]);
    });

    it("devuelve un arreglo vacío si no hay especies", async () => {
        mocks.query.mockResolvedValue([]);

        await expect(obtenerEspecies()).resolves.toEqual([]);
    });

    it("solicita ordenar las especies por nombre", async () => {
        mocks.query.mockResolvedValue([]);

        await obtenerEspecies();

        const partes = mocks.sql.mock.calls[0][0] as TemplateStringsArray;
        const consulta = partes.join("?").replace(/\s+/g, " ").trim();

        expect(consulta).toContain("FROM public.especie e");
        expect(consulta).toContain('ORDER BY e."nombreEspecie"');
    });

    it("declara las columnas necesarias para interpretar el resultado", async () => {
        mocks.query.mockResolvedValue([]);

        await obtenerEspecies();

        expect(mocks.returnsRow).toHaveBeenCalledExactlyOnceWith({
            id: mocks.columnas.id,
            nombreEspecie: mocks.columnas.nombreEspecie,
            fotoEspecie: mocks.columnas.fotoEspecie,
        });
        expect(mocks.build).toHaveBeenCalledOnce();
    });

    it("no expone campos adicionales del resultado", async () => {
        mocks.query.mockResolvedValue([{ id: 1, nombreEspecie: "Acelga", fotoEspecie: null, campoInterno: "interno" }]);

        const resultado = await obtenerEspecies();

        expect(resultado).toEqual([{ id: 1, nombreEspecie: "Acelga", fotoEspecie: null }]);
    });

    it("propaga los errores de consulta", async () => {
        const error = new Error("No se pudo consultar la base");
        mocks.query.mockRejectedValue(error);

        await expect(obtenerEspecies()).rejects.toBe(error);
    });
});