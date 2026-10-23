import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { ErrorEdicionPublicacionProductor } from "@/modulos/publicaciones/productores/modificar-publicacion";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({ sesion: vi.fn(), editable: vi.fn(), modificar: vi.fn(), opciones: vi.fn(), revalidatePath: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.sesion }));
vi.mock("@/modulos/publicaciones/productores/modificar-publicacion", () => ({
    obtenerPublicacionProductorEditable: mocks.editable, modificarPublicacionProductor: mocks.modificar,
    ErrorEdicionPublicacionProductor: class extends Error { constructor(public codigo: string, mensaje: string) { super(mensaje); } },
}));
vi.mock("@/modulos/publicaciones/operadores/consultas-edicion-publicacion", () => ({ obtenerOpcionesEdicionPublicacion: mocks.opciones }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const sesion = { usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 };
const contexto = { params: Promise.resolve({ id: "12" }) };
const publicacion = { id: 20, publicacionProductorId: 12, precio: "125", fecha: "2026-10-21T12:00:00Z" };

function solicitud(cambios = { precio: "125", presentacionId: 8, categoriaId: 4, calibreId: 2, ubicaciones: [] }) {
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
});

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
        const respuesta = await GET(solicitud(), contexto);
        expect(respuesta.status).toBe(200);
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
});
