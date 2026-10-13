import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    iniciarSesion,
    solicitarRecuperacion,
    type EstadoInicioSesion,
} from "./acciones";
import FormularioInicioSesion from "./formularioInicioSesion";

vi.mock("./acciones", () => ({
    iniciarSesion: vi.fn(),
    solicitarRecuperacion: vi.fn(),
}));

const iniciarSesionSimulado = vi.mocked(iniciarSesion);
const solicitarRecuperacionSimulada = vi.mocked(solicitarRecuperacion);

function completarYEnviarFormulario() {
    fireEvent.change(screen.getByLabelText("Correo electrónico o nombre de usuario"), {
        target: { value: "huerta_productora" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
        target: { value: "contrasena-de-prueba" },
    });
    const boton = screen.getByRole("button", { name: "Iniciar sesión" });
    fireEvent.submit(boton.closest("form")!);
}

describe("FormularioInicioSesion", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        iniciarSesionSimulado.mockResolvedValue({});
        solicitarRecuperacionSimulada.mockResolvedValue({});
    });

    afterEach(cleanup);

    it("solicita identificador y contrasena sin selector de rol", () => {
        render(<FormularioInicioSesion />);

        const identificador = screen.getByLabelText("Correo electrónico o nombre de usuario");
        const contrasena = screen.getByLabelText("Contraseña");

        expect(identificador).toHaveAttribute("type", "text");
        expect(identificador).toHaveAttribute("autocomplete", "username");
        expect(identificador).toBeRequired();
        expect(contrasena).toHaveAttribute("type", "password");
        expect(contrasena).toHaveAttribute("autocomplete", "current-password");
        expect(contrasena).toBeRequired();
        expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("envia las credenciales del productor sin un rol elegido por el cliente", async () => {
        render(<FormularioInicioSesion />);
        completarYEnviarFormulario();

        await waitFor(() => expect(iniciarSesionSimulado).toHaveBeenCalledOnce());
        const formulario = iniciarSesionSimulado.mock.calls[0][1];
        expect(formulario.get("identificador")).toBe("huerta_productora");
        expect(formulario.get("contrasena")).toBe("contrasena-de-prueba");
        expect(formulario.has("rol")).toBe(false);
    });

    it("muestra el error devuelto por el servidor", async () => {
        iniciarSesionSimulado.mockResolvedValue({ error: "Las credenciales no son correctas." });
        render(<FormularioInicioSesion />);
        completarYEnviarFormulario();

        expect(await screen.findByRole("alert"))
            .toHaveTextContent("Las credenciales no son correctas.");
        expect(screen.getByLabelText("Correo electrónico o nombre de usuario"))
            .toHaveValue("huerta_productora");
        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    });

    it("deshabilita el boton mientras espera la respuesta", async () => {
        let resolverRespuesta!: (estado: EstadoInicioSesion) => void;
        iniciarSesionSimulado.mockImplementation(() => new Promise((resolver) => {
            resolverRespuesta = resolver;
        }));
        render(<FormularioInicioSesion />);
        completarYEnviarFormulario();

        expect(await screen.findByRole("button", { name: "Ingresando..." })).toBeDisabled();

        await act(async () => resolverRespuesta({}));

        expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
    });

    it("abre el aviso para solicitar la recuperación de contraseña", () => {
        render(<FormularioInicioSesion />);

        fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperación de contraseña" }));

        expect(screen.getByRole("dialog", { name: "Solicitar recuperación de contraseña" }))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Nombre de usuario")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
    });

    it("muestra un error si se acepta la recuperación sin nombre de usuario", () => {
        render(<FormularioInicioSesion />);
        fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperación de contraseña" }));
        fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));

        expect(screen.getByRole("alert"))
            .toHaveTextContent("Ingresá tu nombre de usuario para solicitar la recuperación.");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("muestra un error si el nombre de usuario no existe", async () => {
        render(<FormularioInicioSesion />);
        fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperación de contraseña" }));
        fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
            target: { value: "usuario_inexistente" },
        });
        solicitarRecuperacionSimulada.mockResolvedValue({
            error: "No existe ningún usuario con ese nombre.",
        });
        fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));

        expect(await screen.findByRole("alert"))
            .toHaveTextContent("No existe ningún usuario con ese nombre.");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    it("muestra confirmacion cuando el nombre de usuario existe", async () => {
        render(<FormularioInicioSesion />);
        fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperación de contraseña" }));
        fireEvent.change(screen.getByLabelText("Nombre de usuario"), {
            target: { value: "mercado_verde" },
        });
        solicitarRecuperacionSimulada.mockResolvedValue({
            exito: "La solicitud de recuperación fue realizada correctamente.",
        });
        fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));

        expect(await screen.findByRole("status"))
            .toHaveTextContent("La solicitud de recuperación fue realizada correctamente.");
        expect(solicitarRecuperacionSimulada).toHaveBeenCalledWith("mercado_verde");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
});
