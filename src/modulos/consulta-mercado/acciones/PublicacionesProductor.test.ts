import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosSesion } from "../../identidad-acceso/autenticacion/sesiones";
import { consultarPublicacionesProductores } from "./PublicacionesProductor";

const mocks = vi.hoisted(() => ({
    autorizado: vi.fn(),
    primerWhere: vi.fn(),
    where: vi.fn(),
    include: vi.fn(),
    all: vi.fn(),
}));

vi.mock("../../identidad-acceso/autorizacion/permisos", () => ({
    autorizado: mocks.autorizado,
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                PublicacionProductor: {
                    where: mocks.primerWhere,
                },
            },
        },
    },
}));

type ConstructorConsulta = {
    where: typeof mocks.where;
    include: typeof mocks.include;
    all: typeof mocks.all;
};

const consulta: ConstructorConsulta = {
    where: mocks.where,
    include: mocks.include,
    all: mocks.all,
};

type PredicadoPublicacion = {
    publicacionActiva: { eq: (valor: boolean) => boolean };
    publicacionDisponible: { eq: (valor: boolean) => boolean };
};

type NodoPredicado = {
    publicacion: { some: (predicado?: (publicacion: PredicadoPublicacion) => unknown) => unknown };
    productor: { some: () => boolean };
    pais: { some: () => boolean };
};

function crearNodoPredicado(): NodoPredicado {
    const somePublicacion = vi.fn((predicado?: (publicacion: PredicadoPublicacion) => unknown) => {
        if (predicado) {
            return predicado({
                publicacionActiva: { eq: () => true },
                publicacionDisponible: { eq: () => true },
            });
        }
        return true;
    });

    return {
        publicacion: { some: somePublicacion },
        productor: { some: () => true },
        pais: { some: () => true },
    };
}

type ConstructorSeleccion = {
    select: (...campos: string[]) => ConstructorSeleccion;
    include: (relacion: string, callback: (builder: ConstructorSeleccion) => unknown) => ConstructorSeleccion;
};

function crearConstructorSeleccion(): ConstructorSeleccion {
    const seleccion: ConstructorSeleccion = {
        select: () => seleccion,
        include: (_relacion: string, callback: (builder: ConstructorSeleccion) => unknown) => {
            callback(crearConstructorSeleccion());
            return seleccion;
        },
    };

    return seleccion;
}

type FilaMock = {
    publicacion: {
        id: string;
        precio: string | null;
        fecha: Date;
        foto: string | null;
        cantidadUnidades: string | null;
        presentacion: {
            nombrePresentacion: string;
            variedad: {
                nombreVariedad: string;
                especie: { nombreEspecie: string } | null;
            } | null;
        } | null;
        categoria: { nombreCategoria: string } | null;
        calibre: { nombreCalibre: string; codigoCalibre: string } | null;
    } | null;
    productor: {
        id: string;
        nombreFantasia: string;
        fotoPerfil: string | null;
        whatsApp: string;
    } | null;
    pais: { nombrePais: string } | null;
    ubicaciones: { id: string; nombreUbicacion: string; urlMaps: string }[] | null;
};

function crearFilaValida(): FilaMock {
    return {
        publicacion: {
            id: "101",
            precio: "125.50",
            fecha: new Date("2026-10-16T12:30:00.000Z"),
            foto: "/publicaciones/manzana.jpg",
            cantidadUnidades: "24",
            presentacion: {
                nombrePresentacion: "Caja de 10 kg",
                variedad: {
                    nombreVariedad: "Royal Gala",
                    especie: { nombreEspecie: "Manzana" },
                },
            },
            categoria: { nombreCategoria: "I" },
            calibre: { nombreCalibre: "Grande", codigoCalibre: "G" },
        },
        productor: {
            id: "7",
            nombreFantasia: "Frutas del Sur",
            fotoPerfil: "/productores/frutas-del-sur.jpg",
            whatsApp: "+59899111222",
        },
        pais: { nombrePais: "Uruguay" },
        ubicaciones: [
            { id: "30", nombreUbicacion: "Local central", urlMaps: "https://maps.example/30" },
            { id: "31", nombreUbicacion: "Depósito", urlMaps: "https://maps.example/31" },
        ],
    };
}

const sesionOperador = {
    usuarioId: 42,
    rol: "OPERADOR",
} as DatosSesion;

