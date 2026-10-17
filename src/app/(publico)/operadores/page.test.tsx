// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OperadorListado } from "../../../modulos/usuarios/operadores/consultas-listado-publico";
import Page from "./page";

const {
    obtenerOperadoresMock,
    listadoOperadoresMock,
    obtenerSesionMock,
    redirectMock,
} = vi.hoisted(() => ({
    obtenerOperadoresMock: vi.fn(),
    listadoOperadoresMock: vi.fn(() => null),
    obtenerSesionMock: vi.fn(),
    redirectMock: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: obtenerSesionMock,
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/modulos/usuarios/operadores/consultas-listado-publico", () => ({
    obtenerOperadoresPublicos: obtenerOperadoresMock,
}));

vi.mock("@/modulos/usuarios/operadores/componentes/listado-operadores/ListadoOperadores", () => ({
    default: listadoOperadoresMock,
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
        obtenerSesionMock.mockResolvedValue(null);
    });

    it("redirige al operador a Mi Mercado sin consultar el listado público", async () => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });

        await expect(Page()).rejects.toThrow("NEXT_REDIRECT");

        expect(redirectMock).toHaveBeenCalledWith("/mi-mercado");
        expect(obtenerOperadoresMock).not.toHaveBeenCalled();
    });

    it.each([null, "ADMINISTRADOR", "PRODUCTOR"] as const)("adapta los enlaces del listado a la sesión %s", async (rol) => {
        obtenerSesionMock.mockResolvedValue(rol ? { usuarioId: 20, rol, expiraEn: 2000000000 } : null);
        obtenerOperadoresMock.mockResolvedValue(operadores);

        const contenido = await Page();

        expect(redirectMock).not.toHaveBeenCalled();
        expect(obtenerOperadoresMock).toHaveBeenCalledOnce();
        expect(contenido.props.children.props.children.props.operadores).toBe(operadores);
        expect(contenido.props.children.props.children.props.puedeGestionar).toBe(rol === "ADMINISTRADOR");
        expect(obtenerSesionMock).toHaveBeenCalledOnce();
    });

    it("consulta los operadores y los pasa al listado", async () => {
        obtenerOperadoresMock.mockResolvedValue(operadores);
        const contenido = await Page();
        const contenedorListado = contenido.props.children;
        const listado = contenedorListado.props.children;
        expect(obtenerOperadoresMock).toHaveBeenCalledOnce();
        expect(obtenerOperadoresMock).toHaveBeenCalledWith();
        expect(contenido.type).toBe("main");
        expect(listado.type).toBe(listadoOperadoresMock);
        expect(listado.props.operadores).toBe(operadores);
    });

    it("pasa un listado vacío cuando no hay operadores", async () => {
        obtenerOperadoresMock.mockResolvedValue([]);
        const contenido = await Page();
        const contenedorListado = contenido.props.children;
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
