import { render, screen } from "@testing-library/react";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/Publicaciones";
import PaginaPublicaciones from "./page";

const consultarPublicacionesMock = vi.hoisted(() => vi.fn());

vi.mock("@/modulos/consulta-mercado/acciones/Publicaciones", () => ({
    consultarPublicaciones: consultarPublicacionesMock,
}));

vi.mock("@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones", () => ({
    default: ({ publicaciones, especie }: { publicaciones: PublicacionListado[]; especie?: string }) => (
        <div data-testid="contenedor-publicaciones" data-especie={especie}>
            {publicaciones.map((publicacion) => (
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
    });

    it("pasa el nombre de la especie de inicio al filtro del catálogo", async () => {
        consultarPublicacionesMock.mockResolvedValue({ publicaciones: [] });
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({ especie: "Manzana" }) }));
        expect(screen.getByTestId("contenedor-publicaciones")).toHaveAttribute("data-especie", "Manzana");
    });

    it("consulta las publicaciones y muestra la cantidad obtenida", async () => {
        const publicaciones = [crearPublicacion(1), crearPublicacion(2), crearPublicacion(3)];
        consultarPublicacionesMock.mockResolvedValue({ publicaciones });
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({}) }));
        expect(consultarPublicacionesMock).toHaveBeenCalledTimes(1);
        expect(screen.getByText("3", { exact: true })).toBeInTheDocument();
        expect(screen.getByText("publicaciones en la plataforma")).toBeInTheDocument();
    });

    it("pasa las publicaciones obtenidas al contenedor", async () => {
        const publicaciones = [crearPublicacion(7), crearPublicacion(8)];
        consultarPublicacionesMock.mockResolvedValue({ publicaciones });
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

    it("muestra el contenedor vacío cuando la consulta devuelve null", async () => {
        consultarPublicacionesMock.mockResolvedValue(null);
        render(await PaginaPublicaciones({ searchParams: Promise.resolve({}) }));
        expect(screen.getByTestId("contenedor-publicaciones")).toBeEmptyDOMElement();
        expect(screen.getByText("publicaciones en la plataforma")).toBeInTheDocument();
        expect(screen.queryByText("0", { exact: true })).not.toBeInTheDocument();
    });
});