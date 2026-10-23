import { act, fireEvent, render, screen, within } from "@testing-library/react";
import useMediaQuery from "@mui/material/useMediaQuery";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import ListadoPublicaciones from "./ListadoPublicaciones";


function crearPublicacion(id: number, operadorId = 10, nombreFantasia = "Huerta Sur"): PublicacionListado {
	return {
		id,
		especie: `Producto ${id}`,
		variedad: "-",
		precio: 150,
		fecha: "2026-10-03T15:00:00.000Z",
		foto: null,
		presentacion: "Cajón",
		categoria: "Primera",
		calibre: "Mediano",
		codigoCalibre: "M",
		pais: "Uruguay",
		tipoPublicacion: "OPERADOR" as const,
		operador: { id: operadorId, nombreFantasia, whatsApp: "099123456" },
	};
}

type TarjetaProps = { publicacion: PublicacionListado; onClick: () => void };

it("actualiza el detalle abierto con los datos remotos y lo retira si desaparece la publicación", () => {
    const publicacion = crearPublicacion(7);
    const otra = crearPublicacion(8);
    const vista = render(<ListadoPublicaciones publicaciones={[publicacion, otra]} />);
    fireEvent.click(screen.getByRole("button", { name: /Producto 7/ }));
    expect(within(screen.getByRole("dialog")).getByText("150")).toBeInTheDocument();

    vista.rerender(<ListadoPublicaciones publicaciones={[{ ...publicacion, precio: 240 }, otra]} />);
    expect(within(screen.getByRole("dialog")).getByText("240")).toBeInTheDocument();

    vista.rerender(<ListadoPublicaciones publicaciones={[otra]} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

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
    "@/modulos/publicaciones/componentes/drawer-publicacion/DrawerPublicacion",
    () => ({
        DrawerPublicacion: ({publicacion, open, onOpenChange}: {
            publicacion: PublicacionListado | PublicacionProductorListado;
            open: boolean;
            onOpenChange: (open: boolean) => void;
        }) =>
            open ? (
                <div role="dialog" aria-label={`Detalle ${publicacion.especie}`}>
                    <span>
						{publicacion.tipoPublicacion === "PRODUCTOR" ? publicacion.productor.nombreFantasia : publicacion.operador.nombreFantasia}
					</span>
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
		expect(screen.getByText("Publicaciones", { exact: true })).toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: /^Producto / }).map((tarjeta) => 
			tarjeta.textContent)).toEqual(["Producto 7 — Huerta Sur", "Producto 2 — Frutas Norte", "Producto 9 — Huerta Sur"]);
		expect(screen.getByRole("button", { name: "Agrupar" })).toBeInTheDocument();
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("agrupa publicaciones del mismo operador aunque no sean consecutivas y muestra sus cantidades", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		const grupoSur = screen.getByText("Huerta Sur", { exact: true }).parentElement!.parentElement!;
		const grupoNorte = screen.getByText("Frutas Norte", { exact: true }).parentElement!.parentElement!;
		expect(within(grupoSur).getAllByRole("button").map((boton) => boton.textContent)).toEqual(["Producto 7", "Producto 9"]);
		expect(within(grupoNorte).getAllByRole("button").map((boton) => boton.textContent)).toEqual(["Producto 2"]);
		expect(within(grupoSur).getByText("productos").parentElement).toHaveTextContent(/^2 productos$/);
		expect(within(grupoNorte).getByText("producto").parentElement).toHaveTextContent(/^1 producto$/);
	});

	it("mantiene separados operadores con igual nombre pero distinto ID", () => {
		render(<ListadoPublicaciones publicaciones={[crearPublicacion(7, 10), crearPublicacion(2, 20)]}/>);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		const nombres = screen.getAllByText("Huerta Sur", { exact: true });
		expect(nombres).toHaveLength(2);
		const grupos = nombres.map((nombre) => nombre.parentElement!.parentElement!);
		expect(grupos[0]).not.toBe(grupos[1]);
		expect(within(grupos[0]).getAllByRole("button")).toHaveLength(1);
		expect(within(grupos[0]).getByRole("button", { name: "Producto 7" })).toBeInTheDocument();
		expect(within(grupos[1]).getAllByRole("button")).toHaveLength(1);
		expect(within(grupos[1]).getByRole("button", { name: "Producto 2" })).toBeInTheDocument();
	});

	it("permite desagrupar y recupera el orden original", () => {
		render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		fireEvent.click(screen.getByRole("button", { name: "Desagrupar" }));
		expect(screen.getByRole("button", { name: "Agrupar" })).toHaveAttribute("aria-pressed", "false");
		expect(screen.queryByText("Huerta Sur", { exact: true })).not.toBeInTheDocument();
		expect(screen.getAllByRole("button", { name: /^Producto / }).map((boton) => boton.textContent))
			.toEqual(["Producto 7 — Huerta Sur", "Producto 2 — Frutas Norte", "Producto 9 — Huerta Sur"]);
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
		const { rerender } = render(<ListadoPublicaciones publicaciones={publicacionesDeEjemplo()} />);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		rerender(<ListadoPublicaciones publicaciones={[crearPublicacion(5, 30, "Nueva Huerta")]}/>);
		expect(screen.getByText("Nueva Huerta", { exact: true })).toBeInTheDocument();
		expect(screen.queryByText("Huerta Sur", { exact: true })).not.toBeInTheDocument();
		expect(screen.queryByText("Frutas Norte", { exact: true })).not.toBeInTheDocument();
		const tarjetas = screen.getAllByRole("button", { name: /^Producto / });
		expect(tarjetas).toHaveLength(1);
		expect(tarjetas[0]).toHaveAccessibleName("Producto 5");
		rerender(<ListadoPublicaciones publicaciones={[]} />);
		expect(screen.getByRole("status")).toBeInTheDocument();
		expect(screen.queryByText("Nueva Huerta", { exact: true })).not.toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /^Producto / })).not.toBeInTheDocument();
	});

	it("abre el detalle inferior en mobile", () => {
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

function crearPublicacionProductor( id: number, productorId = 10, nombreFantasia = "Huerta Productora"): PublicacionProductorListado {
    return {
        id,
        precio: 150,
        fecha: "2026-10-03T15:00:00.000Z",
        foto: null,
        especie: `Producto ${id}`,
        variedad: "-",
        presentacion: "Cajón",
        categoria: "Primera",
        calibre: "Mediano",
        codigoCalibre: "M",
        pais: "Uruguay",
        tipoPublicacion: "PRODUCTOR",
        productor: {
            id: productorId,
            nombreFantasia,
            fotoPerfil: null,
            whatsApp: "099123456",
        },
        ubicaciones: [],
    };
}

type TarjetaProductorProps = {
    publicacion: PublicacionProductorListado;
    onClick: () => void;
};

vi.mock(
    "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionConProductor",
    () => ({
        default: ({ publicacion, onClick }: TarjetaProductorProps) => (
            <button onClick={onClick}>
                {publicacion.especie} — {publicacion.productor.nombreFantasia}
            </button>
        ),
    }),
);

vi.mock(
    "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionSinProductor",
    () => ({
        default: ({ publicacion, onClick }: TarjetaProductorProps) => (
            <button onClick={onClick}>
                {publicacion.especie}
            </button>
        ),
    }),
);

describe("ListadoPublicaciones con productores", () => {
	it("muestra productores sin agrupar y conserva el orden recibido", () => {
		const publicaciones = [
			crearPublicacionProductor(7, 10, "Huerta Sur"),
			crearPublicacionProductor(2, 20, "Frutas Norte"),
			crearPublicacionProductor(9, 10, "Huerta Sur"),
		];
		render(<ListadoPublicaciones publicaciones={publicaciones} />);
		expect(screen.getAllByRole("button", { name: /^Producto / }).map((tarjeta) => tarjeta.textContent)).
			toEqual(["Producto 7 — Huerta Sur", "Producto 2 — Frutas Norte", "Producto 9 — Huerta Sur"]);

		expect(screen.getByRole("button", { name: "Agrupar" })).toHaveAttribute("aria-pressed", "false");
	});

	it("agrupa publicaciones del mismo productor aunque no sean consecutivas", () => {
		render(
			<ListadoPublicaciones
				publicaciones={[
					crearPublicacionProductor(7, 10, "Huerta Sur"),
					crearPublicacionProductor(2, 20, "Frutas Norte"),
					crearPublicacionProductor(9, 10, "Huerta Sur"),
				]}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		const grupoSur = screen.getByText("Huerta Sur", { exact: true }).parentElement!.parentElement!;
		const grupoNorte = screen.getByText("Frutas Norte", { exact: true }).parentElement!.parentElement!;
		expect(within(grupoSur).getAllByRole("button").map((boton) => boton.textContent)).
			toEqual(["Producto 7", "Producto 9"]);
		expect(within(grupoNorte).getAllByRole("button").map((boton) => boton.textContent)).toEqual(["Producto 2"]);
		expect(within(grupoSur).getByText("productos").parentElement).toHaveTextContent(/^2 productos$/);
		expect(within(grupoNorte).getByText("producto").parentElement).toHaveTextContent(/^1 producto$/);
	});

	it.each([false, true])("abre y cierra el detalle de un productor con agrupación %s", (agrupar) => {
		render(
			<ListadoPublicaciones
				publicaciones={[crearPublicacionProductor(7, 10, "Huerta Productora")]}
			/>
		);
		if (agrupar) {
			fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		}
		fireEvent.click(screen.getByRole("button", {name: agrupar ? "Producto 7" : "Producto 7 — Huerta Productora"}));
		const detalle = screen.getByRole("dialog", {name: "Detalle Producto 7"});
		expect(within(detalle).getByText("Huerta Productora")).toBeInTheDocument();
		expect(within(detalle).getByText("150")).toBeInTheDocument();
		fireEvent.click(within(detalle).getByRole("button", { name: "Cerrar" }));
		expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
	});

	it("separa operadores y productores aunque tengan el mismo ID y nombre", () => {
		render(
			<ListadoPublicaciones
				publicaciones={[crearPublicacion(7, 10, "Huerta Sur"), crearPublicacionProductor(2, 10, "Huerta Sur")]}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Agrupar" }));
		const nombres = screen.getAllByText("Huerta Sur", { exact: true });
		expect(nombres).toHaveLength(2);
		const grupos = nombres.map((nombre) => nombre.parentElement!.parentElement!);
		expect(grupos[0]).not.toBe(grupos[1]);
		expect(within(grupos[0]).getAllByRole("button")).toHaveLength(1);
		expect(within(grupos[0]).getByRole("button", { name: "Producto 7" })).toBeInTheDocument();
		expect(within(grupos[1]).getAllByRole("button")).toHaveLength(1);
		expect(within(grupos[1]).getByRole("button", { name: "Producto 2" })).toBeInTheDocument();
	});
});
