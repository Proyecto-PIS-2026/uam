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
            especie: { nombreEspecie: "Naranja" },
            variedad: { nombreVariedad: "Valencia" },
            presentacion: { nombrePresentacion: "KG" },
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

    it.each([null, "PRODUCTOR"] as const)("rechaza la sesión %s antes de acceder a datos", async (rol) => {
            mocks.obtenerSesion.mockResolvedValue(rol? { usuarioId: 5, rol, expiraEn: 2000000000 } : null);
            await expect(obtenerProductoresDisponibles()).rejects.toMatchObject({status: rol ? 403 : 401, message: rol ? "No tenés permiso para consultar productores." : "Iniciá sesión para continuar."});
            await expect(obtenerPerfilProductor(productor.nombreFantasia)).rejects.toMatchObject({status: rol ? 403 : 401, message: rol ? "No tenés permiso para consultar el perfil del productor." : "Iniciá sesión para continuar."});
            expect(mocks.select).not.toHaveBeenCalled();
        },
    );

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)("permite consultar listado y perfil al rol %s",async (rol) => {
        mocks.obtenerSesion.mockResolvedValue({usuarioId: 5, rol, expiraEn: 2000000000});
        mocks.all.mockResolvedValue([{ ...productor, publicacionesProductor: [relacion()] }]);
        mocks.first.mockResolvedValue({
            ...productor,
            publicacionesProductor: [relacion()],
        });
        await expect(obtenerProductoresDisponibles()).resolves.toEqual([
            {
                id: productor.id,
                nombreFantasia: productor.nombreFantasia,
                fotoPerfil: null,
                cantidadProductos: 1,
                ubicaciones: ["Salto"],
                departamentos: [],
            },
        ]);
        await expect(obtenerPerfilProductor(productor.nombreFantasia)).
            resolves.toMatchObject({
                id: productor.id,
                nombreFantasia: productor.nombreFantasia,
                publicaciones: [expect.objectContaining({id: 10, especie: "Naranja"})],
        });
    });

    it("devuelve un listado vacío cuando no existen productores", async () => {
        mocks.all.mockResolvedValue([]);
        expect(await obtenerProductoresDisponibles()).toEqual([]);
    });

    it("ordena productores con publicaciones públicas y excluye los que no tienen publicaciones públicas ni cuentas con otro rol", async () => {
        mocks.all.mockResolvedValue([
            { ...productor, nombreFantasia: "Zeta", publicacionesProductor: [relacion(), relacion(), relacion(false, true, "PRODUCTOR", "Oculta"), relacion(true, false), relacion(true, true, "OPERADOR")] },
            { ...productor, id: 2, nombreFantasia: "Álamo" },
            { ...productor, id: 3, usuario: { rol: "OPERADOR" } },
        ]);
        expect(await obtenerProductoresDisponibles()).toEqual([
            { id: 1, nombreFantasia: "Zeta", fotoPerfil: null, cantidadProductos: 2, ubicaciones: ["Salto"], departamentos: [] },
        ]);
    });

    it("obtiene los departamentos de ubicaciones persistidas y no revela los de publicaciones ocultas", async () => {
        const publicacionesProductor = [
            { ...relacion(), ubicaciones: [{ nombreUbicacion: "Depósito", departamento: "Salto" }, { nombreUbicacion: "Chacra", departamento: "Canelones" }] },
            { ...relacion(), ubicaciones: [{ nombreUbicacion: "Otro depósito", departamento: "Salto" }] },
            { ...relacion(), ubicaciones: [{ nombreUbicacion: "Maldonado", departamento: null }] },
            { ...relacion(false), ubicaciones: [{ nombreUbicacion: "Oculta", departamento: "Artigas" }] },
            { ...relacion(true, false), ubicaciones: [{ nombreUbicacion: "No disponible", departamento: "Montevideo" }] },
            { ...relacion(true, true, "OPERADOR"), ubicaciones: [{ nombreUbicacion: "Otro tipo", departamento: "Rocha" }] },
        ];
        mocks.all.mockResolvedValue([{ ...productor, publicacionesProductor }]);
        mocks.first.mockResolvedValue({ ...productor, publicacionesProductor });
        expect(await obtenerProductoresDisponibles()).toEqual([expect.objectContaining({
            cantidadProductos: 3, departamentos: ["Canelones", "Salto"],
        })]);
        expect(await obtenerPerfilProductor(productor.nombreFantasia)).toMatchObject({ departamentos: ["Canelones", "Salto"] });
    });

    it("consulta el perfil por nombre y devuelve solo publicaciones y puntos de retiro visibles", async () => {
        mocks.first.mockResolvedValue({ ...productor, publicacionesProductor: [relacion(), relacion(false, true, "PRODUCTOR", "Oculta"), relacion(true, false), relacion(true, true, "OPERADOR")] });
        const perfil = await obtenerPerfilProductor(productor.nombreFantasia);
        expect(mocks.first).toHaveBeenCalledWith({ nombreFantasia: productor.nombreFantasia });
        expect(perfil).toMatchObject({ nombreFantasia: productor.nombreFantasia, ubicaciones: ["Salto"] });
        expect(perfil?.publicaciones.map((publicacion) => publicacion.id)).toEqual([10]);
    });

    it("conserva la consulta de perfil aunque no haya publicaciones públicas", async () => {
        mocks.first.mockResolvedValue({
            ...productor,
            publicacionesProductor: [
                relacion(false, true),
                relacion(true, false),
                relacion(true, true, "OPERADOR"),
            ],
        });

        await expect(obtenerPerfilProductor(productor.nombreFantasia)).resolves.toMatchObject({
            nombreFantasia: productor.nombreFantasia,
            publicaciones: [],
            ubicaciones: [],
        });
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
