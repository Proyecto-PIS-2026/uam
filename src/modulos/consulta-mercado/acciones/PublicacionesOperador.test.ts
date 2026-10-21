
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "temporal-polyfill/full/global";
import { consultarPublicaciones } from "./PublicacionesOperador";

const mocks = vi.hoisted(() => ({
    autorizado: vi.fn(),
    primerWhere: vi.fn(),
    where: vi.fn(),
    include: vi.fn(),
    all: vi.fn(),
    or: vi.fn(),
}));

vi.mock("../../identidad-acceso/autorizacion/permisos", () => ({
    autorizado: mocks.autorizado,
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                PublicacionOperador: {
                    where: mocks.primerWhere,
                },
            },
        },
    },
}));

vi.mock("@prisma/orm-postgres/orm-client", () => ({
    or: mocks.or,
}));

type PredicadoPublicacion = {
    publicacionActiva: { eq: (valor: boolean) => unknown };
    publicacionDisponible: { eq: (valor: boolean) => unknown };
};

type PredicadoLocal = {
    finContrato: {
        isNull: () => unknown;
        gte: (fecha: unknown) => unknown;
    };
};

type PredicadoOperador = {
    locales: {
        some: (predicado: (local: PredicadoLocal) => unknown) => unknown;
    };
};

type NodoPredicado = {
    publicacion: {
        some: (predicado?: (publicacion: PredicadoPublicacion) => unknown) => unknown;
    };
    operador: {
        some: (predicado: (operador: PredicadoOperador) => unknown) => unknown;
    };
    pais: {
        some: () => unknown;
    };
};

type RegistroPredicado = {
    somePublicacion: ReturnType<typeof vi.fn>;
    eqActiva: ReturnType<typeof vi.fn>;
    eqDisponible: ReturnType<typeof vi.fn>;
    someOperador: ReturnType<typeof vi.fn>;
    someLocales: ReturnType<typeof vi.fn>;
    finContratoIsNull: ReturnType<typeof vi.fn>;
    finContratoGte: ReturnType<typeof vi.fn>;
    somePais: ReturnType<typeof vi.fn>;
};

const predicadosEvaluados: RegistroPredicado[] = [];

function crearNodoPredicado(): NodoPredicado {
    const eqActiva = vi.fn(() => true);
    const eqDisponible = vi.fn(() => true);
    const finContratoIsNull = vi.fn(() => "finContrato.isNull");
    const finContratoGte = vi.fn(() => "finContrato.gte");

    const somePublicacion = vi.fn((predicado?: (publicacion: PredicadoPublicacion) => unknown) => {
        if (!predicado) return true;

        return predicado({
            publicacionActiva: { eq: eqActiva },
            publicacionDisponible: { eq: eqDisponible },
        });
    });

    const someLocales = vi.fn((predicado: (local: PredicadoLocal) => unknown) =>
        predicado({
            finContrato: {
                isNull: finContratoIsNull,
                gte: finContratoGte,
            },
        }),
    );

    const someOperador = vi.fn((predicado: (operador: PredicadoOperador) => unknown) =>
        predicado({
            locales: { some: someLocales },
        }),
    );

    const somePais = vi.fn(() => true);

    predicadosEvaluados.push({
        somePublicacion,
        eqActiva,
        eqDisponible,
        someOperador,
        someLocales,
        finContratoIsNull,
        finContratoGte,
        somePais,
    });

    return {
        publicacion: { some: somePublicacion },
        operador: { some: someOperador },
        pais: { some: somePais },
    };
}

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

type ConstructorSeleccion = {
    select: (...campos: string[]) => ConstructorSeleccion;
    include: (
        relacion: string,
        callback: (builder: ConstructorSeleccion) => unknown,
    ) => ConstructorSeleccion;
};

