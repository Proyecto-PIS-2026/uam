
import { beforeEach, describe, expect, it, vi } from "vitest";

import obtenerConfiguraciones, {
    obtenerConfiguracion,
    actualizarConfiguracion,
    obtenerEstadisticas,
} from "./ConsultaConfiguracion";

const mocks = vi.hoisted(() => ({
    select: vi.fn(),
    where: vi.fn(),
    all: vi.fn(),
    first: vi.fn(),
    update: vi.fn(),
    visitasAll: vi.fn(),
    contactosAll: vi.fn(),
    publicacionesAll: vi.fn(),
}));

vi.mock("../../infraestructura/persistencia/prisma/db", () => {
    const consulta = {
        select: mocks.select,
        where: mocks.where,
        all: mocks.all,
        first: mocks.first,
        update: mocks.update,
    };

    return {
        db: {
            orm: {
                public: {
                    Configuracion: consulta,
                    EstadisticaVisita: {
                        all: mocks.visitasAll,
                    },
                    EstadisticaContacto: {
                        all: mocks.contactosAll,
                    },
                    EstadisticaPublicacion: {
                        all: mocks.publicacionesAll,
                    },
                },
            },
        },
    };
});

describe("ConsultaConfiguracion", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        const consulta = {
            select: mocks.select,
            where: mocks.where,
            all: mocks.all,
            first: mocks.first,
            update: mocks.update,
        };

        mocks.select.mockReturnValue(consulta);
        mocks.where.mockReturnValue(consulta);

        mocks.visitasAll.mockResolvedValue([]);
        mocks.contactosAll.mockResolvedValue([]);
        mocks.publicacionesAll.mockResolvedValue([]);
    });

    describe("obtenerConfiguraciones", () => {
        it("consulta únicamente las configuraciones solicitadas", async () => {
            const configuraciones = [
                {
                    nombreConfiguracion: "url_lista_inteligente",
                    valorConfiguracion: "https://uam.com.uy/lista.pdf",
                },
                {
                    nombreConfiguracion: "incremento_precio",
                    valorConfiguracion: "10",
                },
            ];

            const nombres = [
                "url_lista_inteligente",
                "incremento_precio",
            ];

            mocks.all.mockResolvedValue(configuraciones);

            const resultado = await obtenerConfiguraciones(nombres);

            expect(mocks.where).toHaveBeenCalledOnce();

            const construirCondicion = mocks.where.mock.calls[0][0] as (
                configuracion: {
                    nombreConfiguracion: {
                        in: (valores: string[]) => unknown;
                    };
                },
            ) => unknown;

            const incluir = vi.fn();

            construirCondicion({
                nombreConfiguracion: {
                    in: incluir,
                },
            });

            expect(incluir).toHaveBeenCalledExactlyOnceWith(nombres);

            expect(mocks.select).toHaveBeenCalledExactlyOnceWith(
                "nombreConfiguracion",
                "valorConfiguracion",
            );

            expect(mocks.all).toHaveBeenCalledOnce();
            expect(resultado).toEqual(configuraciones);
        });

        it("devuelve un arreglo vacío cuando no existen configuraciones", async () => {
            mocks.all.mockResolvedValue([]);

            const resultado = await obtenerConfiguraciones([
                "incremento_precio",
            ]);

            expect(resultado).toEqual([]);
            expect(mocks.where).toHaveBeenCalledOnce();
            expect(mocks.all).toHaveBeenCalledOnce();
        });

        it("no consulta la tabla cuando no se solicita ninguna configuración", async () => {
            const resultado = await obtenerConfiguraciones([]);

            expect(resultado).toEqual([]);

            expect(mocks.where).not.toHaveBeenCalled();
            expect(mocks.select).not.toHaveBeenCalled();
            expect(mocks.all).not.toHaveBeenCalled();
        });

        it("propaga el error cuando falla la consulta", async () => {
            mocks.all.mockRejectedValue(
                new Error("Error al consultar configuraciones"),
            );

            await expect(
                obtenerConfiguraciones(["incremento_precio"]),
            ).rejects.toThrow("Error al consultar configuraciones");
        });
    });

    describe("obtenerConfiguracion", () => {
        it("obtiene el valor de una configuración existente", async () => {
            mocks.first.mockResolvedValue({
                valorConfiguracion: "25",
            });

            const resultado = await obtenerConfiguracion(
                "incremento_precio",
            );

            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({
                nombreConfiguracion: "incremento_precio",
            });

            expect(mocks.select).toHaveBeenCalledExactlyOnceWith(
                "valorConfiguracion",
            );

            expect(mocks.first).toHaveBeenCalledOnce();
            expect(resultado).toBe("25");
        });

        it("devuelve null cuando la configuración no existe", async () => {
            mocks.first.mockResolvedValue(null);

            const resultado = await obtenerConfiguracion(
                "configuracion_inexistente",
            );

            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({
                nombreConfiguracion: "configuracion_inexistente",
            });

            expect(resultado).toBeNull();
        });

        it("devuelve null cuando el resultado es undefined", async () => {
            mocks.first.mockResolvedValue(undefined);

            const resultado = await obtenerConfiguracion(
                "incremento_precio",
            );

            expect(resultado).toBeNull();
        });

        it("devuelve null cuando el valor de la configuración es null", async () => {
            mocks.first.mockResolvedValue({
                valorConfiguracion: null,
            });

            const resultado = await obtenerConfiguracion(
                "incremento_precio",
            );

            expect(resultado).toBeNull();
        });

        it("conserva un valor vacío en lugar de reemplazarlo por null", async () => {
            mocks.first.mockResolvedValue({
                valorConfiguracion: "",
            });

            const resultado = await obtenerConfiguracion(
                "incremento_precio",
            );

            expect(resultado).toBe("");
        });

        it("propaga el error cuando falla la consulta", async () => {
            mocks.first.mockRejectedValue(
                new Error("Error al obtener configuración"),
            );

            await expect(
                obtenerConfiguracion("incremento_precio"),
            ).rejects.toThrow("Error al obtener configuración");
        });
    });

    describe("actualizarConfiguracion", () => {
        it("actualiza correctamente una configuración existente", async () => {
            mocks.update.mockResolvedValue({
                valorConfiguracion: "25",
            });

            const resultado = await actualizarConfiguracion(
                "incremento_precio",
                "25",
            );

            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({
                nombreConfiguracion: "incremento_precio",
            });

            expect(mocks.select).toHaveBeenCalledExactlyOnceWith(
                "valorConfiguracion",
            );

            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                valorConfiguracion: "25",
            });

            expect(resultado).toBe("25");
        });

        it("permite actualizar la URL de la Lista Inteligente", async () => {
            const nuevaUrl = "https://uam.com.uy/nueva-lista.pdf";

            mocks.update.mockResolvedValue({
                valorConfiguracion: nuevaUrl,
            });

            const resultado = await actualizarConfiguracion(
                "url_lista_inteligente",
                nuevaUrl,
            );

            expect(mocks.where).toHaveBeenCalledExactlyOnceWith({
                nombreConfiguracion: "url_lista_inteligente",
            });

            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                valorConfiguracion: nuevaUrl,
            });

            expect(resultado).toBe(nuevaUrl);
        });

        it("permite restablecer una configuración a su valor por defecto", async () => {
            mocks.update.mockResolvedValue({
                valorConfiguracion: "10",
            });

            const resultado = await actualizarConfiguracion(
                "incremento_precio",
                "10",
            );

            expect(mocks.update).toHaveBeenCalledExactlyOnceWith({
                valorConfiguracion: "10",
            });

            expect(resultado).toBe("10");
        });

        it("lanza un error cuando la configuración no existe", async () => {
            mocks.update.mockResolvedValue(null);

            await expect(
                actualizarConfiguracion(
                    "configuracion_inexistente",
                    "25",
                ),
            ).rejects.toThrow(
                "No existe la configuración configuracion_inexistente.",
            );
        });

        it("lanza un error cuando la actualización no devuelve un resultado", async () => {
            mocks.update.mockResolvedValue(undefined);

            await expect(
                actualizarConfiguracion("incremento_precio", "25"),
            ).rejects.toThrow(
                "No existe la configuración incremento_precio.",
            );
        });

        it("propaga el error cuando falla la actualización", async () => {
            mocks.update.mockRejectedValue(
                new Error("Error de base de datos"),
            );

            await expect(
                actualizarConfiguracion("incremento_precio", "25"),
            ).rejects.toThrow("Error de base de datos");
        });
    });

    describe("obtenerEstadisticas", () => {
        it("obtiene las tres estadísticas y convierte sus fechas a fechas locales", async () => {
            const visitas = [
                {
                    id: 1,
                    fecha: new Date("2026-10-01T12:00:00.000Z"),
                    cantidad: 15,
                    tipoVisitante: "comprador",
                },
                {
                    id: 2,
                    fecha: new Date("2026-10-02T12:00:00.000Z"),
                    cantidad: 8,
                    tipoVisitante: "operador",
                },
            ];

            const contactos = [
                {
                    id: 3,
                    fecha: new Date("2026-10-01T12:00:00.000Z"),
                    cantidad: 5,
                    username: "productor1",
                },
            ];

            const publicaciones = [
                {
                    id: 4,
                    fecha: new Date("2026-10-03T12:00:00.000Z"),
                    cantidad: 3,
                    username: "productor1",
                },
            ];

            mocks.visitasAll.mockResolvedValue(visitas);
            mocks.contactosAll.mockResolvedValue(contactos);
            mocks.publicacionesAll.mockResolvedValue(publicaciones);

            const resultado = await obtenerEstadisticas();

            expect(mocks.visitasAll).toHaveBeenCalledOnce();
            expect(mocks.contactosAll).toHaveBeenCalledOnce();
            expect(mocks.publicacionesAll).toHaveBeenCalledOnce();

            expect(resultado.visitas).toHaveLength(2);
            expect(resultado.contactos).toHaveLength(1);
            expect(resultado.publicaciones).toHaveLength(1);

            expect(resultado.visitas[0]).toMatchObject({
                id: 1,
                cantidad: 15,
                tipoVisitante: "comprador",
            });

            expect(resultado.contactos[0]).toMatchObject({
                id: 3,
                cantidad: 5,
                username: "productor1",
            });

            expect(resultado.publicaciones[0]).toMatchObject({
                id: 4,
                cantidad: 3,
                username: "productor1",
            });

            expect(resultado.visitas[0].fecha).toEqual(
                new Date(2026, 9, 1),
            );

            expect(resultado.visitas[1].fecha).toEqual(
                new Date(2026, 9, 2),
            );

            expect(resultado.contactos[0].fecha).toEqual(
                new Date(2026, 9, 1),
            );

            expect(resultado.publicaciones[0].fecha).toEqual(
                new Date(2026, 9, 3),
            );

            for (const estadistica of [
                ...resultado.visitas,
                ...resultado.contactos,
                ...resultado.publicaciones,
            ]) {
                expect(estadistica.fecha).toBeInstanceOf(Date);
                expect(estadistica.fecha.getHours()).toBe(0);
                expect(estadistica.fecha.getMinutes()).toBe(0);
                expect(estadistica.fecha.getSeconds()).toBe(0);
            }
        });

        it("devuelve arreglos vacíos cuando no existen estadísticas", async () => {
            const resultado = await obtenerEstadisticas();

            expect(resultado).toEqual({
                visitas: [],
                contactos: [],
                publicaciones: [],
            });

            expect(mocks.visitasAll).toHaveBeenCalledOnce();
            expect(mocks.contactosAll).toHaveBeenCalledOnce();
            expect(mocks.publicacionesAll).toHaveBeenCalledOnce();
        });

        it("conserva los campos originales de cada estadística", async () => {
            mocks.visitasAll.mockResolvedValue([
                {
                    fecha: new Date("2026-10-01T12:00:00.000Z"),
                    cantidad: 12,
                    tipoVisitante: "comprador",
                    id: 1,
                },
            ]);

            mocks.contactosAll.mockResolvedValue([
                {
                    fecha: new Date("2026-10-02T12:00:00.000Z"),
                    cantidad: 7,
                    username: "usuario1",
                    id: 2,
                },
            ]);

            mocks.publicacionesAll.mockResolvedValue([
                {
                    fecha: new Date("2026-10-03T12:00:00.000Z"),
                    cantidad: 4,
                    username: "usuario2",
                    id: 3,
                },
            ]);

            const resultado = await obtenerEstadisticas();

            expect(resultado.visitas[0]).toMatchObject({
                cantidad: 12,
                tipoVisitante: "comprador",
                id: 1,
            });

            expect(resultado.contactos[0]).toMatchObject({
                cantidad: 7,
                username: "usuario1",
                id: 2,
            });

            expect(resultado.publicaciones[0]).toMatchObject({
                cantidad: 4,
                username: "usuario2",
                id: 3,
            });
        });

        it("propaga el error cuando falla alguna consulta estadística", async () => {
            mocks.visitasAll.mockResolvedValue([]);
            mocks.contactosAll.mockRejectedValue(
                new Error("Error al consultar contactos"),
            );
            mocks.publicacionesAll.mockResolvedValue([]);

            await expect(
                obtenerEstadisticas(),
            ).rejects.toThrow("Error al consultar contactos");

            expect(mocks.visitasAll).toHaveBeenCalledOnce();
            expect(mocks.contactosAll).toHaveBeenCalledOnce();
            expect(mocks.publicacionesAll).toHaveBeenCalledOnce();
        });
    });
});
