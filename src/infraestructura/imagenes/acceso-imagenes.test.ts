import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/publicaciones/imagenes/[publicacionId]/[archivo]/route";
import { GET as obtenerOtraImagen } from "@/app/api/imagenes/[categoria]/[id]/[archivo]/route";

const mocks = vi.hoisted(() => ({
    sesion: vi.fn(), leer: vi.fn(), publicacion: vi.fn(), productor: vi.fn(), relacionProductor: vi.fn(),
    operador: vi.fn(), relacionOperador: vi.fn(), especie: vi.fn(), locales: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.sesion }));
vi.mock("./imagenes", () => ({ imagenes: { leer: mocks.leer } }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => {
    function entidad(consulta: (filtro: unknown) => unknown) {
        return { select: () => ({ where: (filtro: unknown) => ({ first: () => consulta(filtro), all: () => consulta(filtro) }) }) };
    }
    return { db: { orm: { public: {
        Publicacion: entidad(mocks.publicacion), Productor: entidad(mocks.productor),
        PublicacionProductor: entidad(mocks.relacionProductor), Operador: entidad(mocks.operador),
        PublicacionOperador: entidad(mocks.relacionOperador), Especie: entidad(mocks.especie), Local: entidad(mocks.locales),
    } } } };
});

const ARCHIVO = "12345678-1234-4234-8234-123456789abc.webp";
const URL = `/api/publicaciones/imagenes/42/${ARCHIVO}`;
function pedir(id = "42", archivo = ARCHIVO) {
    return GET(new Request(`http://localhost${URL}`), { params: Promise.resolve({ publicacionId: id, archivo }) });
}
function pedirPerfil(categoria: string, id = "9") {
    return obtenerOtraImagen(new Request("http://localhost/api/imagenes"), { params: Promise.resolve({ categoria, id, archivo: ARCHIVO }) });
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.sesion.mockResolvedValue(null);
    mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "OPERADOR", publicacionActiva: true, publicacionDisponible: true });
    mocks.relacionOperador.mockResolvedValue({ operadorId: 5 });
    mocks.locales.mockResolvedValue([{ finContrato: null }]);
    mocks.leer.mockResolvedValue(Buffer.from("imagen"));
});

