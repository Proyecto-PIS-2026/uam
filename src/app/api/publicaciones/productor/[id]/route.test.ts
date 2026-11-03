
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { ErrorEdicionPublicacionProductor } from "@/modulos/publicaciones/productores/modificar-publicacion";
import { ErrorBajaPublicacionProductor } from "@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada";
import { LIMITE_FORMULARIO_PUBLICACION } from "@/infraestructura/http/cuerpo-limitado";

const mocks = vi.hoisted(() => {
    const consulta = () => ({
        all: vi.fn(),
        first: vi.fn(),
        where: vi.fn(),
        select: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    });

    return {
        sesion: vi.fn(),
        editable: vi.fn(),
        modificar: vi.fn(),
        opciones: vi.fn(),
        revalidatePath: vi.fn(),
        baja: vi.fn(),
        modelos: {
            Productor: consulta(),
            Usuario: consulta(),
            EstadisticaPublicacion: consulta(),
        },
    };
});

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.sesion,
}));

vi.mock("@/modulos/publicaciones/productores/modificar-publicacion", () => ({
    obtenerPublicacionProductorEditable: mocks.editable,
    modificarPublicacionProductor: mocks.modificar,
    ErrorEdicionPublicacionProductor: class extends Error {
        constructor(public codigo: string, mensaje: string) {
            super(mensaje);
        }
    },
}));

vi.mock("@/modulos/publicaciones/operadores/consultas-edicion-publicacion", () => ({
    obtenerOpcionesEdicionPublicacion: mocks.opciones,
}));

vi.mock("@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada", async () => {
    class ErrorBajaPublicacionProductor extends Error {
        readonly status = 404;
    }

    return {
        bajaPublicacionProductorAutorizada: mocks.baja,
        ErrorBajaPublicacionProductor,
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: mocks.modelos,
        },
    },
}));

vi.mock("next/cache", () => ({
    revalidatePath: mocks.revalidatePath,
}));

import { GET, PATCH, DELETE } from "./route";

const sesion = {
    usuarioId: 10,
    rol: "PRODUCTOR",
    expiraEn: 2000000000,
};

const contexto = {
    params: Promise.resolve({ id: "12" }),
};

const publicacion = {
    id: 20,
    publicacionProductorId: 12,
    precio: "125",
    fecha: "2026-10-21T12:00:00Z",
};

function configurarMocksBase() {
    vi.resetAllMocks();

    mocks.sesion.mockResolvedValue(sesion);
    mocks.editable.mockResolvedValue({ id: 12 });
    mocks.opciones.mockResolvedValue({
        categorias: [],
        presentaciones: [],
        calibres: [],
    });

    mocks.modificar.mockResolvedValue({
        publicacion,
        productorId: 3,
    });

    mocks.baja.mockResolvedValue({ productorId: 3 });

    for (const modelo of Object.values(mocks.modelos)) {
        modelo.where.mockReturnThis();
        modelo.select.mockReturnThis();
        modelo.all.mockResolvedValue([]);
        modelo.first.mockResolvedValue(null);
        modelo.update.mockResolvedValue(1);
        modelo.create.mockResolvedValue({ id: 30 });
    }

    mocks.modelos.Productor.first.mockResolvedValue({
        usuarioId: 30,
    });

    mocks.modelos.Usuario.first.mockResolvedValue({
        username: "productor3",
    });

    mocks.modelos.EstadisticaPublicacion.first.mockResolvedValue(null);
}

function solicitud(cambios: unknown = {
    precio: "125",
    presentacionId: 8,
    categoriaId: 4,
    calibreId: 2,
    ubicaciones: [],
}, foto?: File | string) {
    const formulario = new FormData();
    formulario.set("cambios", JSON.stringify(cambios));

    if (foto !== undefined) {
        formulario.set("foto", foto);
    }

    return new Request("http://localhost/api/publicaciones/productor/12", {
        method: "PATCH",
        body: formulario,
    });
}

function obtenerFiltroEstadistica() {
    return mocks.modelos.EstadisticaPublicacion.where.mock.calls[0]?.[0] as {
        fecha: { toString: () => string };
        username: string;
    };
}

