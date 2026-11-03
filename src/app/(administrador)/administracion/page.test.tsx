import type { ComponentProps, ReactNode } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PaginaAdministracion, { dynamic } from "./page";

type PropsUsuarios = ComponentProps<typeof import("@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios").default>;
type DatosUsuarios = PropsUsuarios["datos"];

const mocks = vi.hoisted(() => ({
    requerirAdministrador: vi.fn(),
    consultarUsuarios: vi.fn(),
    obtenerEstadisticas: vi.fn(),
    usuarios: vi.fn<(props: PropsUsuarios) => null>(() => null),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: mocks.requerirAdministrador,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/acciones/ConsultaUsuarios", () => ({
    default: mocks.consultarUsuarios,
}));

vi.mock("@/modulos/administracion/acciones/consultas-configuracion", () => ({
    obtenerEstadisticas: mocks.obtenerEstadisticas,
}));

vi.mock("@/compartido/EncabezadoPagina", () => ({
    default: ({ titulo, subtitulo, cantidad }: { titulo: string; subtitulo: string; cantidad: number | null }) => (
        <header>
            <h1>{titulo}</h1>
            <p>{subtitulo}</p>
            <output data-testid="cantidad-encabezado">{JSON.stringify(cantidad)}</output>
        </header>
    ),
}));

vi.mock("@/modulos/administracion/componentes/contenedor-configuracion/ContenedorConfiguraciones", () => ({
    default: ({ general, usuarios, estadisticas }: { general: ReactNode; usuarios: ReactNode; estadisticas: ReactNode }) => (
        <div>
            <section aria-label="General">{general}</section>
            <section aria-label="Usuarios">{usuarios}</section>
            <section aria-label="Estadísticas">{estadisticas}</section>
        </div>
    ),
}));

vi.mock("@/modulos/administracion/componentes/configuracion-general/contenedor-configuracion-general/ContenedorConfiguracionGenerales", () => ({
    default: () => <div>Configuraciones generales</div>,
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios", () => ({
    default: mocks.usuarios,
}));

vi.mock("@/modulos/administracion/componentes/estadistica/ContenedorEstadistica", () => ({
    default: ({ datosIniciales }: { datosIniciales: unknown }) => (
        <output data-testid="datos-estadisticas">{JSON.stringify(datosIniciales)}</output>
    ),
}));

const sesionAdministrador = {
    usuarioId: 7,
    rol: "ADMINISTRADOR",
    expiraEn: 2000000000,
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.requerirAdministrador.mockResolvedValue(sesionAdministrador);
    mocks.consultarUsuarios.mockResolvedValue({ usuarios: [] });
    mocks.obtenerEstadisticas.mockResolvedValue({ visitas: [], contactos: [], publicaciones: [] });
    mocks.usuarios.mockImplementation(() => null);
});

afterEach(cleanup);

