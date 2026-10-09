// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { redirect } from "next/navigation";
import * as autorizacion from "../../../identidad-acceso/autorizacion/permisos";
import VistaMiMercado from "./VistaMiMercado";

const sesionMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: sesionMock }));

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    obtenerOperadorPorNombre: vi.fn(),
    obtenerPublicaciones: vi.fn(),
    obtenerOpcionesEdicion: vi.fn(),
    miMercado: vi.fn(() => null),
    notFound: vi.fn(() => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); }),
}));

vi.mock("../../../usuarios/operadores/operador-actual", () => ({
    obtenerOperadorActual: mocks.obtenerOperadorActual,
    obtenerOperadorPorNombre: mocks.obtenerOperadorPorNombre,
}));

vi.mock("../consultas-mi-mercado", () => ({
    obtenerPublicacionesDeOperador: mocks.obtenerPublicaciones,
}));

vi.mock("../../operadores/consultas-edicion-publicacion", () => ({
    obtenerOpcionesEdicionPublicacion: mocks.obtenerOpcionesEdicion,
}));

vi.mock("./MiMercado", () => ({ default: mocks.miMercado }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }) }));

const opcionesEdicion = {
    especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [],
};

describe("VistaMiMercado", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Operador 13" });
        mocks.obtenerPublicaciones.mockResolvedValue([]);
        mocks.obtenerOpcionesEdicion.mockResolvedValue(opcionesEdicion);
    });

    it("usa el operador actual cuando no llega un nombre", async () => {
        const vista = await VistaMiMercado({});

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorNombre).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(13);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(13);
        expect(vista.props.nombreOperador).toBe("Operador 13");
    });

    it("exige consultar publicaciones propias aunque se solicite abrir el alta", async () => {
        vi.spyOn(autorizacion, "autorizado").mockImplementation((...argumentos) => argumentos[0] !== "operador.publicacion.consultarPropias");

        await expect(VistaMiMercado({ abrirAltaInicial: true })).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
    });

    it("permite consultar sin permiso de alta, pero rechaza abrir el formulario", async () => {
        vi.spyOn(autorizacion, "autorizado").mockImplementation((...argumentos) => argumentos[0] !== "operador.publicacion.crear");

        const vista = await VistaMiMercado({});
        expect(vista.props.puedeCrear).toBe(false);
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledOnce();
        await expect(VistaMiMercado({ abrirAltaInicial: true })).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledOnce();
    });

    it("usa el operador indicado en la ruta", async () => {
        mocks.obtenerOperadorPorNombre.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Frutas & Más" });

        const vista = await VistaMiMercado({ operadorNombre: "Frutas & Más" });

        expect(mocks.obtenerOperadorPorNombre).toHaveBeenCalledExactlyOnceWith("Frutas & Más");
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(37);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(37);
        expect(vista.props.nombreOperador).toBe("Frutas & Más");
    });

    it("responde 404 si el operador indicado no existe", async () => {
        mocks.obtenerOperadorPorNombre.mockResolvedValue(null);

        await expect(VistaMiMercado({ operadorNombre: "No existe" })).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
        expect(mocks.obtenerOperadorPorNombre).toHaveBeenCalledExactlyOnceWith("No existe");
        expect(mocks.notFound).toHaveBeenCalledOnce();
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerOpcionesEdicion).not.toHaveBeenCalled();
    });
});

describe("propiedad de Mi Mercado", () => {
    it("no carga datos cuando la URL corresponde a otro operador", async () => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorPorNombre.mockResolvedValue({ id: 37, usuarioId: 70, nombreFantasia: "Ajeno" });
        await expect(VistaMiMercado({ operadorNombre: "Ajeno" })).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledWith("/inicio");
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerOpcionesEdicion).not.toHaveBeenCalled();
    });
});