function llamarEliminar(id: string) {
    return DELETE(
        new Request("http://localhost/api/publicaciones/productor"),
        { params: Promise.resolve({ id }) },
    );
}

beforeEach(() => {
    configurarMocksBase();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("GET /api/publicaciones/productor/[id]", () => {
    it("devuelve 401 si no existe una sesión", async () => {
        mocks.sesion.mockResolvedValue(null);

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toEqual({
            errores: ["Debe iniciar sesión."],
        });

        expect(mocks.editable).not.toHaveBeenCalled();
        expect(mocks.opciones).not.toHaveBeenCalled();
    });

    it("devuelve 403 para un rol que no puede editar publicaciones de productores", async () => {
        mocks.sesion.mockResolvedValue({
            ...sesion,
            rol: "OPERADOR",
        });

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({
            errores: ["No tenés permiso para modificar esta publicación."],
        });

        expect(mocks.editable).not.toHaveBeenCalled();
        expect(mocks.opciones).not.toHaveBeenCalled();
    });

    it.each(["0", "-1", "1.2", "abc", "2147483648", "9007199254740992", "1e2", "01"])(
        "rechaza el identificador inválido %s",
        async (id) => {
            const respuesta = await GET(
                solicitud(),
                { params: Promise.resolve({ id }) },
            );

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({
                errores: ["La publicación no es válida."],
            });

            expect(mocks.editable).not.toHaveBeenCalled();
            expect(mocks.opciones).not.toHaveBeenCalled();
        },
    );

    it("devuelve los catálogos después de comprobar que la publicación es editable", async () => {
        const opciones = {
            especies: [
                { id: 1, nombre: "Manzana" },
                { id: 2, nombre: "Pera" },
            ],
            variedades: [
                { id: 21, nombre: "Williams", especieId: 2 },
            ],
            presentaciones: [
                { id: 31, nombre: "Cajón", variedadId: 21 },
            ],
            categorias: [
                { id: 41, nombre: "Primera", especieId: 2 },
            ],
            calibres: [
                { id: 51, nombre: "Grande" },
            ],
            paises: [
                { id: 61, nombre: "Uruguay" },
                { id: 62, nombre: "Argentina" },
            ],
        };

        mocks.opciones.mockResolvedValue(opciones);

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ opciones });

        expect(mocks.editable).toHaveBeenCalledExactlyOnceWith(sesion, 12);
        expect(mocks.opciones).toHaveBeenCalledOnce();

        expect(mocks.editable.mock.invocationCallOrder[0]).toBeLessThan(
            mocks.opciones.mock.invocationCallOrder[0],
        );
    });

    it("devuelve 404 cuando la publicación no puede encontrarse o editarse", async () => {
        mocks.editable.mockRejectedValue(
            new ErrorEdicionPublicacionProductor("NO_ENCONTRADA", "La publicación no existe."),
        );

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(404);
        expect(await respuesta.json()).toEqual({
            errores: ["La publicación no existe."],
        });

        expect(mocks.opciones).not.toHaveBeenCalled();
    });

    it("devuelve 403 cuando el productor no puede editar la publicación", async () => {
        mocks.editable.mockRejectedValue(
            new ErrorAutorizacion(403, "Publicación ajena"),
        );

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({
            errores: ["Publicación ajena"],
        });

        expect(mocks.opciones).not.toHaveBeenCalled();
    });

    it("devuelve 400 cuando el identificador no es válido según el servicio de edición", async () => {
        mocks.editable.mockRejectedValue(
            new ErrorEdicionPublicacionProductor("DATOS_INVALIDOS", "Datos inválidos."),
        );

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({
            errores: ["Datos inválidos."],
        });

        expect(mocks.opciones).not.toHaveBeenCalled();
    });

    it("devuelve 500 cuando ocurre un error inesperado al cargar las opciones", async () => {
        mocks.opciones.mockRejectedValue(new Error("Error de base de datos"));

        const respuesta = await GET(solicitud(), contexto);

        expect(respuesta.status).toBe(500);
        expect(await respuesta.json()).toEqual({
            errores: ["No se pudo procesar la publicación."],
        });

        expect(console.error).toHaveBeenCalledOnce();
    });
});