function crearConstructorSeleccion(): ConstructorSeleccion {
    const seleccion: ConstructorSeleccion = {
        select: () => seleccion,
        include: (_relacion, callback) => {
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
        tipoPublicacion: "OPERADOR",
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
    pais: { nombrePais: string } | null;
    operador: {
        id: string;
        nombreFantasia: string;
        whatsApp: string;
    } | null;
};

function crearFilaValida(): FilaMock {
    return {
        publicacion: {
            id: "101",
            precio: "125.50",
            fecha: new Date("2026-10-16T12:30:00.000Z"),
            foto: "/publicaciones/manzana.jpg",
            cantidadUnidades: "24",
            tipoPublicacion: "OPERADOR",
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
        pais: { nombrePais: "Uruguay" },
        operador: {
            id: "7",
            nombreFantasia: "Frutas del Sur",
            whatsApp: "+59899111222",
        },
    };
}

describe("consultarPublicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        predicadosEvaluados.length = 0;

        mocks.autorizado.mockReturnValue(true);
        mocks.all.mockResolvedValue([]);
        mocks.or.mockReturnValue("condicion-or");

        mocks.primerWhere.mockImplementation(
            (predicado: (nodo: NodoPredicado) => unknown) => {
                predicado(crearNodoPredicado());
                return consulta;
            },
        );

        mocks.where.mockImplementation(
            (predicado: (nodo: NodoPredicado) => unknown) => {
                predicado(crearNodoPredicado());
                return consulta;
            },
        );

        mocks.include.mockImplementation(
            (_relacion: string, callback: (builder: ConstructorSeleccion) => unknown) => {
                callback(crearConstructorSeleccion());
                return consulta;
            },
        );
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("exige el permiso de consulta de publicaciones de operadores", async () => {
        mocks.autorizado.mockReturnValue(false);

        await expect(consultarPublicaciones()).rejects.toThrow(
            "No tiene permisos para consultar publicaciones de Operadores.",
        );

        expect(mocks.autorizado).toHaveBeenCalledTimes(1);
        expect(mocks.autorizado).toHaveBeenCalledWith("operador.publicacion.consultar");
        expect(mocks.primerWhere).not.toHaveBeenCalled();
        expect(mocks.where).not.toHaveBeenCalled();
        expect(mocks.include).not.toHaveBeenCalled();
        expect(mocks.all).not.toHaveBeenCalled();
    });

    it("construye los filtros del ORM y carga las relaciones necesarias", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-16T14:30:00.000Z"));

        await consultarPublicaciones();

        expect(mocks.primerWhere).toHaveBeenCalledTimes(1);
        expect(mocks.where).toHaveBeenCalledTimes(3);
        expect(mocks.include).toHaveBeenCalledTimes(3);
        expect(mocks.include.mock.calls.map(([relacion]) => relacion)).toEqual([
            "publicacion",
            "pais",
            "operador",
        ]);
        expect(mocks.all).toHaveBeenCalledTimes(1);

        expect(predicadosEvaluados).toHaveLength(4);

        const filtroActiva = predicadosEvaluados[0];
        expect(filtroActiva.somePublicacion).toHaveBeenCalledTimes(1);
        expect(filtroActiva.eqActiva).toHaveBeenCalledWith(true);

        const filtroDisponible = predicadosEvaluados[1];
        expect(filtroDisponible.somePublicacion).toHaveBeenCalledTimes(1);
        expect(filtroDisponible.eqDisponible).toHaveBeenCalledWith(true);

        const filtroContrato = predicadosEvaluados[2];
        expect(filtroContrato.someOperador).toHaveBeenCalledTimes(1);
        expect(filtroContrato.someLocales).toHaveBeenCalledTimes(1);
        expect(filtroContrato.finContratoIsNull).toHaveBeenCalledTimes(1);

        const inicioHoy = Temporal.PlainDate.from("2026-10-16")
            .toZonedDateTime({
                timeZone: "America/Montevideo",
                plainTime: Temporal.PlainTime.from("00:00"),
            })
            .toInstant();

        expect(filtroContrato.finContratoGte).toHaveBeenCalledWith(inicioHoy);
        expect(mocks.or).toHaveBeenCalledTimes(1);
        expect(mocks.or).toHaveBeenCalledWith("finContrato.isNull", "finContrato.gte");

        const filtroPais = predicadosEvaluados[3];
        expect(filtroPais.somePais).toHaveBeenCalledTimes(1);
    });

    it("devuelve una lista vacía cuando el ORM no encuentra publicaciones", async () => {
        mocks.all.mockResolvedValue([]);

        await expect(consultarPublicaciones()).resolves.toEqual({
            publicaciones: [],
        });
    });

    it("transforma los tipos y mapea todos los datos de la publicación, operador y país", async () => {
        const fila = crearFilaValida();
        mocks.all.mockResolvedValue([fila]);

        const resultado = await consultarPublicaciones();

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
                tipoPublicacion: "OPERADOR",
                categoria: "I",
                calibre: "Grande",
                codigoCalibre: "G",
                pais: "Uruguay",
                operador: {
                    id: 7,
                    nombreFantasia: "Frutas del Sur",
                    whatsApp: "+59899111222",
                },
            },
        ]);
    });

    it("conserva precio, foto y cantidad de unidades nulos", async () => {
        const fila = crearFilaValida();
        fila.publicacion!.precio = null;
        fila.publicacion!.foto = null;
        fila.publicacion!.cantidadUnidades = null;
        mocks.all.mockResolvedValue([fila]);

        const resultado = await consultarPublicaciones();

        expect(resultado.publicaciones).toHaveLength(1);
        expect(resultado.publicaciones[0]).toMatchObject({
            precio: null,
            foto: null,
            cantidadUnidades: null,
        });
    });

    it("descarta filas sin publicación, operador o país", async () => {
        const sinPublicacion = {
            ...crearFilaValida(),
            publicacion: null,
        };
        const sinOperador = {
            ...crearFilaValida(),
            operador: null,
        };
        const sinPais = {
            ...crearFilaValida(),
            pais: null,
        };

        mocks.all.mockResolvedValue([sinPublicacion, sinOperador, sinPais]);

        const resultado = await consultarPublicaciones();

        expect(resultado.publicaciones).toEqual([]);
    });

    it("descarta filas sin presentación, variedad o especie", async () => {
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

        const resultado = await consultarPublicaciones();

        expect(resultado.publicaciones).toEqual([]);
    });

    it("descarta filas sin categoría o calibre", async () => {
        const sinCategoria = crearFilaValida();
        sinCategoria.publicacion!.categoria = null;

        const sinCalibre = crearFilaValida();
        sinCalibre.publicacion!.calibre = null;

        mocks.all.mockResolvedValue([sinCategoria, sinCalibre]);

        const resultado = await consultarPublicaciones();

        expect(resultado.publicaciones).toEqual([]);
    });

    it("conserva las filas válidas y descarta las inválidas en una misma consulta", async () => {
        const valida = crearFilaValida();
        const invalida = crearFilaValida();
        invalida.publicacion!.presentacion = null;

        mocks.all.mockResolvedValue([valida, invalida]);

        const resultado = await consultarPublicaciones();

        expect(resultado.publicaciones).toHaveLength(1);
        expect(resultado.publicaciones[0]).toMatchObject({
            id: 101,
            especie: "Manzana",
            operador: {
                id: 7,
                nombreFantasia: "Frutas del Sur",
            },
        });
    });

    it("propaga los errores producidos por la consulta del ORM", async () => {
        mocks.all.mockRejectedValue(new Error("Fallo de base de datos mockeado"));

        await expect(consultarPublicaciones()).rejects.toThrow(
            "Fallo de base de datos mockeado",
        );
    });
});
