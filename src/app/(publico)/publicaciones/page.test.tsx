import { render, screen } from "@testing-library/react";
import type { PublicacionListado, ResultadoPublicaciones } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import PaginaPublicaciones from "./page";

const consultarPublicacionesMock = vi.hoisted(() => vi.fn());
const obtenerSesionMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: obtenerSesionMock,
}));

vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.mock("@/modulos/consulta-mercado/acciones/PublicacionesOperador", () => ({
    consultarPublicaciones: consultarPublicacionesMock,
}));

vi.mock("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones", () => ({
    default: ({ resultado, especie }: { resultado: ResultadoPublicaciones; especie?: string }) => (
        <div data-testid="contenedor-publicaciones" data-especie={especie}>
            {resultado.publicaciones.map((publicacion) => (
                <span key={publicacion.id}>{publicacion.especie}</span>
            ))}
        </div>
    ),
}));

function crearPublicacion(id: number): PublicacionListado {
    return {
        id,
        precio: 150,
        foto: null,
        fecha: "2026-10-03T15:00:00.000Z",
        especie: `Producto ${id}`,
        variedad: "-",
        presentacion: "Cajón",
        categoria: "Primera",
        calibre: "Mediano",
        codigoCalibre: "M",
        pais: "Uruguay",
        tipoPublicacion: "OPERADOR" as const,
        operador: {
            id: 10,
            nombreFantasia: "Huerta Sur",
            whatsApp: "099123456",
        },
    };
}

describe("PaginaPublicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        obtenerSesionMock.mockResolvedValue(null);
    });

    it.each([
        { rol: "OPERADOR", destino: "/mi-mercado" },
        { rol: "PRODUCTOR", destino: "/mi-mercado/productor" },
    ] as const)("redirige a $rol antes de esperar los filtros o consultar las publicaciones", async ({ rol, destino }) => {
        obtenerSesionMock.mockResolvedValue({ usuarioId: 10, rol, expiraEn: 2000000000 });
        const esperarParametros = vi.fn((resolver: (valor: { especie: string }) => void) => resolver({ especie: "Manzana" }));
        const searchParams = { then: esperarParametros } as unknown as Promise<{ especie: string }>;

        await expect(PaginaPublicaciones({ searchParams })).rejects.toThrow("NEXT_REDIRECT");

        expect(redirectMock).toHaveBeenCalledExactlyOnceWith(destino);
        expect(obtenerSesionMock).toHaveBeenCalledOnce();
        expect(esperarParametros).not.toHaveBeenCalled();
        expect(consultarPublicacionesMock).not.toHaveBeenCalled();
    });

    it.each([null, "ADMINISTRADOR"] as const)("conserva el catálogo público para la sesión %s", async (rol) => {
        obtenerSesionMock.mockResolvedValue(rol ? { usuarioId: 20, rol, expiraEn: 2000000000 } : null);
        consultarPublicacionesMock.mockResolvedValue({ publicaciones: [crearPublicacion(1)], totalCatalogo: 1 });

        render(await PaginaPublicaciones({ searchParams: Promise.resolve({ especie: "Manzana" }) }));

        expect(redirectMock).not.toHaveBeenCalled();
        expect(consultarPublicacionesMock).toHaveBeenCalledOnce();
        expect(screen.getByTestId("contenedor-publicaciones")).toHaveAttribute("data-especie", "Manzana");
        expect(screen.getByText("Producto 1")).toBeInTheDocument();
    });

    it("pasa el nombre de la especie de inicio al filtro del catálogo", async () => {
        consultarPublicacionesMock.mockResolvedValue({ publicaciones: [] });
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({ especie: "Manzana" }) }));
        expect(screen.getByTestId("contenedor-publicaciones")).toHaveAttribute("data-especie", "Manzana");
    });

    it("consulta las publicaciones y muestra la cantidad obtenida", async () => {
        const publicaciones = [crearPublicacion(1), crearPublicacion(2), crearPublicacion(3)];
        consultarPublicacionesMock.mockResolvedValue({ publicaciones, totalCatalogo: publicaciones.length });
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({}) }));
        expect(consultarPublicacionesMock).toHaveBeenCalledTimes(1);
        expect(screen.getByText("3", { exact: true })).toBeInTheDocument();
        expect(screen.getByText("publicaciones en la plataforma")).toBeInTheDocument();
    });

    it("pasa las publicaciones obtenidas al contenedor", async () => {
        const publicaciones = [crearPublicacion(7), crearPublicacion(8)];
        consultarPublicacionesMock.mockResolvedValue({ publicaciones, totalCatalogo: publicaciones.length });
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({}) }));
        const contenedor = screen.getByTestId("contenedor-publicaciones");
        expect(contenedor).toHaveTextContent("Producto 7");
        expect(contenedor).toHaveTextContent("Producto 8");
    });

    it("muestra el contenedor vacío cuando la consulta devuelve una lista vacía", async () => {
        consultarPublicacionesMock.mockResolvedValue({ publicaciones: [] });
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({}) }));
        expect(screen.getByTestId("contenedor-publicaciones")).toBeEmptyDOMElement();
        expect(screen.getByText("publicaciones en la plataforma")).toBeInTheDocument();
        expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    });

    it("propaga el error cuando la consulta no devuelve un resultado", async () => {
        consultarPublicacionesMock.mockResolvedValue(null);
        await expect(PaginaPublicaciones({ searchParams: Promise.resolve({}) })).rejects.toThrow("No se pudieron cargar");
    });
});
