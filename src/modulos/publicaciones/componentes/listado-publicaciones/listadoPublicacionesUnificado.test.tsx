import { act, fireEvent, render, screen, within } from "@testing-library/react";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import ListadoPublicaciones from "./ListadoPublicacionesUnificado";

function crearPublicacion(id: number, operadorId = 10, nombreFantasia = "Huerta Sur"): PublicacionListado {
	return {
		id,
		especie: `Producto ${id}`,
		variedad: "-",
		precio: 150,
		foto: null,
		presentacion: "Cajón",
		categoria: "Primera",
		calibre: "Mediano",
		codigoCalibre: "M",
		operador: { id: operadorId, nombreFantasia, whatsApp: "099123456" },
	};
}

type TarjetaProps = { publicacion: PublicacionListado; onClick: () => void };

// Se aíslan los componentes hijos para verificar agrupación y selección del listado.
vi.mock("@mui/material/useMediaQuery", () => ({
	default: vi.fn(() => false),
}));

vi.mock(
	"@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionConOperador",
	() => ({
		default: ({ publicacion, onClick }: TarjetaProps) => (
		<button onClick={onClick}>
			{publicacion.especie} — {publicacion.operador.nombreFantasia}
		</button>
		),
	}),
);

vi.mock(
	"@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionSinOperador",
	() => ({
		default: ({ publicacion, onClick }: TarjetaProps) => (
			<button onClick={onClick}>
				{publicacion.especie}
			</button>
		),
	}),
);

vi.mock(
	"@/modulos/publicaciones/componentes/drawer-publicacion/DrawerDerechaPublicacion",
	() => ({
		DrawerDerechaPublicacion: ({
			publicacion,
			open,
			onOpenChange,
		}: {
			publicacion: PublicacionListado;
			open: boolean;
			onOpenChange: (open: boolean) => void;
		}) =>
			open ? (
				<div role="dialog" aria-label={`Detalle ${publicacion.especie}`}>
					<span>{publicacion.operador.nombreFantasia}</span>
					<span>{publicacion.precio}</span>
					<button onClick={() => onOpenChange(false)}>
						Cerrar
					</button>
				</div>
			) : null,
	}),
);

vi.mock(
	"@/modulos/publicaciones/componentes/drawer-publicacion/DrawerAbajoPublicacion",
	() => ({
		DrawerAbajoPublicacion: ({
			publicacion,
			open,
			onOpenChange,
		}: {
			publicacion: PublicacionListado;
			open: boolean;
			onOpenChange: (open: boolean) => void;
		}) =>
			open ? (
				<div role="dialog" aria-label={`Detalle ${publicacion.especie}`}>
					<span>{publicacion.operador.nombreFantasia}</span>
					<span>{publicacion.precio}</span>
					<button onClick={() => onOpenChange(false)}>
						Cerrar
					</button>
				</div>
			) : null,
	}),
);

function publicacionesDeEjemplo() {
	return [
		crearPublicacion(7),
		crearPublicacion(2, 20, "Frutas Norte"),
		crearPublicacion(9),
	];
}

