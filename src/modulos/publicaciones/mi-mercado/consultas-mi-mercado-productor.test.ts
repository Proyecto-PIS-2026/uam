import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPublicacionesMiMercadoProductor } from "./consultas-mi-mercado-productor";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    seleccionarProductor: vi.fn(),
    filtrarProductor: vi.fn(),
    primerProductor: vi.fn(),
    filtrarPublicaciones: vi.fn(),
    incluir: vi.fn(),
    todasPublicaciones: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Productor: { select: mocks.seleccionarProductor },
                PublicacionProductor: { where: mocks.filtrarPublicaciones },
            },
        },
    },
}));

function relacionPublicacion(productorId: number, id: number) {
    return {
        id: id + 100,
        productorId,
        paisId: 1,
        pais: { nombrePais: "URUGUAY" },
        ubicaciones: [{ id: id + 200, nombreUbicacion: "Canelones", urlMaps: "https://maps.example/quinta", publicacionId: id + 100 }],
        publicacion: {
            id,
            foto: null,
            precio: "125.00",
            cantidadUnidades: 10,
            fecha: { toString: () => "2026-10-16T12:00:00Z" },
            publicacionActiva: true,
            publicacionDisponible: true,
            presentacion: {
                id: 7,
                nombrePresentacion: "Cajón",
                variedad: { id: 8, nombreVariedad: "Crespa", especie: { id: 9, nombreEspecie: "Lechuga", fotoEspecie: null } },
            },
            categoria: { id: 4, nombreCategoria: "Primera" },
            calibre: { id: 5, nombreCalibre: "Mediano", codigoCalibre: "M" },
        },
    };
}

describe("lectura privada de Mi Mercado del productor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 });
        mocks.seleccionarProductor.mockReturnValue({ where: mocks.filtrarProductor });
        mocks.filtrarProductor.mockReturnValue({ first: mocks.primerProductor });
        mocks.primerProductor.mockResolvedValue({ id: 23, usuarioId: 10, nombreFantasia: "Mi quinta" });
        const builder = { include: mocks.incluir, all: mocks.todasPublicaciones };
        mocks.filtrarPublicaciones.mockReturnValue(builder);
        const relacionBuilder = { select: vi.fn(), include: vi.fn() };
        relacionBuilder.select.mockReturnValue(relacionBuilder);
        relacionBuilder.include.mockImplementation((_relacion, callback) => {
            callback?.(relacionBuilder);
            return relacionBuilder;
        });
        mocks.incluir.mockImplementation((_relacion, callback) => {
            callback?.(relacionBuilder);
            return builder;
        });
        mocks.todasPublicaciones.mockResolvedValue([]);
    });

    it("consulta exclusivamente publicaciones del perfil obtenido de la sesión y serializa sus datos", async () => {
        mocks.todasPublicaciones.mockResolvedValue([relacionPublicacion(23, 31)]);

        const resultado = await obtenerPublicacionesMiMercadoProductor();

        expect(mocks.filtrarProductor).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
        expect(mocks.filtrarPublicaciones).toHaveBeenCalledExactlyOnceWith({ productorId: 23 });
        expect(mocks.obtenerSesion).toHaveBeenCalledOnce();
        expect(resultado.productor).toEqual({ id: 23, usuarioId: 10, nombreFantasia: "Mi quinta" });
        expect(resultado.publicaciones).toEqual([{
            id: 31,
            publicacionProductorId: 131,
            paisId: 1,
            pais: "URUGUAY",
            foto: null,
            precio: "125.00",
            cantidadUnidades: 10,
            fecha: "2026-10-16T12:00:00Z",
            publicacionActiva: true,
            publicacionDisponible: true,
            presentacion: relacionPublicacion(23, 31).publicacion.presentacion,
            categoria: { id: 4, nombreCategoria: "Primera" },
            calibre: { id: 5, nombreCalibre: "Mediano", codigoCalibre: "M" },
            ubicaciones: [{ id: 231, nombreUbicacion: "Canelones", urlMaps: "https://maps.example/quinta" }],
        }]);
    });

    it("aísla los resultados entre dos productores autenticados", async () => {
        const relaciones = [relacionPublicacion(23, 31), relacionPublicacion(42, 58)];
        let productorIdConsultado: number;
        mocks.filtrarPublicaciones.mockImplementation(({ productorId }) => {
            productorIdConsultado = productorId;
            return { include: mocks.incluir, all: mocks.todasPublicaciones };
        });
        mocks.todasPublicaciones.mockImplementation(async () => relaciones.filter((relacion) => relacion.productorId === productorIdConsultado));

        const primero = await obtenerPublicacionesMiMercadoProductor();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 11, rol: "PRODUCTOR", expiraEn: 2000000000 });
        mocks.primerProductor.mockResolvedValue({ id: 42, usuarioId: 11, nombreFantasia: "Otra quinta" });
        const segundo = await obtenerPublicacionesMiMercadoProductor();

        expect(primero.publicaciones.map(({ id }) => id)).toEqual([31]);
        expect(segundo.publicaciones.map(({ id }) => id)).toEqual([58]);
        expect(mocks.filtrarProductor).toHaveBeenNthCalledWith(2, { usuarioId: 11 });
        expect(mocks.filtrarPublicaciones).toHaveBeenNthCalledWith(2, { productorId: 42 });
    });

    it.each([null, "OPERADOR", "ADMINISTRADOR"] as const)("impide consultar publicaciones con sesión de %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol === null ? null : { usuarioId: 10, rol, expiraEn: 2000000000 });

        await expect(obtenerPublicacionesMiMercadoProductor()).rejects.toMatchObject({ status: rol === null ? 401 : 403 });
        expect(mocks.seleccionarProductor).not.toHaveBeenCalled();
        expect(mocks.filtrarPublicaciones).not.toHaveBeenCalled();
    });

    it("retorna un listado vacío si el productor no tiene publicaciones", async () => {
        const resultado = await obtenerPublicacionesMiMercadoProductor();

        expect(resultado.publicaciones).toEqual([]);
        expect(mocks.filtrarPublicaciones).toHaveBeenCalledExactlyOnceWith({ productorId: 23 });
    });

    it("no consulta publicaciones si no existe un perfil para el usuario autenticado", async () => {
        mocks.primerProductor.mockResolvedValue(null);

        await expect(obtenerPublicacionesMiMercadoProductor()).rejects.toThrow("No se encontró ningún productor de Mi Mercado.");
        expect(mocks.filtrarPublicaciones).not.toHaveBeenCalled();
    });

    it("mantiene valores opcionales sin reemplazarlos por datos de otro perfil", async () => {
        const relacion = relacionPublicacion(23, 31);
        mocks.todasPublicaciones.mockResolvedValue([{ ...relacion, ubicaciones: [], publicacion: { ...relacion.publicacion, precio: null, cantidadUnidades: null } }]);

        const resultado = await obtenerPublicacionesMiMercadoProductor();

        expect(resultado.publicaciones[0]).toMatchObject({ precio: null, cantidadUnidades: null, ubicaciones: [] });
    });
});
