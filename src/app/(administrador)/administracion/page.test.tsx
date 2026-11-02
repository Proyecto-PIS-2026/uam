
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PaginaAdministracion from "./page";

const {
    obtenerConfiguracionesMock,
    obtenerEstadisticasMock,
    consultarDatosModificarUsuariosMock,
    requerirAdministradorMock,
} = vi.hoisted(() => ({
    obtenerConfiguracionesMock: vi.fn(),
    obtenerEstadisticasMock: vi.fn(),
    consultarDatosModificarUsuariosMock: vi.fn(),
    requerirAdministradorMock: vi.fn(),
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({
    requerirAdministrador: requerirAdministradorMock,
}));

vi.mock("@/modulos/administracion/ConsultaConfiguracion", () => ({
    default: obtenerConfiguracionesMock,
    obtenerEstadisticas: obtenerEstadisticasMock,
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
        estadisticas,
        publicaciones,
        usuarios,
        publica,
    }: {
        estadisticas: ReactNode;
        publicaciones: ReactNode;
        usuarios: ReactNode;
        publica: ReactNode;
    }) => (
        <section data-testid="contenedor-configuracion-general">
            <div data-testid="panel-estadisticas">{estadisticas}</div>
            <div data-testid="panel-publicaciones">{publicaciones}</div>
            <div data-testid="panel-usuarios">{usuarios}</div>
            <div data-testid="panel-publica">{publica}</div>
        </section>
    ),
}));

vi.mock("@/modulos/administracion/componentes/estadistica/ContenedorEstadistica", () => ({
    default: ({
        datosIniciales,
    }: {
        datosIniciales: {
            visitas: unknown[];
            contactos: unknown[];
            publicaciones: unknown[];
        };
    }) => (
        <div
            data-testid="vista-estadisticas"
            data-visitas={JSON.stringify(datosIniciales.visitas)}
            data-contactos={JSON.stringify(datosIniciales.contactos)}
            data-publicaciones={JSON.stringify(datosIniciales.publicaciones)}
        >
            Contenedor de estadísticas
        </div>
    ),
}));

vi.mock("@/modulos/administracion/componentes/configuracion-publicaciones/ContenedorConfiguracionPublicaciones", () => ({
    default: ({ configuracion }: { configuracion: Record<string, string | null> }) => (
        <div data-testid="vista-publicaciones">
            <output data-testid="configuracion-publicaciones">
                {JSON.stringify(configuracion)}
            </output>
            Contenedor de publicaciones - Incremento: {configuracion.incremento_precio}
        </div>
    ),
}));

