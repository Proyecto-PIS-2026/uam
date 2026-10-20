import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilProductor, obtenerProductoresDisponibles } from "./consultas-productores";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(), select: vi.fn(), include: vi.fn(), all: vi.fn(), first: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => {
    const consulta = { select: mocks.select, include: mocks.include, all: mocks.all, first: mocks.first };
    mocks.select.mockReturnValue(consulta);
    mocks.include.mockImplementation((_relacion: string, configurar?: (consulta: unknown) => unknown) => {
        configurar?.(consulta);
        return consulta;
    });
    return { db: { orm: { public: { Productor: consulta } } } };
});

function relacion(publicacionActiva = true, publicacionDisponible = true, tipoPublicacion = "PRODUCTOR", nombreUbicacion = "Salto") {
    return {
        pais: { nombrePais: "Uruguay" },
        ubicaciones: [{ nombreUbicacion }],
        publicacion: {
            id: 10, foto: null, precio: null, fecha: "2026-10-18T12:00:00Z", cantidadUnidades: 20,
            publicacionActiva, publicacionDisponible, tipoPublicacion,
            presentacion: { nombrePresentacion: "KG", variedad: { nombreVariedad: "Valencia", especie: { nombreEspecie: "Naranja" } } },
            categoria: { nombreCategoria: "I" }, calibre: { codigoCalibre: "M" },
        },
    };
}

const productor = {
    id: 1, nombreFantasia: "Huerta del Norte", fotoPerfil: null, whatsApp: "59899123456",
    usuario: { rol: "PRODUCTOR" }, publicacionesProductor: [],
};

describe("Consultas de productores para operadores", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 5, rol: "OPERADOR", expiraEn: 2000000000 });
    });

    it.each([null, "PRODUCTOR", "ADMINISTRADOR"] as const)("rechaza la sesión %s antes de acceder a datos", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 5, rol, expiraEn: 2000000000 } : null);
        await expect(obtenerProductoresDisponibles()).rejects.toMatchObject({ status: rol ? 403 : 401 });
        await expect(obtenerPerfilProductor(productor.nombreFantasia)).rejects.toMatchObject({ status: rol ? 403 : 401 });
        expect(mocks.select).not.toHaveBeenCalled();
    });

    it("devuelve un listado vacío cuando no existen productores", async () => {
        mocks.all.mockResolvedValue([]);
        expect(await obtenerProductoresDisponibles()).toEqual([]);
    });

    it("ordena productores, conserva perfiles sin publicaciones y excluye cuentas con otro rol", async () => {
        mocks.all.mockResolvedValue([
            { ...productor, nombreFantasia: "Zeta", publicacionesProductor: [relacion(), relacion(), relacion(false, true, "PRODUCTOR", "Oculta"), relacion(true, false), relacion(true, true, "OPERADOR")] },
            { ...productor, id: 2, nombreFantasia: "Álamo" },
            { ...productor, id: 3, usuario: { rol: "OPERADOR" } },
        ]);
        expect(await obtenerProductoresDisponibles()).toEqual([
            { id: 2, nombreFantasia: "Álamo", fotoPerfil: null, cantidadProductos: 0, ubicaciones: [] },
            { id: 1, nombreFantasia: "Zeta", fotoPerfil: null, cantidadProductos: 2, ubicaciones: ["Salto"] },
        ]);
    });

    it("consulta el perfil por nombre y devuelve solo publicaciones y puntos de retiro visibles", async () => {
        mocks.first.mockResolvedValue({ ...productor, publicacionesProductor: [relacion(), relacion(false, true, "PRODUCTOR", "Oculta"), relacion(true, false), relacion(true, true, "OPERADOR")] });
        const perfil = await obtenerPerfilProductor(productor.nombreFantasia);
        expect(mocks.first).toHaveBeenCalledWith({ nombreFantasia: productor.nombreFantasia });
        expect(perfil).toMatchObject({ nombreFantasia: productor.nombreFantasia, ubicaciones: ["Salto"] });
        expect(perfil?.publicaciones.map((publicacion) => publicacion.id)).toEqual([10]);
    });

    it.each([null, { ...productor, usuario: { rol: "OPERADOR" } }])("oculta perfiles inexistentes o con cuenta no disponible", async (resultado) => {
        mocks.first.mockResolvedValue(resultado);
        expect(await obtenerPerfilProductor(productor.nombreFantasia)).toBeNull();
    });

    it("no consulta un nombre vacío", async () => {
        expect(await obtenerPerfilProductor(" ")).toBeNull();
        expect(mocks.first).not.toHaveBeenCalled();
    });
});
