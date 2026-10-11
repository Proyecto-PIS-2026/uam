// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import * as autorizacion from "../../../identidad-acceso/autorizacion/permisos";
import VistaMiMercado from "./VistaMiMercado";

const mocks = vi.hoisted(() => ({
    obtenerOperadorActual: vi.fn(),
    obtenerOperadorPorNombre: vi.fn(),
    obtenerPublicaciones: vi.fn(),
    obtenerOpcionesEdicion: vi.fn(),
    obtenerConfiguracion: vi.fn(),
    miMercado: vi.fn(() => null),
    notFound: vi.fn(() => { throw new Error("NEXT_HTTP_ERROR_FALLBACK;404"); }),
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
    obtenerSesion: vi.fn(),
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

vi.mock("@/modulos/administracion/ConsultaConfiguracion", () => ({
    obtenerConfiguracion: mocks.obtenerConfiguracion,
}));

vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));

const opcionesEdicion = {
    especies: [],
    variedades: [],
    presentaciones: [],
    categorias: [],
    calibres: [],
    paises: [],
};

describe("VistaMiMercado", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 });
        mocks.obtenerOperadorActual.mockResolvedValue({ id: 13, usuarioId: 10, nombreFantasia: "Operador 13" });
        mocks.obtenerPublicaciones.mockResolvedValue([]);
        mocks.obtenerOpcionesEdicion.mockResolvedValue(opcionesEdicion);
        mocks.obtenerConfiguracion.mockResolvedValue("25");
    });

    it("usa el operador actual cuando no llega un nombre", async () => {
        const vista = await VistaMiMercado({});

        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorNombre).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(13);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(13);
        expect(vista.props.nombreOperador).toBe("Operador 13");
        expect(vista.props.incrementoPrecio).toBe(25);
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

    it("usa el operador propio indicado en la ruta", async () => {
        mocks.obtenerOperadorPorNombre.mockResolvedValue({ id: 37, usuarioId: 10, nombreFantasia: "Frutas & Más" });

        const vista = await VistaMiMercado({ operadorNombre: "Frutas & Más" });

        expect(mocks.obtenerOperadorPorNombre).toHaveBeenCalledExactlyOnceWith("Frutas & Más");
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledExactlyOnceWith(37);
        expect(vista.type).toBe(mocks.miMercado);
        expect(vista.props.operadorId).toBe(37);
        expect(vista.props.nombreOperador).toBe("Frutas & Más");
        expect(vista.props.incrementoPrecio).toBe(25);
    });

    it("no carga publicaciones cuando el nombre corresponde a otro operador", async () => {
        mocks.obtenerOperadorPorNombre.mockResolvedValue({ id: 37, usuarioId: 11, nombreFantasia: "Ajeno" });
        await expect(VistaMiMercado({ operadorNombre: "Ajeno" })).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledWith("/mi-mercado");
        expect(mocks.obtenerPublicaciones).not.toHaveBeenCalled();
        expect(mocks.obtenerOpcionesEdicion).not.toHaveBeenCalled();
    });

    it("redirige al login sin consultar operadores cuando no hay sesión", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);
        await expect(VistaMiMercado({ abrirAltaInicial: true })).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.redirect).toHaveBeenCalledWith("/iniciar-sesion");
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.obtenerOperadorPorNombre).not.toHaveBeenCalled();
    });

    it.each(["modificar", "eliminar"] as const)("propaga la denegación de %s sin impedir la consulta", async (accion) => {
        vi.spyOn(autorizacion, "autorizado").mockImplementation((...argumentos) => argumentos[0] !== `operador.publicacion.${accion}`);

        const vista = await VistaMiMercado({});

        expect(vista.props.puedeModificar).toBe(accion !== "modificar");
        expect(vista.props.puedeEliminar).toBe(accion !== "eliminar");
        expect(mocks.obtenerPublicaciones).toHaveBeenCalledOnce();
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