describe("acceso a imágenes", () => {
    it("sirve la foto pública con protección frente a cachés y tipos incorrectos", async () => {
        const respuesta = await pedir();
        expect(respuesta.status).toBe(200);
        expect(respuesta.headers.get("Content-Type")).toBe("image/webp");
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
        expect(respuesta.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(await respuesta.text()).toBe("imagen");
    });

    it("mantiene el acceso de operadores limitado a sus publicaciones", async () => {
        mocks.sesion.mockResolvedValue({ rol: "OPERADOR", usuarioId: 88 });
        mocks.operador.mockResolvedValue(null);
        expect((await pedir()).status).toBe(404);
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it.each([null, { rol: "OPERADOR", usuarioId: 88 }, { rol: "ADMINISTRADOR", usuarioId: 1 }])("oculta fotografías de productores a otras personas", async (sesion) => {
        mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "PRODUCTOR" });
        mocks.sesion.mockResolvedValue(sesion);
        expect((await pedir()).status).toBe(404);
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it("un productor solo accede al archivo de su publicación", async () => {
        mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "PRODUCTOR" });
        mocks.sesion.mockResolvedValue({ rol: "PRODUCTOR", usuarioId: 20 });
        mocks.productor.mockResolvedValue({ id: 9 });
        mocks.relacionProductor.mockImplementation((filtro) => filtro.productorId === 9 ? { id: 1 } : null);
        expect((await pedir()).status).toBe(200);
        expect(mocks.productor).toHaveBeenCalledWith({ usuarioId: 20 });
        expect(mocks.relacionProductor).toHaveBeenCalledWith({ publicacionId: 42, productorId: 9 });
    });

    it("rechaza el archivo de otro productor aunque conozca la URL", async () => {
        mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "PRODUCTOR" });
        mocks.sesion.mockResolvedValue({ rol: "PRODUCTOR", usuarioId: 21 });
        mocks.productor.mockResolvedValue({ id: 10 });
        mocks.relacionProductor.mockResolvedValue(null);
        expect((await pedir()).status).toBe(404);
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it.each([null, { foto: URL.replace(ARCHIVO, "otro.webp"), tipoPublicacion: "OPERADOR" }])("no entrega restos de una publicación eliminada o una foto reemplazada", async (publicacion) => {
        mocks.publicacion.mockResolvedValue(publicacion);
        expect((await pedir()).status).toBe(404);
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it("oculta publicaciones sin contrato vigente a visitantes", async () => {
        mocks.locales.mockResolvedValue([]);
        expect((await pedir()).status).toBe(404);
    });

    it("permite al dueño consultar la foto de una publicación no disponible", async () => {
        mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "OPERADOR", publicacionActiva: true, publicacionDisponible: false });
        mocks.sesion.mockResolvedValue({ rol: "OPERADOR", usuarioId: 20 });
        mocks.operador.mockResolvedValue({ id: 5 });
        expect((await pedir()).status).toBe(200);
        expect(mocks.operador).toHaveBeenCalledWith({ id: 5, usuarioId: 20 });
    });

    it("no entrega una publicación no disponible al operador equivocado", async () => {
        mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "OPERADOR", publicacionDisponible: false });
        mocks.sesion.mockResolvedValue({ rol: "OPERADOR", usuarioId: 21 });
        mocks.operador.mockResolvedValue(null);
        expect((await pedir()).status).toBe(404);
    });

    it("mantiene la consulta administrativa de fotografías de operadores", async () => {
        mocks.publicacion.mockResolvedValue({ foto: URL, tipoPublicacion: "OPERADOR", publicacionDisponible: false });
        mocks.sesion.mockResolvedValue({ rol: "ADMINISTRADOR", usuarioId: 1 });
        expect((await pedir()).status).toBe(200);
    });

    it.each(["0", "-1", "1.5", "abc", "9007199254740992"])("rechaza identificadores inválidos %s", async (id) => {
        expect((await pedir(id)).status).toBe(404);
        expect(mocks.leer).not.toHaveBeenCalled();
    });

    it("rechaza intentos de recorrer directorios", async () => {
        expect((await pedir("42", `../${ARCHIVO}`)).status).toBe(404);
        expect(mocks.publicacion).not.toHaveBeenCalled();
    });

    it("responde 404 si el archivo referenciado ya no existe", async () => {
        mocks.leer.mockRejectedValue(Object.assign(new Error("Ausente"), { code: "ENOENT" }));
        expect((await pedir()).status).toBe(404);
    });

    it("propaga fallos de almacenamiento inesperados", async () => {
        const error = Object.assign(new Error("Permisos"), { code: "EACCES" });
        mocks.leer.mockRejectedValue(error);
        await expect(pedir()).rejects.toBe(error);
    });

    it("protege también la foto de perfil del productor", async () => {
        mocks.sesion.mockResolvedValue({ rol: "PRODUCTOR", usuarioId: 20 });
        mocks.productor.mockResolvedValue({ fotoPerfil: `/api/imagenes/productores/9/${ARCHIVO}` });
        expect((await pedirPerfil("productores")).status).toBe(200);
        expect(mocks.productor).toHaveBeenCalledWith({ id: 9, usuarioId: 20 });
        mocks.productor.mockResolvedValue(null);
        expect((await pedirPerfil("productores")).status).toBe(404);
    });

    it("sirve las fotos vigentes de especies y operadores desde el mismo almacenamiento", async () => {
        mocks.especie.mockResolvedValue({ fotoEspecie: `/api/imagenes/especies/9/${ARCHIVO}`, especieActiva: true });
        mocks.operador.mockResolvedValue({ fotoPerfil: `/api/imagenes/operadores/9/${ARCHIVO}` });
        expect((await pedirPerfil("especies")).status).toBe(200);
        expect((await pedirPerfil("operadores")).status).toBe(200);
    });

    it.each(["publicaciones", "otro", ".."])("no crea rutas alternativas para %s", async (categoria) => {
        expect((await pedirPerfil(categoria)).status).toBe(404);
        expect(mocks.leer).not.toHaveBeenCalled();
    });
});
