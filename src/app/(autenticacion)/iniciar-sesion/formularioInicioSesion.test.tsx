import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@/test-utils";
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
        expect(screen.getByLabelText("Nombre de usuario")).toHaveFocus();
        expect(screen.getByRole("button", { name: "Aceptar" })).toBeInTheDocument();
    });

    it.each(["Escape", "Cancelar", "fondo"])("cierra la recuperación con %s y devuelve el foco al botón que la abrió", async (cierre) => {
        render(<FormularioInicioSesion />);
        const abrir = screen.getByRole("button", { name: "Solicitar recuperación de contraseña" });
        abrir.focus();
        fireEvent.click(abrir);
        const dialogo = screen.getByRole("dialog");

        if (cierre === "Escape") {
            fireEvent.keyDown(screen.getByLabelText("Nombre de usuario"), { key: "Escape" });
        } else if (cierre === "Cancelar") {
            fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        } else {
            fireEvent.mouseDown(dialogo.parentElement!);
            fireEvent.click(dialogo.parentElement!);
        }

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(abrir).toHaveFocus();
    });

    it("mantiene abierto el aviso mientras se envía la solicitud", async () => {
        let resolver!: (resultado: Awaited<ReturnType<typeof solicitarRecuperacion>>) => void;
        solicitarRecuperacionSimulada.mockImplementation(() => new Promise((resolve) => { resolver = resolve; }));
        render(<FormularioInicioSesion />);
        fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperación de contraseña" }));
        fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "mercado_verde" } });
        fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));

        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
        expect(screen.getByRole("dialog")).toBeInTheDocument();

        await act(async () => resolver({}));
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeEnabled();
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
        expect(within(screen.getByRole("dialog")).getByRole("region", { name: "Notificaciones" })).toContainElement(screen.getByRole("status"));
        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it.each(["respuesta", "conexion"])("muestra el fallo operativo como toast y permite reintentar: %s", async (fallo) => {
        const error = "No se pudo registrar la solicitud. Intentá nuevamente.";
        if (fallo === "respuesta") {
            solicitarRecuperacionSimulada.mockResolvedValue({ error, tipoError: "operacion" });
        } else {
            solicitarRecuperacionSimulada.mockRejectedValue(new Error("Sin conexión"));
        }
        render(<FormularioInicioSesion />);
        fireEvent.click(screen.getByRole("button", { name: "Solicitar recuperación de contraseña" }));
        fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "mercado_verde" } });
        fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(error);
        expect(within(screen.getByRole("dialog")).getByRole("region", { name: "Notificaciones" })).toContainElement(screen.getByRole("alert"));
        expect(screen.getByLabelText("Nombre de usuario")).toHaveValue("mercado_verde");
        expect(screen.getByRole("button", { name: "Aceptar" })).toBeEnabled();

        solicitarRecuperacionSimulada.mockResolvedValue({ exito: "Solicitud enviada correctamente." });
        fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));
        expect(await screen.findByRole("status")).toHaveTextContent("Solicitud enviada correctamente.");
        expect(solicitarRecuperacionSimulada).toHaveBeenCalledTimes(2);
        expect(screen.getByRole("alert")).toHaveTextContent(error);
        fireEvent.click(within(screen.getByRole("alert")).getByRole("button", { name: "Cerrar notificación" }));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("status")).toHaveTextContent("Solicitud enviada correctamente.");
    });
});
