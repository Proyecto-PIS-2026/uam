// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperadorListado } from "../../../modulos/usuarios/operadores/consultas-listado-publico";
import Page from "./page";

const {
    obtenerOperadoresMock,
    listadoOperadoresMock,
    hojasDecorativasMock,
} = vi.hoisted(() => ({
    obtenerOperadoresMock: vi.fn(),
    listadoOperadoresMock: vi.fn(() => null),
    hojasDecorativasMock: vi.fn(() => null),
}));

vi.mock("@/modulos/usuarios/operadores/consultas-listado-publico", () => ({
    obtenerOperadoresPublicos: obtenerOperadoresMock,
}));

vi.mock("@/modulos/usuarios/operadores/componentes/listado-operadores/ListadoOperadores", () => ({
    default: listadoOperadoresMock,
}));

vi.mock("@/compartido/HojasDecorativas", () => ({
    default: hojasDecorativasMock,
}));

const operadores: OperadorListado[] = [
    {
        id: 1,
        nombreFantasia: "Frutas del Norte",
        fotoPerfil: null,
        cantidadProductos: 3,
        locales: [{ numeroLocal: "18", nombreNave: "B" }],
    },
    {
        id: 2,
        nombreFantasia: "Huerta Central",
        fotoPerfil: "/operadores/2.webp",
        cantidadProductos: 5,
        locales: [{ numeroLocal: "25", nombreNave: "A" }],
    },
];

describe("Página de operadores", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        obtenerOperadoresMock.mockReset();
    });

    it("consulta los operadores y los pasa al listado", async () => {
        obtenerOperadoresMock.mockResolvedValue(operadores);
        const contenido = await Page();
        const [, contenedorListado] = contenido.props.children;
        const listado = contenedorListado.props.children;
        expect(obtenerOperadoresMock).toHaveBeenCalledOnce();
        expect(obtenerOperadoresMock).toHaveBeenCalledWith();
        expect(contenido.type).toBe("main");
        expect(listado.type).toBe(listadoOperadoresMock);
        expect(listado.props.operadores).toBe(operadores);
    });

    it("incluye las hojas decorativas de fondo", async () => {
        obtenerOperadoresMock.mockResolvedValue(operadores);
        const contenido = await Page();
        const [hojas] = contenido.props.children;
        expect(hojas.type).toBe(hojasDecorativasMock);
        expect(hojas.props.variante).toBe("fondo");
    });

    it("pasa un listado vacío cuando no hay operadores", async () => {
        obtenerOperadoresMock.mockResolvedValue([]);
        const contenido = await Page();
        const [, contenedorListado] = contenido.props.children;
        const listado = contenedorListado.props.children;
        expect(listado.type).toBe(listadoOperadoresMock);
        expect(listado.props.operadores).toEqual([]);
    });

    it("propaga el error cuando falla la consulta", async () => {
        const error = new Error("No se pudieron obtener los operadores");
        obtenerOperadoresMock.mockRejectedValue(error);
        await expect(Page()).rejects.toBe(error);
        expect(obtenerOperadoresMock).toHaveBeenCalledOnce();
    });
});