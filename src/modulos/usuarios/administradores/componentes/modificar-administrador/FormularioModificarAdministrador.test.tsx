import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import FormularioModificarAdministrador from "./FormularioModificarAdministrador";
import type { AdministradorParaModificar } from "./obtenerAdministradorParaModificar";

const { push, modificarMock, modificarMiPerfilMock, notificarMock } = vi.hoisted(() => ({
    push: vi.fn(),
    modificarMock: vi.fn(),
    modificarMiPerfilMock: vi.fn(),
    notificarMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push }),
}));

vi.mock("./modificarAdministrador", () => ({
    modificarAdministrador: modificarMock,
}));

vi.mock("../../perfil-propio/modificarMiPerfilAdministrador", () => ({
    modificarMiPerfilAdministrador: modificarMiPerfilMock,
}));

vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: notificarMock }),
}));

const administradorBase: AdministradorParaModificar = {
    id: 102,
    usuarioId: 2,
    nombreUsuario: "beto.admin",
    email: "beto@ejemplo.com",
};

function renderizar() {
    render(<FormularioModificarAdministrador administrador={administradorBase} />);
}

function valorDe(elemento: HTMLElement): string {
    return (elemento as HTMLInputElement).value;
}

function apretarGuardar() {
    fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
}

afterEach(() => {
    cleanup();
    push.mockReset();
    modificarMock.mockReset();
    modificarMiPerfilMock.mockReset();
    notificarMock.mockReset();
    vi.restoreAllMocks();
});

describe("FormularioModificarAdministrador", () => {
    it("muestra los datos actuales del administrador", () => {
        renderizar();

        expect(valorDe(screen.getByLabelText("Nombre de usuario"))).toBe("beto.admin");
        expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
        expect(valorDe(screen.getByLabelText("Nueva contraseña"))).toBe("");
        expect(valorDe(screen.getByLabelText("Confirmar contraseña"))).toBe("");
    });

    it("envía la nueva contraseña y su confirmación", async () => {
        modificarMock.mockResolvedValue({ esValido: true, id: 102 });
        renderizar();

        fireEvent.change(screen.getByLabelText("Nueva contraseña"), { target: { value: "contraseña123" } });
        fireEvent.change(screen.getByLabelText("Confirmar contraseña"), { target: { value: "contraseña123" } });
        apretarGuardar();

        await waitFor(() =>
            expect(modificarMock).toHaveBeenCalledWith(
                expect.objectContaining({ contraseña: "contraseña123", confirmacionContraseña: "contraseña123" }),
            ),
        );
    });

    it("envía los datos modificados y vuelve al perfil cuando la modificación es válida", async () => {
        modificarMock.mockResolvedValue({ esValido: true, id: 102 });
        renderizar();

        fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "beto.nuevo" } });
        apretarGuardar();

        await waitFor(() => expect(push).toHaveBeenCalledWith("/gestion-administradores/102"));
        expect(modificarMock).toHaveBeenCalledWith({
            administradorId: 102,
            nombreUsuario: "beto.nuevo",
            contraseña: "",
            confirmacionContraseña: "",
        });
    });

    it("muestra los errores de validación y no navega", async () => {
        modificarMock.mockResolvedValue({
            esValido: false,
            errores: ["El nombre es obligatorio.", "Las contraseñas no coinciden."],
        });
        renderizar();

        apretarGuardar();

        const alerta = await screen.findByRole("alert");
        expect(alerta.textContent).toContain("El nombre es obligatorio.");
        expect(alerta.textContent).toContain("Las contraseñas no coinciden.");
        expect(push).not.toHaveBeenCalled();
    });

    it("avisa con un mensaje genérico si la acción falla", async () => {
        const errorDeConsola = vi.spyOn(console, "error").mockImplementation(() => {});
        modificarMock.mockRejectedValue(new Error("Falla simulada"));
        renderizar();

        apretarGuardar();

        await waitFor(() =>
            expect(notificarMock).toHaveBeenCalledWith("No se pudieron guardar los cambios. Intentá de nuevo.", "error"),
        );
        expect(errorDeConsola).toHaveBeenCalled();
        expect(push).not.toHaveBeenCalled();
    });

    it("deshabilita el botón de guardar mientras se está guardando", async () => {
        let resolver: (valor: unknown) => void = () => {};
        modificarMock.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
        renderizar();

        apretarGuardar();

        expect(await screen.findByRole("button", { name: "Guardando..." })).toBeDisabled();
        resolver({ esValido: true, id: 102 });
        await waitFor(() => expect(push).toHaveBeenCalledWith("/gestion-administradores/102"));
    });

    it.each([/^Cancelar$/, /Volver al perfil/])("vuelve al perfil sin guardar al apretar %s", (nombreDelBoton) => {
        renderizar();

        fireEvent.click(screen.getByRole("button", { name: nombreDelBoton }));

        expect(push).toHaveBeenCalledWith("/gestion-administradores/102");
        expect(modificarMock).not.toHaveBeenCalled();
    });
});

describe("FormularioModificarAdministrador en Mi perfil", () => {
    function renderizarPerfilPropio() {
        render(<FormularioModificarAdministrador administrador={administradorBase} perfilPropio />);
    }

    it("muestra el nombre actual sin campos de correo ni contraseña", () => {
        renderizarPerfilPropio();

        expect(screen.getByRole("heading", { name: "Editar mi perfil" })).toBeInTheDocument();
        expect(valorDe(screen.getByLabelText("Nombre de usuario"))).toBe("beto.admin");
        expect(screen.queryByLabelText("Correo electrónico")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Nueva contraseña")).not.toBeInTheDocument();
    });

    it("guarda con la acción de Mi perfil y vuelve a la consulta", async () => {
        modificarMiPerfilMock.mockResolvedValue({ esValido: true, id: 102, mensaje: "Tu perfil se actualizó correctamente." });
        renderizarPerfilPropio();

        fireEvent.change(screen.getByLabelText("Nombre de usuario"), { target: { value: "beto.nuevo" } });
        apretarGuardar();

        await waitFor(() => expect(push).toHaveBeenCalledWith("/mi-perfil"));
        expect(modificarMiPerfilMock).toHaveBeenCalledWith({ nombreUsuario: "beto.nuevo" });
        expect(modificarMock).not.toHaveBeenCalled();
    });

    it("muestra el error del servidor y no navega", async () => {
        modificarMiPerfilMock.mockResolvedValue({ esValido: false, errores: ["Ya existe un usuario con ese nombre."] });
        renderizarPerfilPropio();

        apretarGuardar();

        expect((await screen.findByRole("alert")).textContent).toContain("Ya existe un usuario con ese nombre.");
        expect(push).not.toHaveBeenCalled();
    });

    it.each([/^Cancelar$/, /Volver a mi perfil/])("vuelve a Mi perfil sin guardar al apretar %s", (nombreDelBoton) => {
        renderizarPerfilPropio();

        fireEvent.click(screen.getByRole("button", { name: nombreDelBoton }));

        expect(push).toHaveBeenCalledWith("/mi-perfil");
        expect(modificarMiPerfilMock).not.toHaveBeenCalled();
    });
});
