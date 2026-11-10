import { obtenerSesion, type RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { actualizarConfiguracion, obtenerConfiguracion } from "@/modulos/administracion/acciones/consultas-configuracion";
import { GET, PATCH } from "./route";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: vi.fn() }));
vi.mock("@/modulos/administracion/acciones/consultas-configuracion", () => ({
    actualizarConfiguracion: vi.fn(),
    obtenerConfiguracion: vi.fn(),
}));

const sesionMock = vi.mocked(obtenerSesion);
const actualizarMock = vi.mocked(actualizarConfiguracion);
const obtenerMock = vi.mocked(obtenerConfiguracion);

function solicitud(valor: string) {
    return new Request("http://localhost/api/configuracion/incremento_precio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ valor }),
    });
}

const contexto = { params: Promise.resolve({ nombre: "incremento_precio" }) };

describe("configuración general por API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        sesionMock.mockResolvedValue(null);
        actualizarMock.mockImplementation(async (_nombre, valor) => valor);
        obtenerMock.mockResolvedValue("25");
    });

    it.each([
        { rol: null, estado: 401 },
        { rol: "OPERADOR", estado: 403 },
        { rol: "PRODUCTOR", estado: 403 },
    ] as const)("rechaza PATCH con rol $rol antes de leer o modificar datos", async ({ rol, estado }) => {
        if (rol) sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        const request = solicitud("25");
        const leerCuerpo = vi.spyOn(request, "json");

        const respuesta = await PATCH(request, contexto);

        expect(respuesta.status).toBe(estado);
        expect(leerCuerpo).not.toHaveBeenCalled();
        expect(actualizarMock).not.toHaveBeenCalled();
        expect(obtenerMock).not.toHaveBeenCalled();
    });

    it("permite guardar la configuración con sesión de administrador", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });

        const respuesta = await PATCH(solicitud("25"), contexto);

        expect(respuesta.status).toBe(200);
        expect(actualizarMock).toHaveBeenCalledWith("incremento_precio", "25");
        expect(await respuesta.json()).toMatchObject({ nombre: "incremento_precio", valor: "25" });
    });

    it("conserva la validación del incremento luego de autorizar al administrador", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });

        const respuesta = await PATCH(solicitud("0"), contexto);

        expect(respuesta.status).toBe(400);
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each([null, "OPERADOR"] as (RolUsuario | null)[])(
        "mantiene disponible la consulta pública con rol %s",
        async (rol) => {
            if (rol) sesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 }); 
            const respuesta = await GET(new Request("http://localhost/api/configuracion/incremento_precio"), contexto);
            expect(respuesta.status).toBe(200);
            expect(obtenerMock).toHaveBeenCalledWith("incremento_precio");
            expect(actualizarMock).not.toHaveBeenCalled();
        },
    );

    it("devuelve 404 cuando la configuración consultada no existe", async () => {
        obtenerMock.mockResolvedValue(null);
        const respuesta = await GET(new Request("http://localhost/api/configuracion/inexistente"), { params: Promise.resolve({ nombre: "inexistente" }) });
        expect(respuesta.status).toBe(404);
        expect(await respuesta.json()).toEqual({ errores: ["No se encontró la configuración."] });
    });

    it("devuelve una configuración con valor vacío", async () => {
        obtenerMock.mockResolvedValue("");
        const respuesta = await GET(new Request("http://localhost/api/configuracion/url_lista_inteligente"), { params: Promise.resolve({ nombre: "url_lista_inteligente" }) });
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({ nombre: "url_lista_inteligente", valor: "" });
    });

    it("devuelve 500 si falla la consulta de configuración", async () => {
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        obtenerMock.mockRejectedValueOnce(new Error("Error de base"));
        try {
            const respuesta = await GET(new Request("http://localhost/api/configuracion/incremento_precio"), contexto);
            expect(respuesta.status).toBe(500);
            expect(await respuesta.json()).toEqual({ errores: ["No se pudo obtener la configuración."] });
            expect(registrar).toHaveBeenCalledOnce();
        } finally {
            registrar.mockRestore();
        }
    });

    it("rechaza un cuerpo que no contiene JSON válido", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const request = new Request("http://localhost/api/configuracion/incremento_precio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: "{invalido" });
        const respuesta = await PATCH(request, contexto);
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ errores: ["Los datos no son válidos."] });
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each([null, [], "texto", 10, true])("rechaza el cuerpo inválido %j", async (cuerpo) => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const request = new Request("http://localhost/api/configuracion/incremento_precio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
        const respuesta = await PATCH(request, contexto);
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ errores: ["Los datos no son válidos."] });
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each([{}, { valor: null }, { valor: 25 }, { valor: true }, { valor: [] }])("rechaza un valor que no es texto: %j", async (cuerpo) => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const request = new Request("http://localhost/api/configuracion/incremento_precio", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
        const respuesta = await PATCH(request, contexto);
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ errores: ["El valor no es válido."] });
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it("rechaza modificar una configuración no permitida por este endpoint", async () => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const respuesta = await PATCH(solicitud("true"), { params: Promise.resolve({ nombre: "desconocida" }) });
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ errores: ["La configuración indicada no es válida."] });
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each(["", "-1", "1.5", "abc", "0", "9007199254740992"])("rechaza el incremento inválido %j", async (valor) => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const respuesta = await PATCH(solicitud(valor), contexto);
        expect(respuesta.status).toBe(400);
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each(["https://uam.com.uy/lista.pdf", "http://uam.com.uy/lista.pdf"])("permite guardar la URL %j", async (valor) => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const respuesta = await PATCH(solicitud(valor), { params: Promise.resolve({ nombre: "url_lista_inteligente" }) });
        expect(respuesta.status).toBe(200);
        expect(actualizarMock).toHaveBeenCalledWith("url_lista_inteligente", valor);
        expect(await respuesta.json()).toMatchObject({ nombre: "url_lista_inteligente", valor });
    });

    it.each(["", "   ", "\t\r\n"])("rechaza una URL vacía %j sin reemplazar la configuración guardada", async (valor) => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const respuesta = await PATCH(solicitud(valor), { params: Promise.resolve({ nombre: "url_lista_inteligente" }) });
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ errores: ["La URL de la Lista Inteligente no puede estar vacía."] });
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it.each(["no-es-una-url", "ftp://uam.com.uy/lista.pdf", "javascript:alert(1)", " https://uam.com.uy", "https://uam.com.uy "])("rechaza la URL inválida %j", async (valor) => {
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        const respuesta = await PATCH(solicitud(valor), { params: Promise.resolve({ nombre: "url_lista_inteligente" }) });
        expect(respuesta.status).toBe(400);
        expect(actualizarMock).not.toHaveBeenCalled();
    });

    it("devuelve 500 si falla la actualización", async () => {
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);
        sesionMock.mockResolvedValue({ usuarioId: 5, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
        actualizarMock.mockRejectedValueOnce(new Error("Error de base"));
        try {
            const respuesta = await PATCH(solicitud("25"), contexto);
            expect(respuesta.status).toBe(500);
            expect(await respuesta.json()).toEqual({ errores: ["No se pudo modificar la configuración."] });
            expect(registrar).toHaveBeenCalledOnce();
        } finally {
            registrar.mockRestore();
        }
    });

    it("propaga errores inesperados al comprobar la sesión", async () => {
        const error = new Error("Error al consultar la sesión");
        sesionMock.mockRejectedValueOnce(error);
        await expect(PATCH(solicitud("25"), contexto)).rejects.toBe(error);
        expect(actualizarMock).not.toHaveBeenCalled();
    });
});
