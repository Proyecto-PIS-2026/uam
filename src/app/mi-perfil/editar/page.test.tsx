import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import Pagina from "./page";

const mocks = vi.hoisted(() => ({ requerir: vi.fn(), consultar: vi.fn(), formulario: vi.fn(() => null) }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ requerirAdministrador: mocks.requerir }));
vi.mock("@/modulos/usuarios/administradores/consultar-mi-perfil", () => ({ consultarMiPerfilAdministrador: mocks.consultar }));
vi.mock("./FormularioEditarMiPerfil", () => ({ default: mocks.formulario }));

describe("edición de mi perfil del administrador", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requerir.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });
        mocks.consultar.mockResolvedValue({ nombre: "admin", correo: "admin@uam.com" });
    });

    it("no consulta datos si la autorización falla", async () => {
        mocks.requerir.mockRejectedValueOnce(new Error("NO AUTORIZADO"));
        await expect(Pagina()).rejects.toThrow("NO AUTORIZADO");
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("consulta siempre por el usuario de la sesión", async () => {
        render(await Pagina());
        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith(7);
        expect(mocks.formulario).toHaveBeenCalledWith({ perfil: { nombre: "admin", correo: "admin@uam.com" } }, undefined);
    });

    it("muestra mensaje de error si no existe el perfil", async () => {
        mocks.consultar.mockResolvedValue(null);
        render(await Pagina());
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron encontrar los datos de tu perfil");
        expect(mocks.formulario).not.toHaveBeenCalled();
    });
});
