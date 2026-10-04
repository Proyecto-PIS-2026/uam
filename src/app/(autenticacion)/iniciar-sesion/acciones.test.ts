// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import { iniciarSesion } from "./acciones";

const funcionesSimuladas = vi.hoisted(() => ({
    autenticarUsuario: vi.fn(),
    crearSesion: vi.fn(),
    redirect: vi.fn(),
    redireccion: new Error("REDIRECCION"),
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/autenticarUsuario", () => ({
    autenticarUsuario: funcionesSimuladas.autenticarUsuario,
}));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    crearSesion: funcionesSimuladas.crearSesion,
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

    it.each(["ADMINISTRADOR", "OPERADOR", "PRODUCTOR"] as const)(
        "inicia la sesion de %s usando el rol de la base",
        async (rol) => {
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
            expect(funcionesSimuladas.redirect).toHaveBeenCalledWith("/");
        },
    );

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
