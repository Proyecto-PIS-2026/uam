import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { ErrorEdicionPublicacionProductor } from "@/modulos/publicaciones/productores/modificar-publicacion";
import { DELETE, GET, PATCH } from "./route";
import { ErrorBajaPublicacionProductor } from "@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada";
import { LIMITE_FORMULARIO_PUBLICACION } from "@/infraestructura/http/cuerpo-limitado";

const mocks = vi.hoisted(() => ({ sesion: vi.fn(), editable: vi.fn(), modificar: vi.fn(), opciones: vi.fn(), revalidatePath: vi.fn(), baja: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.sesion }));
vi.mock("@/modulos/publicaciones/productores/modificar-publicacion", () => ({
    obtenerPublicacionProductorEditable: mocks.editable, modificarPublicacionProductor: mocks.modificar,
    ErrorEdicionPublicacionProductor: class extends Error { constructor(public codigo: string, mensaje: string) { super(mensaje); } },
}));
vi.mock("@/modulos/publicaciones/operadores/consultas-edicion-publicacion", () => ({ obtenerOpcionesEdicionPublicacion: mocks.opciones }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

vi.mock("@/modulos/publicaciones/productores/bajaPublicacionProductorAutorizada", async () => {
    class ErrorBajaPublicacionProductor extends Error {
        readonly status = 404;
    }
    return { bajaPublicacionProductorAutorizada: mocks.baja, ErrorBajaPublicacionProductor };
});

const sesion = { usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 };
const contexto = { params: Promise.resolve({ id: "12" }) };
const publicacion = { id: 20, publicacionProductorId: 12, precio: "125", fecha: "2026-10-21T12:00:00Z" };

function solicitud(cambios: unknown = { precio: "125", presentacionId: 8, categoriaId: 4, calibreId: 2, ubicaciones: [] }) {
    const formulario = new FormData();
    formulario.set("cambios", JSON.stringify(cambios));
    return new Request("http://localhost/api/publicaciones/productor/12", { method: "PATCH", body: formulario });
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.sesion.mockResolvedValue(sesion);
    mocks.editable.mockResolvedValue({ id: 12 });
    mocks.opciones.mockResolvedValue({ categorias: [], presentaciones: [], calibres: [] });
    mocks.modificar.mockResolvedValue({ publicacion, productorId: 3 });
    mocks.baja.mockResolvedValue({ productorId: 3 });
});

afterEach(() => vi.restoreAllMocks());

describe("API de edición de publicaciones del productor", () => {
    it.each([GET, PATCH])("exige una sesión validada para cada operación", async (handler) => {
        mocks.sesion.mockResolvedValue(null);
        const respuesta = await handler(solicitud(), contexto);
        expect(respuesta.status).toBe(401);
        expect(mocks.editable).not.toHaveBeenCalled();
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it.each([GET, PATCH])("rechaza el rol operador antes de acceder a los datos", async (handler) => {
        mocks.sesion.mockResolvedValue({ ...sesion, rol: "OPERADOR" });
        expect((await handler(solicitud(), contexto)).status).toBe(403);
        expect(mocks.opciones).not.toHaveBeenCalled();
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it.each(["0", "-1", "1.2", "abc", "2147483648", "9007199254740992", "1e2"])("rechaza identificador inválido %s", async (id) => {
        expect((await PATCH(solicitud(), { params: Promise.resolve({ id }) })).status).toBe(400);
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("ofrece los catálogos sólo después de comprobar el dueño en el servidor", async () => {
        const opciones = {
            especies: [{ id: 1, nombre: "Manzana" }, { id: 2, nombre: "Pera" }],
            variedades: [{ id: 21, nombre: "Williams", especieId: 2 }],
            presentaciones: [{ id: 31, nombre: "Cajón", variedadId: 21 }],
            categorias: [{ id: 41, nombre: "Primera", especieId: 2 }],
            calibres: [{ id: 51, nombre: "Grande" }],
            paises: [{ id: 61, nombre: "Uruguay" }, { id: 62, nombre: "Argentina" }],
        };
        mocks.opciones.mockResolvedValue(opciones);
        const respuesta = await GET(solicitud(), contexto);
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ opciones });
        expect(mocks.editable).toHaveBeenCalledExactlyOnceWith(sesion, 12);
        expect(mocks.editable.mock.invocationCallOrder[0]).toBeLessThan(mocks.opciones.mock.invocationCallOrder[0]);
        mocks.editable.mockRejectedValue(new ErrorAutorizacion(403, "Publicación ajena"));
        mocks.opciones.mockClear();
        expect((await GET(solicitud(), contexto)).status).toBe(403);
        expect(mocks.opciones).not.toHaveBeenCalled();
    });

    it("devuelve la publicación guardada y revalida las vistas de productor y administrador", async () => {
        const respuesta = await PATCH(solicitud(), contexto);
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ publicacion });
        expect(mocks.modificar).toHaveBeenCalledWith(sesion, 12, expect.objectContaining({ precio: "125" }), null);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/mi-mercado/productor");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/gestion-productores/3");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/publicaciones-productor");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/inicio");
    });

    it.each([0, 25, null])("transfiere país, cantidad %s y disponibilidad sin perder valores falsos o nulos", async (cantidadUnidades) => {
        const cambios = {
            precio: null, presentacionId: 31, categoriaId: 41, calibreId: 51,
            paisId: 62, cantidadUnidades, disponible: false, ubicaciones: [],
        };
        const guardada = { ...publicacion, precio: null, paisId: 62, cantidadUnidades, publicacionDisponible: false };
        mocks.modificar.mockResolvedValue({ publicacion: guardada, productorId: 3 });

        const respuesta = await PATCH(solicitud(cambios), contexto);

        expect(respuesta.status).toBe(200);
        expect(mocks.modificar).toHaveBeenCalledExactlyOnceWith(sesion, 12, cambios, null);
        expect(await respuesta.json()).toEqual({ publicacion: guardada });
    });

    it("transfiere al servicio la sesión de administrador sin aceptar otra identidad del formulario", async () => {
        const admin = { ...sesion, rol: "ADMINISTRADOR", usuarioId: 1 };
        mocks.sesion.mockResolvedValue(admin);
        expect((await PATCH(solicitud(), contexto)).status).toBe(200);
        expect(mocks.modificar).toHaveBeenCalledWith(admin, 12, expect.any(Object), null);
    });

    it.each([
        [new ErrorAutorizacion(403, "Publicación ajena"), 403],
        [new ErrorEdicionPublicacionProductor("NO_ENCONTRADA", "No existe"), 404],
        [new ErrorEdicionPublicacionProductor("DATOS_INVALIDOS", "Precio inválido"), 400],
    ] as const)("devuelve el error del servicio sin revalidar", async (error, status) => {
        mocks.modificar.mockRejectedValue(error);
        const respuesta = await PATCH(solicitud(), contexto);
        expect(respuesta.status).toBe(status);
        expect(await respuesta.json()).toEqual({ errores: [error.message] });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rechaza JSON malformado", async () => {
        const formulario = new FormData();
        formulario.set("cambios", "{");
        const respuesta = await PATCH(new Request("http://localhost/api/publicaciones/productor/12", { method: "PATCH", body: formulario }), contexto);
        expect(respuesta.status).toBe(400);
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("rechaza con 413 el formulario demasiado grande antes de modificar", async () => {
        const peticion = new Request("http://localhost/api/publicaciones/productor/12", {
            method: "PATCH", body: "cuerpo demasiado grande",
            headers: { "content-type": "multipart/form-data; boundary=limite", "content-length": String(LIMITE_FORMULARIO_PUBLICACION + 1) },
        });

        const respuesta = await PATCH(peticion, contexto);

        expect(respuesta.status).toBe(413);
        expect(mocks.modificar).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("limita los bytes recibidos aunque no exista Content-Length", async () => {
        const peticion = new Request("http://localhost/api/publicaciones/productor/12", {
            method: "PATCH", body: new Uint8Array(LIMITE_FORMULARIO_PUBLICACION + 1),
            headers: { "content-type": "multipart/form-data; boundary=limite" },
        });

        expect((await PATCH(peticion, contexto)).status).toBe(413);
        expect(mocks.modificar).not.toHaveBeenCalled();
    });
});

const llamar = (id: string) => DELETE(new Request("http://localhost/api"), { params: Promise.resolve({ id }) });

describe("DELETE /api/publicaciones/productor/[id]", () => {
    it("elimina la publicación y revalida las vistas", async () => {
        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ mensaje: "Publicación eliminada correctamente." });
        expect(mocks.baja).toHaveBeenCalledExactlyOnceWith(sesion, 40);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/gestion-productores/3");
    });

    it("responde 401 sin sesión", async () => {
        mocks.sesion.mockResolvedValue(null);

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(401);
        expect(mocks.baja).not.toHaveBeenCalled();
    });

    it.each(["0", "-1", "abc", "1.5", "2147483648"])("responde 400 si el id %s no es válido", async (id) => {
        const respuesta = await llamar(id);

        expect(respuesta.status).toBe(400);
        expect(mocks.baja).not.toHaveBeenCalled();
    });

    it("responde 403 si no tiene permiso", async () => {
        mocks.baja.mockRejectedValue(new ErrorAutorizacion(403, "No tenés permiso para eliminar esta publicación."));

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(403);
        expect((await respuesta.json()).errores[0]).toBe("No tenés permiso para eliminar esta publicación.");
    });

    it("responde 404 si la publicación no existe", async () => {
        mocks.baja.mockRejectedValue(new ErrorBajaPublicacionProductor("La publicación no existe o ya fue eliminada."));

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(404);
    });

    it("responde 500 ante un error inesperado", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.baja.mockRejectedValue(new Error("falló"));

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(500);
    });

    it("no falla si la revalidación lanza un error", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.revalidatePath.mockImplementation(() => { throw new Error("sin caché"); });

        const respuesta = await llamar("40");

        expect(respuesta.status).toBe(200);
    });
});