describe("ListadoPublicaciones", () => {
	beforeEach(() => {
		vi.mocked(useMediaQuery).mockReturnValue(false);
	});

	it("informa cuando no hay resultados", () => {
		render(<ListadoPublicaciones publicaciones={[]} />);
		expect(screen.getByRole("status")).toHaveTextContent("No hay publicaciones que coincidan con la búsqueda.");
		expect(screen.queryByRole("button")).not.toBeInTheDocument();
		expect(screen.queryByRole("list")).not.toBeInTheDocument();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("muestra inicialmente todas las publicaciones sin agrupar en el orden recibido", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		expect(screen.getByRole("heading", { level: 1, name: "Publicaciones" })).toBeInTheDocument();
		expect(within(screen.getByRole("list")).getAllByRole("button").map((tarjeta) => 
			tarjeta.textContent)).toEqual(["Producto 7 — Huerta Sur", "Producto 2 — Frutas Norte", "Producto 9 — Huerta Sur"]);
		expect(screen.getByRole("button", { name: "Agrupar" })).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("agrupa publicaciones del mismo operador aunque no sean consecutivas y muestra sus cantidades", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		expect(screen.getAllByRole("heading", { level: 2 }).map((encabezado) => 
			encabezado.textContent?.trim()),).toEqual(["Huerta Sur", "Frutas Norte"]);
		const listas = screen.getAllByRole("list");
		expect(listas).toHaveLength(2);
		expect(within(listas[0]).getAllByRole("button").map((boton) => 
			boton.textContent)).toEqual(["Producto 7", "Producto 9"]);
		expect(within(listas[1]).getAllByRole("button").map((boton) => 
			boton.textContent)).toEqual(["Producto 2"]);
		const cantidades = screen.getAllByText("productos");
		expect(cantidades).toHaveLength(2);
		expect(cantidades[0]).toHaveTextContent(/^2 productos$/);
		expect(cantidades[1]).toHaveTextContent(/^1 productos$/);
	});

	it("mantiene separados operadores con igual nombre pero distinto ID", () => {
		render(<ListadoPublicaciones publicaciones={[crearPublicacion(7, 10), crearPublicacion(2, 20)]}/>);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		expect(screen.getAllByRole("heading", { level: 2, name: "Huerta Sur" })).toHaveLength(2);
		const listas = screen.getAllByRole("list");
		expect(listas).toHaveLength(2);
		expect(within(listas[0]).getAllByRole("listitem")).toHaveLength(1);
		expect(within(listas[1]).getAllByRole("listitem")).toHaveLength(1);
	});

	it("permite desagrupar y recupera el orden original", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		fireEvent.click(screen.getByRole("button", { name: "Desagrupar" }));
		expect(screen.queryByRole("heading", { level: 2 })).not.toBeInTheDocument();
		expect(within(screen.getByRole("list")).getAllByRole("button").map((boton) => 
			boton.textContent)).toEqual(["Producto 7 — Huerta Sur", "Producto 2 — Frutas Norte", "Producto 9 — Huerta Sur"]);
	});

	it("abre y cierra el detalle sin agrupar publicaciones", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Producto 2 — Frutas Norte" }));
		const detalle = screen.getByRole("dialog", { name: "Detalle Producto 2" });
		expect(within(detalle).getByText("Frutas Norte")).toBeInTheDocument();
		expect(within(detalle).getByText("150")).toBeInTheDocument();
		fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Producto 7 — Huerta Sur" }));
		expect(screen.getByRole("dialog", { name: "Detalle Producto 7" })).toBeInTheDocument();
	});

	it("abre y cierra el detalle con publicaciones agrupadas", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		fireEvent.click(screen.getByRole("button", { name: "Producto 2" }));
		const detalle = screen.getByRole("dialog", { name: "Detalle Producto 2" });
		expect(within(detalle).getByText("Frutas Norte")).toBeInTheDocument();
		expect(within(detalle).getByText("150")).toBeInTheDocument();
		fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Producto 7" }));
		expect(screen.getByRole("dialog", { name: "Detalle Producto 7" })).toBeInTheDocument();
	});

	it("recalcula los grupos al recibir nuevos resultados y muestra el estado vacío al quitarlos", () => {
		const { rerender } = render(
		<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()}/>);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		rerender(<ListadoPublicaciones publicaciones={[crearPublicacion(5, 30, "Nueva Huerta")]}/>);
		expect(screen.getAllByRole("heading", { level: 2 })).toHaveLength(1);
		expect(screen.getByRole("heading", { name: "Nueva Huerta" })).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: "Producto 7" })).not.toBeInTheDocument();
		expect(within(screen.getByRole("list")).getByRole("button", { name: "Producto 5" })).toBeInTheDocument();
		rerender(<ListadoPublicaciones publicaciones={[]} />);
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(screen.queryByRole("list")).not.toBeInTheDocument();
	});

	it("abre el detalle inferior en pantalla vertical", () => {
		vi.mocked(useMediaQuery).mockReturnValue(true);
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()}/>);
		fireEvent.click(screen.getByRole("button", { name: "Producto 2 — Frutas Norte" }));
		expect(screen.getByRole("dialog", { name: "Detalle Producto 2" })).toBeInTheDocument();
	});

	it("no muestra el botón de volver arriba mientras no se ha desplazado suficiente", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()}/>);
		Object.defineProperty(window, "scrollY", {configurable: true, value: 300});
		fireEvent.scroll(window);
		expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();
	});

	it("oculta el botón después de volver por debajo del umbral", async () => {
		vi.useFakeTimers();
		try {
			render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()}/>);
			Object.defineProperty(window, "scrollY", {configurable: true, value: 500});
			act(() => { fireEvent.scroll(window) });
			expect(screen.getByRole("button", { name: "Volver arriba" })).toBeInTheDocument();
			Object.defineProperty(window, "scrollY", {configurable: true, value: 300});
			act(() => { fireEvent.scroll(window) });
			await act(async () => { vi.advanceTimersByTime(400) });
			expect(screen.queryByRole("button", { name: "Volver arriba" })).not.toBeInTheDocument();
		} finally {
			vi.useRealTimers();
		}
	});

	it("muestra el botón de volver arriba después de desplazarse suficiente", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()}/>);
		Object.defineProperty(window, "scrollY", { configurable: true, value: 500});
		act(() => {fireEvent.scroll(window)});
		expect(screen.getByRole("button", { name: "Volver arriba" })).toBeInTheDocument();
	});

	it("vuelve al inicio al hacer click en el botón de volver arriba", () => {
		const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()}/>);
		Object.defineProperty(window, "scrollY", {configurable: true, value: 500});
		fireEvent.scroll(window);
		fireEvent.click(screen.getByRole("button", { name: "Volver arriba" }));
		expect(scrollTo).toHaveBeenCalledWith({top: 0, behavior: "smooth"});
		scrollTo.mockRestore();
	});
});