vi.mock("@/modulos/administracion/componentes/configuracion-usuarios/ConfiguracionUsuarios", () => ({
    default: ({ datos }: { datos: unknown[] }) => (
        <div
            data-testid="vista-usuarios"
            data-usuarios={JSON.stringify(datos)}
        >
            Contenedor de usuarios
        </div>
    ),
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
        vi.resetAllMocks();

        requerirAdministradorMock.mockResolvedValue({ usuarioId: 7, rol: "ADMINISTRADOR" });

        obtenerConfiguracionesMock.mockResolvedValue([]);

        obtenerEstadisticasMock.mockResolvedValue({
            visitas: [],
            contactos: [],
            publicaciones: [],
        });

        consultarDatosModificarUsuariosMock.mockResolvedValue([]);
    });

    it("bloquea la página antes de consultar datos cuando el usuario no es administrador", async () => {
        requerirAdministradorMock.mockRejectedValueOnce(new Error("NEXT_REDIRECT"));

        await expect(PaginaAdministracion()).rejects.toThrow("NEXT_REDIRECT");

        expect(obtenerConfiguracionesMock).not.toHaveBeenCalled();
        expect(obtenerEstadisticasMock).not.toHaveBeenCalled();
        expect(consultarDatosModificarUsuariosMock).not.toHaveBeenCalled();
    });

    it("identifica al administrador actual en el listado para impedir su propia deshabilitación", async () => {
        render(await PaginaAdministracion());

        expect(consultarDatosModificarUsuariosMock).toHaveBeenCalledExactlyOnceWith(7);
    });

    it("renderiza el encabezado y la estructura general de administración", async () => {
        render(await PaginaAdministracion());

        expect(screen.getByRole("heading", {
            name: "Panel Administrativo",
        })).toBeInTheDocument();

        expect(screen.getByText("Configuración")).toBeInTheDocument();

        expect(screen.getByTestId("cantidad-encabezado")).toHaveTextContent("null");

        expect(screen.getByTestId("contenedor-configuracion-general")).toBeInTheDocument();

        expect(document.querySelector("main.contenedor-pagina")).toBeInTheDocument();
    });

    it("incluye los contenedores de estadísticas, publicaciones, usuarios y configuración pública", async () => {
        render(await PaginaAdministracion());

        expect(screen.getByTestId("vista-estadisticas")).toBeInTheDocument();
        expect(screen.getByTestId("vista-publicaciones")).toBeInTheDocument();
        expect(screen.getByTestId("vista-usuarios")).toBeInTheDocument();

        expect(screen.getByRole("heading", {
            name: "Configuración pública",
        })).toBeInTheDocument();

        expect(screen.getByText(
            "Esta sección estará disponible próximamente.",
        )).toBeInTheDocument();

        expect(screen.getByTestId("panel-estadisticas")).toContainElement(
            screen.getByTestId("vista-estadisticas"),
        );

        expect(screen.getByTestId("panel-publicaciones")).toContainElement(
            screen.getByTestId("vista-publicaciones"),
        );

        expect(screen.getByTestId("panel-usuarios")).toContainElement(
            screen.getByTestId("vista-usuarios"),
        );

        expect(screen.getByTestId("panel-publica")).toContainElement(
            screen.getByTestId("vista-configuracion-publica"),
        );
    });

    it("consulta y transforma la configuración utilizada por publicaciones", async () => {
        obtenerConfiguracionesMock.mockResolvedValue([
            {
                nombreConfiguracion: "incremento_precio",
                valorConfiguracion: "15",
            },
            {
                nombreConfiguracion: "otra_configuracion",
                valorConfiguracion: "valor",
            },
            {
                nombreConfiguracion: "configuracion_nula",
                valorConfiguracion: null,
            },
        ]);

        render(await PaginaAdministracion());

        expect(obtenerConfiguracionesMock).toHaveBeenCalledExactlyOnceWith([
            "incremento_precio",
        ]);

        expect(
            JSON.parse(screen.getByTestId("configuracion-publicaciones").textContent ?? "{}"),
        ).toEqual({
            incremento_precio: "15",
            otra_configuracion: "valor",
            configuracion_nula: null,
        });

        expect(screen.getByTestId("vista-publicaciones")).toHaveTextContent(
            "Contenedor de publicaciones - Incremento: 15",
        );
    });

    it("consulta las estadísticas y entrega los tres conjuntos de datos al contenedor", async () => {
        const estadisticas = {
            visitas: [
                {
                    id: 1,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 15,
                    tipoVisitante: "comprador",
                },
            ],
            contactos: [
                {
                    id: 2,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 5,
                    username: "usuario1",
                },
            ],
            publicaciones: [
                {
                    id: 3,
                    fecha: new Date("2026-10-20T12:00:00.000Z"),
                    cantidad: 4,
                    username: "usuario1",
                },
            ],
        };

        obtenerEstadisticasMock.mockResolvedValueOnce(estadisticas);

        render(await PaginaAdministracion());

        expect(obtenerEstadisticasMock).toHaveBeenCalledOnce();

        const vista = screen.getByTestId("vista-estadisticas");

        expect(
            JSON.parse(vista.getAttribute("data-visitas") ?? "[]"),
        ).toEqual(JSON.parse(JSON.stringify(estadisticas.visitas)));

        expect(
            JSON.parse(vista.getAttribute("data-contactos") ?? "[]"),
        ).toEqual(JSON.parse(JSON.stringify(estadisticas.contactos)));

        expect(
            JSON.parse(vista.getAttribute("data-publicaciones") ?? "[]"),
        ).toEqual(JSON.parse(JSON.stringify(estadisticas.publicaciones)));
    });

    it("consulta los usuarios y entrega sus datos al componente correspondiente", async () => {
        const datosUsuarios = [
            { id: 1, username: "admin", rol: "ADMINISTRADOR" },
            { id: 2, username: "operador1", rol: "OPERADOR" },
            { id: 3, username: "productor1", rol: "PRODUCTOR" },
        ];

        consultarDatosModificarUsuariosMock.mockResolvedValueOnce(datosUsuarios);

        render(await PaginaAdministracion());

        expect(consultarDatosModificarUsuariosMock).toHaveBeenCalledOnce();

        expect(
            JSON.parse(
                screen.getByTestId("vista-usuarios").getAttribute("data-usuarios") ?? "[]",
            ),
        ).toEqual(datosUsuarios);
    });

    it("consulta las tres fuentes de datos después de verificar los permisos", async () => {
        render(await PaginaAdministracion());

        expect(requerirAdministradorMock).toHaveBeenCalledOnce();

        expect(obtenerConfiguracionesMock).toHaveBeenCalledOnce();
        expect(obtenerEstadisticasMock).toHaveBeenCalledOnce();
        expect(consultarDatosModificarUsuariosMock).toHaveBeenCalledOnce();

        const ordenAutorizacion = requerirAdministradorMock.mock.invocationCallOrder[0];

        expect(ordenAutorizacion).toBeLessThan(
            obtenerConfiguracionesMock.mock.invocationCallOrder[0],
        );

        expect(ordenAutorizacion).toBeLessThan(
            obtenerEstadisticasMock.mock.invocationCallOrder[0],
        );

        expect(ordenAutorizacion).toBeLessThan(
            consultarDatosModificarUsuariosMock.mock.invocationCallOrder[0],
        );
    });

    it.each([
        ["configuraciones", obtenerConfiguracionesMock],
        ["estadísticas", obtenerEstadisticasMock],
        ["usuarios", consultarDatosModificarUsuariosMock],
    ])("propaga los errores cuando falla la consulta de %s", async (_, consulta) => {
        consulta.mockRejectedValueOnce(new Error("Error de consulta"));

        await expect(PaginaAdministracion()).rejects.toThrow("Error de consulta");
    });
});
