import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "../../identidad-acceso/autenticacion/sesiones";
import type { ResultadoPublicacionesProductores } from "./PublicacionesProductor";
import { redirect } from "next/navigation";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { RUTA_INICIO_SESION } from "@/modulos/identidad-acceso/autenticacion/rutas-sesion";

const mocks = vi.hoisted(() => ({
    consultarPublicacionesProductores: vi.fn(),
    exigirConsultaMercadoOperador: vi.fn(),
    cerrarSesion: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: vi.fn(),
    cerrarSesion: mocks.cerrarSesion,
}));

vi.mock("./PublicacionesProductor", () => ({
    consultarPublicacionesProductores: mocks.consultarPublicacionesProductores,
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modulos/identidad-acceso/autorizacion/controles")>()),
    exigirConsultaMercadoOperador: mocks.exigirConsultaMercadoOperador,
}));

vi.mock("next/navigation", () => ({
    redirect: vi.fn(() => { throw new Error("NEXT_REDIRECT"); }),
}));

import obtenerPublicaciones from "./ConsultarPublicacionProductor.action";

describe("obtenerPublicaciones", () => {
    const sesion = {
        usuarioId: 42,
        rol: "OPERADOR",
    } as DatosSesion;

    const resultado: ResultadoPublicacionesProductores = {
        publicaciones: [
            {
                id: 101,
                precio: 125.5,
                fecha: "2026-10-16T12:00:00.000Z",
                foto: "/publicaciones/manzana.jpg",
                especie: "Manzana",
                variedad: "Red Delicious",
                presentacion: "Cajón",
                cantidadUnidades: 20,
                categoria: "I",
                calibre: "Grande",
                codigoCalibre: "G",
                pais: "Uruguay",
                tipoPublicacion: "PRODUCTOR" as const,
                productor: {
                    id: 7,
                    nombreFantasia: "Productor de prueba",
                    fotoPerfil: null,
                    whatsApp: "+59899123456",
                },
                ubicaciones: [
                    {
                        id: 3,
                        nombreUbicacion: "Mercado Modelo",
                        urlMaps: "https://maps.example/ubicacion",
                    },
                ],
            },
        ],
    };

    beforeEach(() => {
        vi.resetAllMocks();
        mocks.exigirConsultaMercadoOperador.mockResolvedValue(undefined);
        mocks.consultarPublicacionesProductores.mockResolvedValue(resultado);
    });

    it("exige acceso al mercado del operador antes de consultar las publicaciones", async () => {
        await obtenerPublicaciones(sesion);

        expect(mocks.exigirConsultaMercadoOperador).toHaveBeenCalledTimes(1);
        expect(mocks.exigirConsultaMercadoOperador).toHaveBeenCalledWith();
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledTimes(1);
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledWith(sesion);
        expect(mocks.exigirConsultaMercadoOperador.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.consultarPublicacionesProductores.mock.invocationCallOrder[0],
        );
    });

    it("devuelve el resultado de la consulta sin modificarlo", async () => {
        const respuesta = await obtenerPublicaciones(sesion);

        expect(respuesta).toBe(resultado);
        expect(respuesta?.publicaciones).toHaveLength(1);
        expect(respuesta?.publicaciones[0].productor.nombreFantasia).toBe("Productor de prueba");
        expect(respuesta?.publicaciones[0].ubicaciones).toHaveLength(1);
    });

    it("devuelve correctamente un resultado vacío", async () => {
        const resultadoVacio: ResultadoPublicacionesProductores = { publicaciones: [] };
        mocks.consultarPublicacionesProductores.mockResolvedValue(resultadoVacio);

        await expect(obtenerPublicaciones(sesion)).resolves.toBe(resultadoVacio);
        expect(mocks.exigirConsultaMercadoOperador).toHaveBeenCalledTimes(1);
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledWith(sesion);
    });

    it("reenvía una sesión nula a la consulta después de exigir acceso", async () => {
        await expect(obtenerPublicaciones(null)).resolves.toBe(resultado);

        expect(mocks.exigirConsultaMercadoOperador).toHaveBeenCalledTimes(1);
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledWith(null);
    });

    it("propaga el error de exigir acceso y no consulta las publicaciones", async () => {
        const error = new Error("Acceso al mercado denegado");
        mocks.exigirConsultaMercadoOperador.mockRejectedValue(error);

        await expect(obtenerPublicaciones(sesion)).rejects.toBe(error);

        expect(mocks.exigirConsultaMercadoOperador).toHaveBeenCalledTimes(1);
        expect(mocks.consultarPublicacionesProductores).not.toHaveBeenCalled();
    });

    it("propaga los errores de la consulta después de exigir acceso", async () => {
        const error = new Error("Error al consultar publicaciones");
        mocks.consultarPublicacionesProductores.mockRejectedValue(error);

        await expect(obtenerPublicaciones(sesion)).rejects.toBe(error);

        expect(mocks.exigirConsultaMercadoOperador).toHaveBeenCalledTimes(1);
        expect(mocks.consultarPublicacionesProductores).toHaveBeenCalledWith(sesion);
    });

    it("redirige si la sesión dejó de ser válida sin consultar publicaciones", async () => {
        mocks.exigirConsultaMercadoOperador.mockRejectedValue(new ErrorAutorizacion(401, "Iniciá sesión."));

        await expect(obtenerPublicaciones(sesion)).rejects.toThrow("NEXT_REDIRECT");
        expect(redirect).toHaveBeenCalledExactlyOnceWith(RUTA_INICIO_SESION);
        expect(mocks.cerrarSesion).toHaveBeenCalledExactlyOnceWith();
        expect(mocks.consultarPublicacionesProductores).not.toHaveBeenCalled();
    });

    it("conserva el rechazo por permisos sin cerrar una sesión válida", async () => {
        const error = new ErrorAutorizacion(403, "Acceso al mercado denegado");
        mocks.exigirConsultaMercadoOperador.mockRejectedValue(error);

        await expect(obtenerPublicaciones(sesion)).rejects.toBe(error);
        expect(redirect).not.toHaveBeenCalled();
        expect(mocks.consultarPublicacionesProductores).not.toHaveBeenCalled();
    });
});