describe("PATCH /api/publicaciones/productor/[id]", () => {
    it("exige una sesión validada", async () => {
        mocks.sesion.mockResolvedValue(null);

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toEqual({
            errores: ["Debe iniciar sesión."],
        });

        expect(mocks.modificar).not.toHaveBeenCalled();
        expect(mocks.editable).not.toHaveBeenCalled();
    });

    it("rechaza el rol operador antes de modificar", async () => {
        mocks.sesion.mockResolvedValue({
            ...sesion,
            rol: "OPERADOR",
        });

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({
            errores: ["No tenés permiso para modificar esta publicación."],
        });

        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it.each(["0", "-1", "1.2", "abc", "2147483648", "9007199254740992", "1e2", "01"])(
        "rechaza el identificador inválido %s",
        async (id) => {
            const respuesta = await PATCH(
                solicitud(),
                { params: Promise.resolve({ id }) },
            );

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({
                errores: ["La publicación no es válida."],
            });

            expect(mocks.modificar).not.toHaveBeenCalled();
        },
    );

    it("devuelve la publicación guardada y revalida las vistas", async () => {
        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ publicacion });

        expect(mocks.modificar).toHaveBeenCalledExactlyOnceWith(
            sesion,
            12,
            expect.objectContaining({ precio: "125" }),
            null,
        );

        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/productor");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/gestion-productores/3");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/publicaciones-productor");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/inicio");
    });

    it.each([0, 25, null])(
        "transfiere país, cantidad %s y disponibilidad sin perder valores falsos o nulos",
        async (cantidadUnidades) => {
            const cambios = {
                precio: null,
                presentacionId: 31,
                categoriaId: 41,
                calibreId: 51,
                paisId: 62,
                cantidadUnidades,
                disponible: false,
                ubicaciones: [],
            };

            const guardada = {
                ...publicacion,
                precio: null,
                paisId: 62,
                cantidadUnidades,
                publicacionDisponible: false,
            };

            mocks.modificar.mockResolvedValue({
                publicacion: guardada,
                productorId: 3,
            });

            const respuesta = await PATCH(solicitud(cambios), contexto);

            expect(respuesta.status).toBe(200);
            expect(mocks.modificar).toHaveBeenCalledExactlyOnceWith(
                sesion,
                12,
                cambios,
                null,
            );

            expect(await respuesta.json()).toEqual({
                publicacion: guardada,
            });
        },
    );

    it("transfiere al servicio la sesión de administrador", async () => {
        const admin = {
            ...sesion,
            rol: "ADMINISTRADOR",
            usuarioId: 1,
        };

        mocks.sesion.mockResolvedValue(admin);

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(mocks.modificar).toHaveBeenCalledExactlyOnceWith(
            admin,
            12,
            expect.any(Object),
            null,
        );
    });

    it("transfiere el archivo de fotografía al servicio", async () => {
        const fotografia = new File(
            ["foto simulada"],
            "nueva.jpg",
            { type: "image/jpeg" },
        );

        const respuesta = await PATCH(solicitud(undefined, fotografia), contexto);

        expect(respuesta.status).toBe(200);

        expect(mocks.modificar).toHaveBeenCalledExactlyOnceWith(
            sesion,
            12,
            expect.any(Object),
            expect.objectContaining({
                name: "nueva.jpg",
                type: "image/jpeg",
                size: 13,
            }),
        );
    });

    it.each([
        [new ErrorAutorizacion(403, "Publicación ajena"), 403],
        [new ErrorEdicionPublicacionProductor("NO_ENCONTRADA", "No existe"), 404],
        [new ErrorEdicionPublicacionProductor("DATOS_INVALIDOS", "Precio inválido"), 400],
    ] as const)("devuelve el error del servicio sin revalidar", async (error, status) => {
        mocks.modificar.mockRejectedValue(error);

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(status);
        expect(await respuesta.json()).toEqual({
            errores: [error.message],
        });

        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rechaza la solicitud si no contiene el campo cambios", async () => {
        const formulario = new FormData();

        const respuesta = await PATCH(
            new Request("http://localhost/api/publicaciones/productor/12", {
                method: "PATCH",
                body: formulario,
            }),
            contexto,
        );

        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({
            errores: ["No se pudieron leer los cambios de la publicación."],
        });

        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("rechaza JSON malformado", async () => {
        const formulario = new FormData();
        formulario.set("cambios", "{");

        const respuesta = await PATCH(
            new Request("http://localhost/api/publicaciones/productor/12", {
                method: "PATCH",
                body: formulario,
            }),
            contexto,
        );

        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({
            errores: ["No se pudieron leer los cambios de la publicación."],
        });

        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("rechaza un campo foto que no contiene un archivo", async () => {
        const respuesta = await PATCH(
            solicitud(undefined, "no-es-un-archivo"),
            contexto,
        );

        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({
            errores: ["No se pudieron leer los cambios de la publicación."],
        });

        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("rechaza con 413 el formulario demasiado grande", async () => {
        const peticion = new Request(
            "http://localhost/api/publicaciones/productor/12",
            {
                method: "PATCH",
                body: "cuerpo demasiado grande",
                headers: {
                    "content-type": "multipart/form-data; boundary=limite",
                    "content-length": String(LIMITE_FORMULARIO_PUBLICACION + 1),
                },
            },
        );

        const respuesta = await PATCH(peticion, contexto);

        expect(respuesta.status).toBe(413);
        expect(mocks.modificar).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("limita los bytes recibidos aunque no exista Content-Length", async () => {
        const peticion = new Request(
            "http://localhost/api/publicaciones/productor/12",
            {
                method: "PATCH",
                body: new Uint8Array(LIMITE_FORMULARIO_PUBLICACION + 1),
                headers: {
                    "content-type": "multipart/form-data; boundary=limite",
                },
            },
        );

        const respuesta = await PATCH(peticion, contexto);

        expect(respuesta.status).toBe(413);
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("registra una estadística nueva para el usuario del productor", async () => {
        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);

        expect(mocks.modelos.Productor.where).toHaveBeenCalledExactlyOnceWith({
            id: 3,
        });

        expect(mocks.modelos.Productor.select).toHaveBeenCalledExactlyOnceWith(
            "usuarioId",
        );

        expect(mocks.modelos.Usuario.select).toHaveBeenCalledExactlyOnceWith(
            "username",
        );

        expect(mocks.modelos.Usuario.where).toHaveBeenCalledExactlyOnceWith({
            id: 30,
        });

        const filtro = obtenerFiltroEstadistica();

        expect(filtro.username).toBe("productor3");
        expect(filtro.fecha.toString()).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00Z$/);

        expect(mocks.modelos.EstadisticaPublicacion.create).toHaveBeenCalledExactlyOnceWith(
            expect.objectContaining({
                fecha: expect.any(Object),
                username: "productor3",
                cantidad: 1,
            }),
        );

        expect(mocks.modelos.EstadisticaPublicacion.update).not.toHaveBeenCalled();
    });

    it("incrementa la estadística existente del productor", async () => {
        mocks.modelos.EstadisticaPublicacion.first.mockResolvedValue({
            id: 45,
            cantidad: 6,
        });

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);

        expect(mocks.modelos.EstadisticaPublicacion.where).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                fecha: expect.any(Object),
                username: "productor3",
            }),
        );

        expect(mocks.modelos.EstadisticaPublicacion.where).toHaveBeenNthCalledWith(
            2,
            { id: 45 },
        );

        expect(mocks.modelos.EstadisticaPublicacion.update).toHaveBeenCalledExactlyOnceWith({
            cantidad: 7,
        });

        expect(mocks.modelos.EstadisticaPublicacion.create).not.toHaveBeenCalled();
    });

    it("no registra estadísticas si no encuentra al productor", async () => {
        mocks.modelos.Productor.first.mockResolvedValue(null);

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(mocks.modelos.Usuario.select).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.where).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.create).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.update).not.toHaveBeenCalled();
    });

    it("no registra estadísticas si el productor no tiene un username vinculado", async () => {
        mocks.modelos.Usuario.first.mockResolvedValue(null);

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(mocks.modelos.EstadisticaPublicacion.where).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.create).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.update).not.toHaveBeenCalled();
    });

    it("confirma la modificación aunque falle la consulta del productor para registrar estadísticas", async () => {
        mocks.modelos.Productor.first.mockRejectedValue(
            new Error("Base de datos no disponible"),
        );

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ publicacion });

        expect(mocks.modificar).toHaveBeenCalledOnce();
        expect(console.error).toHaveBeenCalledWith(
            "Error al registrar estadística de publicación (modificación productor):",
            expect.any(Error),
        );

        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
    });

    it("confirma la modificación aunque falle la creación de la estadística", async () => {
        mocks.modelos.EstadisticaPublicacion.create.mockRejectedValue(
            new Error("No se pudo crear la estadística"),
        );

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ publicacion });

        expect(console.error).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
    });

    it("confirma la modificación aunque falle la actualización de la estadística", async () => {
        mocks.modelos.EstadisticaPublicacion.first.mockResolvedValue({
            id: 45,
            cantidad: 6,
        });

        mocks.modelos.EstadisticaPublicacion.update.mockRejectedValue(
            new Error("No se pudo actualizar la estadística"),
        );

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ publicacion });

        expect(console.error).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
    });

    it("confirma la edición aunque falle una revalidación posterior", async () => {
        mocks.revalidatePath.mockImplementationOnce(() => {
            throw new Error("Sin caché");
        });

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ publicacion });

        expect(mocks.modificar).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("devuelve 500 ante un error inesperado al modificar", async () => {
        mocks.modificar.mockRejectedValue(new Error("Fallo inesperado"));

        const respuesta = await PATCH(solicitud(), contexto);

        expect(respuesta.status).toBe(500);
        expect(await respuesta.json()).toEqual({
            errores: ["No se pudo procesar la publicación."],
        });

        expect(console.error).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });
});