describe("PaginaAdministracion", () => {
    it("configura la página para renderizado dinámico", () => {
        expect(dynamic).toBe("force-dynamic");
    });

    it("verifica el acceso antes de consultar usuarios y estadísticas", async () => {
        await PaginaAdministracion();
        expect(mocks.requerirAdministrador).toHaveBeenCalledOnce();
        expect(mocks.consultarUsuarios).toHaveBeenCalledOnce();
        expect(mocks.obtenerEstadisticas).toHaveBeenCalledOnce();
        const ordenAcceso = mocks.requerirAdministrador.mock.invocationCallOrder[0];
        expect(ordenAcceso).toBeLessThan(mocks.consultarUsuarios.mock.invocationCallOrder[0]);
        expect(ordenAcceso).toBeLessThan(mocks.obtenerEstadisticas.mock.invocationCallOrder[0]);
    });

    it.each([7, 23])("envía el ID %s del administrador actual a la consulta de usuarios", async (usuarioId) => {
        mocks.requerirAdministrador.mockResolvedValue({ ...sesionAdministrador, usuarioId });
        render(await PaginaAdministracion());
        expect(mocks.consultarUsuarios).toHaveBeenCalledExactlyOnceWith(usuarioId);
    });

    it("no consulta datos si falla el acceso", async () => {
        const error = new Error("NEXT_REDIRECT");
        mocks.requerirAdministrador.mockRejectedValue(error);
        await expect(PaginaAdministracion()).rejects.toBe(error);
        expect(mocks.consultarUsuarios).not.toHaveBeenCalled();
        expect(mocks.obtenerEstadisticas).not.toHaveBeenCalled();
        expect(mocks.usuarios).not.toHaveBeenCalled();
    });

    it("espera a que se confirme el acceso antes de consultar datos", async () => {
        let autorizar!: () => void;
        mocks.requerirAdministrador.mockImplementation(() => new Promise<typeof sesionAdministrador>((resolve) => {
            autorizar = () => resolve(sesionAdministrador);
        }));
        const pendiente = PaginaAdministracion();
        expect(mocks.consultarUsuarios).not.toHaveBeenCalled();
        expect(mocks.obtenerEstadisticas).not.toHaveBeenCalled();
        autorizar();
        await pendiente;
        expect(mocks.consultarUsuarios).toHaveBeenCalledExactlyOnceWith(sesionAdministrador.usuarioId);
        expect(mocks.obtenerEstadisticas).toHaveBeenCalledOnce();
    });

    it("muestra el encabezado de administración sin contador", async () => {
        render(await PaginaAdministracion());
        expect(screen.getByRole("heading", { name: "Panel Administrativo" })).toBeInTheDocument();
        expect(screen.getByText("Configuración")).toBeInTheDocument();
        expect(screen.getByTestId("cantidad-encabezado")).toHaveTextContent("null");
    });

    it("incluye las secciones General, Usuarios y Estadísticas", async () => {
        render(await PaginaAdministracion());
        expect(screen.getByRole("region", { name: "General" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Usuarios" })).toBeInTheDocument();
        expect(screen.getByRole("region", { name: "Estadísticas" })).toBeInTheDocument();
    });

    it("incluye la configuración general en su sección", async () => {
        render(await PaginaAdministracion());
        expect(screen.getByRole("region", { name: "General" })).toContainElement(screen.getByText("Configuraciones generales"));
    });

    it("entrega a Usuarios los datos consultados", async () => {
        const datos = { usuarios: [] } as DatosUsuarios;
        mocks.consultarUsuarios.mockResolvedValue(datos);
        render(await PaginaAdministracion());
        expect(mocks.usuarios).toHaveBeenCalled();
        expect(mocks.usuarios.mock.calls.at(-1)![0].datos).toBe(datos);
    });

    it("entrega los tres conjuntos de datos a Estadísticas", async () => {
        const estadisticas = {
            visitas: [{ id: 1, fecha: "2026-10-20T12:00:00Z", cantidad: 15, tipoVisitante: "comprador" }],
            contactos: [{ id: 2, fecha: "2026-10-20T12:00:00Z", cantidad: 5, username: "usuario1" }],
            publicaciones: [{ id: 3, fecha: "2026-10-20T12:00:00Z", cantidad: 4, username: "usuario1" }],
        };
        mocks.obtenerEstadisticas.mockResolvedValue(estadisticas);
        render(await PaginaAdministracion());
        expect(mocks.obtenerEstadisticas).toHaveBeenCalledOnce();
        const vista = screen.getByTestId("datos-estadisticas");
        expect(JSON.parse(vista.textContent ?? "{}")).toEqual(estadisticas);
        expect(screen.getByRole("region", { name: "Estadísticas" })).toContainElement(vista);
    });

    it("muestra estadísticas vacías cuando no hay registros", async () => {
        render(await PaginaAdministracion());
        const contenido = screen.getByTestId("datos-estadisticas").textContent;
        expect(JSON.parse(contenido ?? "{}")).toEqual({ visitas: [], contactos: [], publicaciones: [] });
    });

    it.each([["usuarios", mocks.consultarUsuarios], ["estadísticas", mocks.obtenerEstadisticas]])("propaga los errores de consulta de %s", async (_, consulta) => {
        const error = new Error("Error de consulta");
        consulta.mockRejectedValueOnce(error);
        await expect(PaginaAdministracion()).rejects.toBe(error);
        expect(mocks.usuarios).not.toHaveBeenCalled();
    });
});