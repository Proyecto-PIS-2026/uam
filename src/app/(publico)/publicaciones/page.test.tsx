import { render, screen } from "@testing-library/react";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/Publicaciones";
import PaginaPublicaciones from "./page";

const consultarPublicacionesMock = vi.hoisted(() => vi.fn());
const buscarEspecieMock = vi.hoisted(() => vi.fn());

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
	db: {orm: {public: {Especie: {select: () => ({first: buscarEspecieMock})}}}},
}));

vi.mock("@/modulos/consulta-mercado/acciones/Publicaciones", () => ({
	consultarPublicaciones: consultarPublicacionesMock,
}));

vi.mock(
	"@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones",
	() => ({
		default: ({
			publicaciones,
			especie,
		}: {
			publicaciones: PublicacionListado[];
			especie?: string;
		}) => (
			<div data-testid="contenedor-publicaciones" data-especie={especie}>
				{publicaciones.map((publicacion) => (
					<span key={publicacion.id}>{publicacion.especie}</span>
				))}
			</div>
		),
	}),
);

function crearPublicacion(id: number): PublicacionListado {
	return {
		id,
		precio: 150,
		foto: null,
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

	it("resuelve el ID de la especie de inicio y lo pasa al filtro del catálogo", async () => {
		buscarEspecieMock.mockResolvedValue({nombreEspecie: "Manzana"});
		consultarPublicacionesMock.mockResolvedValue({publicaciones: []});
		render(await PaginaPublicaciones({searchParams: Promise.resolve({especieId: "7"})}));
		expect(buscarEspecieMock).toHaveBeenCalledWith({id: 7});
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

	it("muestra cero publicaciones cuando la consulta no devuelve resultados", async () => {
		consultarPublicacionesMock.mockResolvedValue({publicaciones: []});
		render(await PaginaPublicaciones({ searchParams: Promise.resolve({}) }));
		expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
		expect(screen.getByText("publicaciones en la plataforma")).toBeInTheDocument();
	});

	it("muestra cero publicaciones cuando la consulta no devuelve resultados", async () => {
		consultarPublicacionesMock.mockResolvedValue(null);
		render(await PaginaPublicaciones({searchParams: Promise.resolve({})}));
		expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
		expect(screen.getByText("publicaciones en la plataforma")).toBeInTheDocument();
	});
});