describe("DELETE /api/publicaciones/productor/[id]", () => {
    it("elimina la publicación y revalida las vistas", async () => {
        const respuesta = await llamarEliminar("40");

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({
            mensaje: "Publicación eliminada correctamente.",
        });

        expect(mocks.baja).toHaveBeenCalledExactlyOnceWith(sesion, 40);

        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/productor");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/gestion-productores/3");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/publicaciones-productor");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/inicio");
    });

    it("responde 401 sin sesión", async () => {
        mocks.sesion.mockResolvedValue(null);

        const respuesta = await llamarEliminar("40");

        expect(respuesta.status).toBe(401);
        expect(await respuesta.json()).toEqual({
            errores: ["Debe iniciar sesión."],
        });

        expect(mocks.baja).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it.each([
        "0",
        "-1",
        "abc",
        "1.5",
        "01",
        "2147483648",
        "9007199254740992",
        "1e2",
    ])("responde 400 si el id %s no es válido", async (id) => {
        const respuesta = await llamarEliminar(id);

        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({
            errores: ["La publicación no es válida."],
        });

        expect(mocks.baja).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("responde 403 si no tiene permiso", async () => {
        mocks.baja.mockRejectedValue(
            new ErrorAutorizacion(403, "No tenés permiso para eliminar esta publicación."),
        );

        const respuesta = await llamarEliminar("40");

        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({
            errores: ["No tenés permiso para eliminar esta publicación."],
        });

        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("responde 404 si la publicación no existe", async () => {
        mocks.baja.mockRejectedValue(
            new ErrorBajaPublicacionProductor("La publicación no existe o ya fue eliminada."),
        );

        const respuesta = await llamarEliminar("40");

        expect(respuesta.status).toBe(404);
        expect(await respuesta.json()).toEqual({
            errores: ["La publicación no existe o ya fue eliminada."],
        });

        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("responde 500 ante un error inesperado", async () => {
        mocks.baja.mockRejectedValue(new Error("Falló"));

        const respuesta = await llamarEliminar("40");

        expect(respuesta.status).toBe(500);
        expect(await respuesta.json()).toEqual({
            errores: ["No se pudo eliminar la publicación."],
        });

        expect(console.error).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("no falla si una revalidación lanza un error", async () => {
        mocks.revalidatePath.mockImplementationOnce(() => {
            throw new Error("Sin caché");
        });

        const respuesta = await llamarEliminar("40");

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({
            mensaje: "Publicación eliminada correctamente.",
        });

        expect(mocks.baja).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).toHaveBeenCalledTimes(4);
        expect(console.error).toHaveBeenCalledOnce();
    });
});