describe("consultarPublicacionesProductores", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.autorizado.mockReturnValue(true);
        mocks.all.mockResolvedValue([]);
        mocks.primerWhere.mockImplementation((predicado: (nodo: ReturnType<typeof crearNodoPredicado>) => unknown) => {
            predicado(crearNodoPredicado());
            return consulta;
        });
        mocks.where.mockImplementation((predicado: (nodo: ReturnType<typeof crearNodoPredicado>) => unknown) => {
            predicado(crearNodoPredicado());
            return consulta;
        });
        mocks.include.mockImplementation((_relacion: string, callback: (builder: ConstructorSeleccion) => unknown) => {
            callback(crearConstructorSeleccion());
            return consulta;
        });
    });

    it("exige el permiso de consulta de publicaciones de productores", async () => {
        mocks.autorizado.mockReturnValue(false);

        await expect(consultarPublicacionesProductores(sesionOperador)).rejects.toThrow(
            "No tiene permisos para consultar publicaciones de Productores.",
        );

        expect(mocks.autorizado).toHaveBeenCalledTimes(1);
        expect(mocks.autorizado).toHaveBeenCalledWith("productor.publicacion.consultar", sesionOperador);
        expect(mocks.primerWhere).not.toHaveBeenCalled();
        expect(mocks.all).not.toHaveBeenCalled();
    });

    it("rechaza una sesión nula cuando el permiso no la autoriza", async () => {
        mocks.autorizado.mockReturnValue(false);

        await expect(consultarPublicacionesProductores(null)).rejects.toThrow(
            "No tiene permisos para consultar publicaciones de Productores.",
        );

        expect(mocks.autorizado).toHaveBeenCalledWith("productor.publicacion.consultar", null);
        expect(mocks.primerWhere).not.toHaveBeenCalled();
        expect(mocks.all).not.toHaveBeenCalled();
    });

    it("construye los filtros y carga las relaciones necesarias con el ORM", async () => {
        await consultarPublicacionesProductores(sesionOperador);

        expect(mocks.primerWhere).toHaveBeenCalledTimes(1);
        expect(mocks.where).toHaveBeenCalledTimes(3);
        expect(mocks.include).toHaveBeenCalledTimes(4);
        expect(mocks.include.mock.calls.map(([relacion]) => relacion)).toEqual([
            "publicacion",
            "productor",
            "pais",
            "ubicaciones",
        ]);
        expect(mocks.all).toHaveBeenCalledTimes(1);
    });

    it("devuelve una lista vacía cuando el ORM no encuentra publicaciones", async () => {
        mocks.all.mockResolvedValue([]);

        await expect(consultarPublicacionesProductores(sesionOperador)).resolves.toEqual({ publicaciones: [] });
    });

    it("transforma los tipos y mapea todos los datos de la publicación, productor, país y ubicaciones", async () => {
        const fila = crearFilaValida();
        mocks.all.mockResolvedValue([fila]);

        const resultado = await consultarPublicacionesProductores(sesionOperador);

        expect(resultado.publicaciones).toEqual([
            {
                id: 101,
                precio: 125.5,
                fecha: fila.publicacion!.fecha.toString(),
                foto: "/publicaciones/manzana.jpg",
                especie: "Manzana",
                variedad: "Royal Gala",
                presentacion: "Caja de 10 kg",
                cantidadUnidades: 24,
                categoria: "I",
                calibre: "Grande",
                codigoCalibre: "G",
                pais: "Uruguay",
                productor: {
                    id: 7,
                    nombreFantasia: "Frutas del Sur",
                    fotoPerfil: "/productores/frutas-del-sur.jpg",
                    whatsApp: "+59899111222",
                },
                ubicaciones: [
                    { id: 30, nombreUbicacion: "Local central", urlMaps: "https://maps.example/30" },
                    { id: 31, nombreUbicacion: "Depósito", urlMaps: "https://maps.example/31" },
                ],
            },
        ]);
    });

    it("conserva precio, foto, foto de perfil y unidades nulos", async () => {
        const fila = crearFilaValida();
        fila.publicacion!.precio = null;
        fila.publicacion!.foto = null;
        fila.publicacion!.cantidadUnidades = null;
        fila.productor!.fotoPerfil = null;
        mocks.all.mockResolvedValue([fila]);

        const resultado = await consultarPublicacionesProductores(sesionOperador);

        expect(resultado.publicaciones).toHaveLength(1);
        expect(resultado.publicaciones[0]).toMatchObject({
            precio: null,
            foto: null,
            cantidadUnidades: null,
            productor: { fotoPerfil: null },
        });
    });

    it("usa una lista vacía de ubicaciones si el resultado no las trae", async () => {
        const fila = { ...crearFilaValida(), ubicaciones: null };
        mocks.all.mockResolvedValue([fila]);

        const resultado = await consultarPublicacionesProductores(sesionOperador);

        expect(resultado.publicaciones[0]?.ubicaciones).toEqual([]);
    });

    it("descarta filas sin la publicación, el productor o el país relacionados", async () => {
        const base = crearFilaValida();
        mocks.all.mockResolvedValue([
            { ...base, publicacion: null },
            { ...crearFilaValida(), productor: null },
            { ...crearFilaValida(), pais: null },
        ]);

        const resultado = await consultarPublicacionesProductores(sesionOperador);

        expect(resultado.publicaciones).toEqual([]);
    });

    it("descarta filas sin presentación, variedad o especie relacionada", async () => {
        const sinPresentacion = crearFilaValida();
        sinPresentacion.publicacion!.presentacion = null;

        const sinVariedad = crearFilaValida();
        sinVariedad.publicacion!.presentacion!.variedad = null;

        const sinEspecie = crearFilaValida();
        sinEspecie.publicacion!.presentacion!.variedad!.especie = null;

        mocks.all.mockResolvedValue([
            sinPresentacion,
            sinVariedad,
            sinEspecie,
        ]);

        const resultado = await consultarPublicacionesProductores(sesionOperador);

        expect(resultado.publicaciones).toEqual([]);
    });

    it("descarta filas sin categoría o calibre relacionado", async () => {
        const sinCategoria = crearFilaValida();
        sinCategoria.publicacion!.categoria = null;

        const sinCalibre = crearFilaValida();
        sinCalibre.publicacion!.calibre = null;

        mocks.all.mockResolvedValue([sinCategoria, sinCalibre]);

        const resultado = await consultarPublicacionesProductores(sesionOperador);

        expect(resultado.publicaciones).toEqual([]);
    });

    it("propaga los errores producidos por la consulta del ORM", async () => {
        mocks.all.mockRejectedValue(new Error("Fallo de base de datos mockeado"));

        await expect(consultarPublicacionesProductores(sesionOperador)).rejects.toThrow(
            "Fallo de base de datos mockeado",
        );
    });
});
