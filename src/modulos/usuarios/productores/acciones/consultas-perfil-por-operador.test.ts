import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPerfilProductorPorOperador } from "./consultas-perfil-por-operador";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    productorSelect: vi.fn(),
    first: vi.fn(),
    where: vi.fn(),
    all: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Productor: {
                    select: mocks.productorSelect,
                },
                PublicacionProductor: {
                    where: mocks.where,
                },
            },
        },
    },
}));

type Constructor = {
    select: (...campos: string[]) => Constructor;
    include: (
        relacion: string,
        callback?: (consulta: Constructor) => unknown
    ) => Constructor;
    all: typeof mocks.all;
};

function crearConstructor(): Constructor {
    const constructor: Constructor = {
        select: () => constructor,
        include: (_relacion, callback) => {
            callback?.(constructor);
            return constructor;
        },
        all: mocks.all,
    };
    return constructor;
}

const productor = {
    id: 10,
    nombreFantasia: "Huerta Norte",
    fotoPerfil: null,
    whatsApp: "099123456",
};

function crearFila() {
    return {
        pais: { nombrePais: "Uruguay" },
        ubicaciones: [
            {
                id: 3,
                nombreUbicacion: "Depósito central",
                urlMaps: "https://maps.example/central",
            },
        ],
        publicacion: {
            id: 20,
            foto: "/tomate.jpg",
            precio: "150",
            fecha: new Date("2026-10-18T12:00:00Z"),
            cantidadUnidades: 25,
            publicacionActiva: true,
            publicacionDisponible: true,
            tipoPublicacion: "PRODUCTOR",
            presentacion: {
                nombrePresentacion: "Caja",
                variedad: {
                    nombreVariedad: "Perita",
                    especie: { nombreEspecie: "Tomate" },
                },
            },
            categoria: { nombreCategoria: "Primera" },
            calibre: { codigoCalibre: "M" },
        },
    };
}

