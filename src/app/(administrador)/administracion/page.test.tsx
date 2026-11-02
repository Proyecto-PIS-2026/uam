import type { ComponentProps, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaAdministracion, { dynamic } from "./page";

type PropsUsuarios = ComponentProps<typeof import("@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios").default>;
type DatosUsuarios = PropsUsuarios["datos"];

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    consultarUsuarios: vi.fn(),
    usuarios: vi.fn<(props: PropsUsuarios) => null>(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: mocks.requerirAdministrador,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/acciones/ConsultaUsuarios", () => ({
    default: mocks.consultarUsuarios,
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({ titulo, subtitulo }: { titulo: string; subtitulo: string }) => (
        <header>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
        </header>
    ),
}));

vi.mock("@/modulos/administracion/componentes/contenedor-configuracion/ContenedorConfiguraciones", () => ({
    default: ({ general, usuarios }: { general: ReactNode; usuarios: ReactNode }) => (
        <div>
            <section aria-label="General">{general}</section>
            <section aria-label="Usuarios">{usuarios}</section>
        </div>
    ),
}));

vi.mock("@/modulos/administracion/componentes/configuracion-general/contenedor-configuracion-general/ContenedorConfiguracionGenerales", () => ({
    default: () => <div>Configuraciones generales</div>,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios", () => ({
    default: mocks.usuarios,
}));

beforeEach(() => {
    vi.resetAllMocks();
    mocks.requerirAdministrador.mockResolvedValue(undefined);
    mocks.consultarUsuarios.mockResolvedValue({ usuarios: [] });
    mocks.usuarios.mockImplementation(() => null);
});

afterEach(cleanup);

describe("PaginaAdministracion", () => {
    it("configura la página para renderizado dinámico", () => {
        expect(dynamic).toBe("force-dynamic");
    });

    it("verifica el acceso antes de consultar los usuarios", async () => {
        mocks.consultarUsuarios.mockImplementation(async () => {
            expect(mocks.requerirAdministrador).toHaveBeenCalledOnce();
            return { usuarios: [] };
        });

        await PaginaAdministracion();

        expect(mocks.consultarUsuarios).toHaveBeenCalledOnce();
    });

    it("no consulta usuarios si falla el acceso", async () => {
        const error = new Error("NEXT_REDIRECT");
        mocks.requerirAdministrador.mockRejectedValue(error);

        await expect(PaginaAdministracion()).rejects.toBe(error);

        expect(mocks.consultarUsuarios).not.toHaveBeenCalled();
        expect(mocks.usuarios).not.toHaveBeenCalled();
    });

    it("espera a que se confirme el acceso antes de consultar datos", async () => {
        let autorizar!: () => void;
        mocks.requerirAdministrador.mockImplementation(() => new Promise<void>((resolve) => { autorizar = resolve; }));

        const pendiente = PaginaAdministracion();

        expect(mocks.consultarUsuarios).not.toHaveBeenCalled();

        autorizar();
        await pendiente;

        expect(mocks.consultarUsuarios).toHaveBeenCalledOnce();
    });

    it("muestra el encabezado y las secciones General y Usuarios", async () => {
        render(await PaginaAdministracion());

        expect(screen.getByRole("heading", { name: "Panel Administrativo" })).toBeInTheDocument();
        expect(screen.getByText("Configuración")).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "General" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Usuarios" })).toBeInTheDocument();
        expect(screen.getByText("Configuraciones generales")).toBeInTheDocument();
    });

    it("entrega a la sección Usuarios los datos consultados", async () => {
        const datos = { usuarios: [] } as DatosUsuarios;
        mocks.consultarUsuarios.mockResolvedValue(datos);

        render(await PaginaAdministracion());

        expect(mocks.usuarios).toHaveBeenCalled();
        expect(mocks.usuarios.mock.calls.at(-1)![0].datos).toBe(datos);
    });

    it("propaga los errores de consulta de usuarios", async () => {
        const error = new Error("No se pudieron cargar los usuarios");
        mocks.consultarUsuarios.mockRejectedValue(error);

        await expect(PaginaAdministracion()).rejects.toBe(error);

        expect(mocks.usuarios).not.toHaveBeenCalled();
    });
});