// @vitest-environment node
 
import { beforeEach, describe, expect, it, vi } from "vitest";
import { iniciarSesion } from "./acciones";

const funcionesSimuladas = vi.hoisted(() => ({
    autenticarUsuario: vi.fn(),
    crearSesion: vi.fn(),
    cerrarSesion: vi.fn(),
    iniciarSegundoFactor: vi.fn(),
    guardarCookieSegundoFactor: vi.fn(),
    redirect: vi.fn(),
    redireccion: new Error("REDIRECCION"),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/autenticarUsuario", () => ({
    autenticarUsuario: funcionesSimuladas.autenticarUsuario,
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    crearSesion: funcionesSimuladas.crearSesion,
    cerrarSesion: funcionesSimuladas.cerrarSesion,
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/segundo-factor", () => ({
    iniciarSegundoFactor: funcionesSimuladas.iniciarSegundoFactor,
    cancelarSegundoFactor: vi.fn(),
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/cookie-segundo-factor", () => ({
    obtenerTokenSegundoFactor: vi.fn(async () => ""),
    borrarCookieSegundoFactor: vi.fn(),
    guardarCookieSegundoFactor: funcionesSimuladas.guardarCookieSegundoFactor,
}));
vi.mock("next/navigation", () => ({ redirect: funcionesSimuladas.redirect }));

function crearFormulario(
    identificador: string | Blob | null = "huerta_productora",
    contrasena: string | Blob | null = "contrasena-de-prueba",
) {
    const formulario = new FormData();
    if (identificador !== null) formulario.set("identificador", identificador);
    if (contrasena !== null) formulario.set("contrasena", contrasena);
    return formulario;
}

describe("iniciarSesion", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        funcionesSimuladas.autenticarUsuario.mockResolvedValue(null);
        funcionesSimuladas.crearSesion.mockResolvedValue(undefined);
        funcionesSimuladas.redirect.mockImplementation(() => {
            throw funcionesSimuladas.redireccion;
        });
    });

    it.each([
        { identificador: null, contrasena: "clave" },
        { identificador: "", contrasena: "clave" },
        { identificador: "   ", contrasena: "clave" },
        { identificador: "usuario", contrasena: null },
        { identificador: "usuario", contrasena: "" },
        { identificador: new Blob(["usuario"]), contrasena: "clave" },
        { identificador: "usuario", contrasena: new Blob(["clave"]) },
    ])("rechaza credenciales incompletas o de tipo incorrecto: %#", async (datos) => {
        const formulario = crearFormulario(datos.identificador, datos.contrasena);

        expect(await iniciarSesion({}, formulario))
            .toEqual({ error: "Ingresá tus credenciales para continuar." });
        expect(funcionesSimuladas.autenticarUsuario).not.toHaveBeenCalled();
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });

    it("devuelve un error generico si las credenciales no son validas", async () => {
        expect(await iniciarSesion({}, crearFormulario()))
            .toEqual({ error: "Las credenciales ingresadas no son correctas." });
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });

    it.each([
        ["OPERADOR", "/mi-mercado"],
        ["PRODUCTOR", "/mi-mercado/productor"],
    ] as const)(
        "inicia la sesion de %s usando el rol de la base",
        async (rol, destino) => {
            funcionesSimuladas.autenticarUsuario.mockResolvedValue({ usuarioId: 4, rol });
            const formulario = crearFormulario("  identificador  ", " clave con espacios ");
            formulario.set("rol", "ADMINISTRADOR");

            await expect(iniciarSesion({}, formulario))
                .rejects.toBe(funcionesSimuladas.redireccion);
            expect(funcionesSimuladas.autenticarUsuario).toHaveBeenCalledWith({
                identificador: "identificador",
                contrasena: " clave con espacios ",
            });
            expect(funcionesSimuladas.crearSesion).toHaveBeenCalledWith(4, rol);
            expect(funcionesSimuladas.redirect).toHaveBeenCalledWith(destino);
        },
    );

    it("solicita el segundo factor sin crear una sesión administrativa", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({ usuarioId: 4, rol: "ADMINISTRADOR" });
        funcionesSimuladas.iniciarSegundoFactor.mockResolvedValue({ token: "token-pendiente" });
        await expect(iniciarSesion({}, crearFormulario())).rejects.toBe(funcionesSimuladas.redireccion);
        expect(funcionesSimuladas.cerrarSesion).toHaveBeenCalled();
        expect(funcionesSimuladas.iniciarSegundoFactor).toHaveBeenCalledWith(4);
        expect(funcionesSimuladas.guardarCookieSegundoFactor).toHaveBeenCalledWith("token-pendiente");
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.redirect).toHaveBeenCalledWith("/iniciar-sesion/segundo-factor");
    });

    it("no permite reiniciar la verificación de una cuenta bloqueada", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({ usuarioId: 4, rol: "ADMINISTRADOR" });
        funcionesSimuladas.iniciarSegundoFactor.mockResolvedValue({ error: "Cuenta bloqueada" });
        expect(await iniciarSesion({}, crearFormulario())).toEqual({ error: "Cuenta bloqueada" });
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
        expect(funcionesSimuladas.guardarCookieSegundoFactor).not.toHaveBeenCalled();
    });

    it("no crea una sesion si falla la consulta de autenticacion", async () => {
        funcionesSimuladas.autenticarUsuario.mockRejectedValue(new Error("Base no disponible"));

        await expect(iniciarSesion({}, crearFormulario())).rejects.toThrow("Base no disponible");
        expect(funcionesSimuladas.crearSesion).not.toHaveBeenCalled();
    });

    it("no redirige si falla la creacion de la sesion", async () => {
        funcionesSimuladas.autenticarUsuario.mockResolvedValue({ usuarioId: 4, rol: "PRODUCTOR" });
        funcionesSimuladas.crearSesion.mockRejectedValue(new Error("Falta el secreto"));

        await expect(iniciarSesion({}, crearFormulario())).rejects.toThrow("Falta el secreto");
        expect(funcionesSimuladas.redirect).not.toHaveBeenCalled();
    });
});
