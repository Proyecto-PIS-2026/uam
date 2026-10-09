import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PaginaAdministracion from "./page";

const { obtenerConfiguracionesMock, consultarDatosModificarUsuariosMock } = vi.hoisted(() => ({
    obtenerConfiguracionesMock: vi.fn(),
    consultarDatosModificarUsuariosMock: vi.fn(),
}));

vi.mock("@/modulos/administracion/ConsultaConfiguracion", () => ({
    default: obtenerConfiguracionesMock,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/acciones/ConsultaUsuarios", () => ({
    default: consultarDatosModificarUsuariosMock,
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({
        titulo,
        cantidad,
        subtitulo,
    }: {
        titulo: string;
        cantidad: number | null;
        subtitulo: string;
    }) => (
        <header data-testid="encabezado-pagina">
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
            <span data-testid="cantidad-encabezado">
                {cantidad === null ? "null" : String(cantidad)}
            </span>
        </header>
    ),
}));

vi.mock("@/modulos/administracion/componentes/ContenedorConfiguracionGeneral", () => ({
    default: ({
        publicaciones,
        usuarios,
        publica,
    }: {
        publicaciones: ReactNode;
        usuarios: ReactNode;
        publica: ReactNode;
    }) => (
        <section data-testid="contenedor-configuracion-general">
            <div data-testid="panel-publicaciones">{publicaciones}</div>
            <div data-testid="panel-usuarios">{usuarios}</div>
            <div data-testid="panel-publica">{publica}</div>
        </section>
    ),
}));

vi.mock("@/modulos/administracion/componentes/configuracion-publicaciones/ContenedorConfiguracionPublicaciones", () => ({
    default: () => <div data-testid="vista-publicaciones">Contenedor de publicaciones</div>,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios", () => ({
    default: () => <div data-testid="vista-usuarios">Contenedor de usuarios</div>,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-general/ContenedorConfiguracionGenerales", () => ({
    default: () => (
        <div data-testid="vista-configuracion-publica">
            <h2>Configuración pública</h2>
            <p>Esta sección estará disponible próximamente.</p>
        </div>
    ),
}));

describe("PaginaAdministracion", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        obtenerConfiguracionesMock.mockResolvedValue([]);
        consultarDatosModificarUsuariosMock.mockResolvedValue([]);
    });

    it("renderiza el encabezado y la estructura general de administración", async () => {
        render(await PaginaAdministracion());

        expect(screen.getByRole("heading", { name: "Panel Administrativo" })).toBeInTheDocument();
        expect(screen.getByText("Configuración")).toBeInTheDocument();
        expect(screen.getByTestId("cantidad-encabezado")).toHaveTextContent("null");
        expect(screen.getByTestId("contenedor-configuracion-general")).toBeInTheDocument();
        expect(document.querySelector("main.contenedor-pagina")).toBeInTheDocument();
    });

    it("incluye los contenedores de publicaciones, usuarios y configuración pública", async () => {
        render(await PaginaAdministracion());

        expect(screen.getByTestId("vista-publicaciones")).toBeInTheDocument();
        expect(screen.getByTestId("vista-usuarios")).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Configuración pública" })).toBeInTheDocument();
        expect(screen.getByText("Esta sección estará disponible próximamente.")).toBeInTheDocument();

        expect(screen.getByTestId("panel-publicaciones")).toContainElement(screen.getByTestId("vista-publicaciones"));
        expect(screen.getByTestId("panel-usuarios")).toContainElement(screen.getByTestId("vista-usuarios"));
        expect(screen.getByTestId("panel-publica")).toContainElement(
            screen.getByTestId("vista-configuracion-publica"),
        );
    });
});