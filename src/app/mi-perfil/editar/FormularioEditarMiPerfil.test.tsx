import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import FormularioEditarMiPerfil from "./FormularioEditarMiPerfil";

const mocks = vi.hoisted(() => ({ guardar: vi.fn(), push: vi.fn(), refresh: vi.fn() }));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("@/modulos/usuarios/administradores/modificar-mi-perfil", () => ({
    modificarMiPerfilAdministrador: mocks.guardar,
}));

const perfil = { nombre: "admin", correo: "admin@uam.com" };

afterEach(() => {
    cleanup();
    vi.resetAllMocks();
});

describe("FormularioEditarMiPerfil", () => {
    it("no incluye el correo entre los campos del formulario", () => {
        render(<FormularioEditarMiPerfil perfil={perfil} />);

        expect(screen.getByRole("textbox", { name: /Nombre de usuario/ })).toHaveValue(perfil.nombre);
        expect(screen.queryByRole("textbox", { name: "Correo electrónico" })).not.toBeInTheDocument();
        expect(screen.queryByText(/El correo electrónico se usa para iniciar sesión/)).not.toBeInTheDocument();
    });

    it("guarda el nombre sin enviar el correo y vuelve al perfil", async () => {
        mocks.guardar.mockResolvedValue({ esValido: true, mensaje: "Perfil actualizado correctamente." });
        render(<FormularioEditarMiPerfil perfil={perfil} />);

        fireEvent.change(screen.getByRole("textbox", { name: /Nombre de usuario/ }), { target: { value: "admin.nuevo" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/mi-perfil"));
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({ nombre: "admin.nuevo" });
        expect(mocks.refresh).toHaveBeenCalledOnce();
    });
});