describe("obtenerPerfilProductorPorOperador", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.obtenerSesion.mockResolvedValue({usuarioId: 5, rol: "OPERADOR", expiraEn: 2000000000});
        mocks.productorSelect.mockReturnValue({first: mocks.first});
        mocks.first.mockResolvedValue(productor);
        mocks.where.mockReturnValue(crearConstructor());
        mocks.all.mockResolvedValue([]);
    });

    it.each([null, "PRODUCTOR"] as const)("rechaza la consulta con sesión %s antes de acceder a datos", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 5, rol, expiraEn: 2000000000 } : null);
        await expect(obtenerPerfilProductorPorOperador("Huerta Norte")).rejects.toThrow("No tiene permisos para consultar las publicaciones del productor.");
        expect(mocks.productorSelect).not.toHaveBeenCalled();
        expect(mocks.where).not.toHaveBeenCalled();
    });

    it.each(["OPERADOR", "ADMINISTRADOR"] as const)("permite consultar el perfil y sus publicaciones al rol %s", async (rol) => {
        mocks.obtenerSesion.mockResolvedValue({usuarioId: 5, rol, expiraEn: 2000000000});
        const fila = crearFila();
        mocks.all.mockResolvedValue([fila]);
        await expect(obtenerPerfilProductorPorOperador(productor.nombreFantasia)).
            resolves.toEqual({
                ...productor,
                publicaciones: [
                    {
                        id: 20,
                        foto: "/tomate.jpg",
                        precio: "150",
                        fecha: fila.publicacion.fecha.toString(),
                        cantidadUnidades: 25,
                        especie: "Tomate",
                        variedad: "Perita",
                        presentacion: "Caja",
                        categoria: "Primera",
                        calibre: "M",
                        pais: "Uruguay",
                        ubicaciones: fila.ubicaciones,
                    },
                ],
        });
        expect(mocks.first).toHaveBeenCalledWith({nombreFantasia: productor.nombreFantasia});
        expect(mocks.where).toHaveBeenCalledWith({productorId: productor.id});
    });

    it.each(["", "   "])("devuelve null cuando el nombre está vacío: %s",
        async (nombre) => {
            await expect(obtenerPerfilProductorPorOperador(nombre)).resolves.toBeNull();
            expect(mocks.productorSelect).not.toHaveBeenCalled();
        }
    );

    it("devuelve null cuando el productor no existe", async () => {
        mocks.first.mockResolvedValue(null);
        await expect( obtenerPerfilProductorPorOperador("Inexistente")).resolves.toBeNull();
        expect(mocks.first).toHaveBeenCalledWith({nombreFantasia: "Inexistente"});
        expect(mocks.where).not.toHaveBeenCalled();
    });

    it("devuelve el perfil sin publicaciones cuando no tiene ninguna", async () => {
        await expect(
            obtenerPerfilProductorPorOperador("Huerta Norte")
        ).resolves.toEqual({
            ...productor,
            publicaciones: [],
        });
        expect(mocks.where).toHaveBeenCalledWith({productorId: productor.id});
    });

    it("transforma los datos de las publicaciones y sus ubicaciones", async () => {
        const fila = crearFila();
        mocks.all.mockResolvedValue([fila]);
        const resultado = await obtenerPerfilProductorPorOperador("Huerta Norte");

        expect(resultado).toEqual({
            ...productor,
            publicaciones: [
                {
                    id: 20,
                    foto: "/tomate.jpg",
                    precio: "150",
                    fecha: fila.publicacion.fecha.toString(),
                    cantidadUnidades: 25,
                    especie: "Tomate",
                    variedad: "Perita",
                    presentacion: "Caja",
                    categoria: "Primera",
                    calibre: "M",
                    pais: "Uruguay",
                    ubicaciones: fila.ubicaciones,
                },
            ],
        });
    });

    it("excluye publicaciones inactivas, no disponibles o de otro tipo", async () => {
        const valida = crearFila();
        mocks.all.mockResolvedValue([
            valida,
            {
                ...crearFila(),
                publicacion: {
                    ...crearFila().publicacion,
                    publicacionActiva: false,
                },
            },
            {
                ...crearFila(),
                publicacion: {
                    ...crearFila().publicacion,
                    publicacionDisponible: false,
                },
            },
            {
                ...crearFila(),
                publicacion: {
                    ...crearFila().publicacion,
                    tipoPublicacion: "OPERADOR",
                },
            },
        ]);
        const resultado = await obtenerPerfilProductorPorOperador("Huerta Norte");
        expect(resultado?.publicaciones).toHaveLength(1);
        expect(resultado?.publicaciones[0].id).toBe(valida.publicacion.id);
    });

    it("conserva valores nulos y ubicaciones vacías", async () => {
        const fila = crearFila();
        mocks.all.mockResolvedValue([
            {
                ...fila,
                ubicaciones: [],
                publicacion: {
                    ...fila.publicacion,
                    precio: null,
                    foto: null,
                    cantidadUnidades: null,
                },
            },
        ]);
        const resultado = await obtenerPerfilProductorPorOperador(
            "Huerta Norte"
        );
        expect(resultado?.publicaciones[0]).toMatchObject({
            precio: null,
            foto: null,
            cantidadUnidades: null,
            ubicaciones: [],
        });
    });

    it("propaga errores al consultar el perfil", async () => {
        mocks.first.mockRejectedValue(new Error("Error de perfil"));
        await expect(obtenerPerfilProductorPorOperador("Huerta Norte")).rejects.toThrow("Error de perfil");
    });

    it("propaga errores al consultar las publicaciones", async () => {
        mocks.all.mockRejectedValue(new Error("Error de publicaciones"));
        await expect(obtenerPerfilProductorPorOperador("Huerta Norte")).rejects.toThrow("Error de publicaciones");
    });
});