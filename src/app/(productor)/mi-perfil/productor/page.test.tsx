import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import Pagina from "./page";

const mocks = vi.hoisted(() => ({ requerirProductor: vi.fn(), consultar: vi.fn(), habilitado: vi.fn(), notFound: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ requerirProductor: mocks.requerirProductor }));
vi.mock("@/modulos/usuarios/productores/perfil-propio/consultas-mi-perfil-productor", () => ({ obtenerMiPerfilProductor: mocks.consultar }));
vi.mock("@/modulos/identidad-acceso/cambio-contrasena/configuracion", () => ({ get habilitarCambioContrasena() { return mocks.habilitado() } }));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound }));
const productor = { id: 5, nombre: "Granja Norte", codigoPais: "+598", telefono: "99123456", fotoPerfil: null };

describe("consulta de mi perfil como Productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.consultar.mockResolvedValue(productor);
        mocks.habilitado.mockReturnValue(false);
        mocks.notFound.mockImplementation(() => { throw new Error("NO_ENCONTRADO") });
    });
    afterEach(cleanup);

    it("muestra los datos persistidos y el enlace de edición", async () => {
        render(await Pagina());
        expect(screen.getByRole("heading", { name: "Mi perfil" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: productor.nombre })).toBeInTheDocument();
        expect(screen.getByText("+598 99123456")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "Modificar mi perfil" })).toHaveAttribute("href", "/mi-perfil/productor/editar");
        expect(screen.queryByRole("link", { name: "Cambiar contraseña" })).not.toBeInTheDocument();
    });

    it("habilita el acceso al cambio de contraseña solo si la variable lo habilita", async () => {
        mocks.habilitado.mockReturnValue(true);
        render(await Pagina());
        expect(screen.getByRole("link", { name: "Cambiar contraseña" })).toHaveAttribute("href", "/mi-perfil/cambiar-contrasena");
    });

    it("muestra el perfil después de eliminar el contacto", async () => {
        mocks.consultar.mockResolvedValue({ ...productor, telefono: "" });
        render(await Pagina());
        expect(screen.getByText("Sin número de contacto")).toBeInTheDocument();
    });

    it("muestra la fotografía persistida", async () => {
        mocks.consultar.mockResolvedValue({ ...productor, fotoPerfil: "/api/imagenes/nueva" });
        render(await Pagina());
        expect(screen.getByRole("img", { name: "Foto de Granja Norte" })).toHaveAttribute("src", expect.stringContaining("/api/imagenes/nueva"));
    });

    it("impide consultar el perfil si se rechaza el acceso", async () => {
        mocks.requerirProductor.mockRejectedValue(new Error("NEXT_REDIRECT"));
        await expect(Pagina()).rejects.toThrow("NEXT_REDIRECT");
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("devuelve no encontrado si ya no existe el perfil", async () => {
        mocks.consultar.mockResolvedValue(null);
        await expect(Pagina()).rejects.toThrow("NO_ENCONTRADO");
    });
});
