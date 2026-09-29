// Eliminar comentarios luego de integrar los filtros
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
//import { useEffect } from "react";

import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/Publicaciones";
import ContenedorPublicaciones from "./ContenedorPublicaciones";

type PropsListadoPublicaciones = {
  publicaciones: PublicacionListado[];
};

/*type PropsFiltrosPublicaciones = {
	publicaciones: PublicacionListado[];
	especieFiltro: string;
	alFiltrar?: (publicaciones: PublicacionListado[]) => void;
};*/

const { mockListadoPublicaciones } = vi.hoisted(() => ({
  mockListadoPublicaciones: vi.fn<(props: PropsListadoPublicaciones) => null>(() => null),
}));

/*const { mockFiltrosPublicaciones } = vi.hoisted(() => ({
	mockFiltrosPublicaciones: vi.fn(({publicaciones, alFiltrar}: PropsFiltrosPublicaciones) => {
		useEffect(() => {
			alFiltrar?.(publicaciones) }, [publicaciones, alFiltrar]);
			return null;
	})
}));*/

vi.mock("../listado-publicaciones/ListadoPublicacionesUnificado", () => ({ default: mockListadoPublicaciones }));

//vi.mock("../../filtros/FiltrosPublicaciones", () => ({ default: mockFiltrosPublicaciones }));

function crearPublicacion(id: number): PublicacionListado {
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
		pais: "Uruguay",
		operador: {
			id: 10,
			nombreFantasia: "Huerta Sur",
			whatsApp: "099123456",
		},
	};
}

function publicacionesDelListado(): PublicacionListado[] | undefined {
	return mockListadoPublicaciones.mock.calls.at(-1)?.[0]?.publicaciones;
}

/*function especieDelFiltro(): string | undefined {
	return mockFiltrosPublicaciones.mock.calls.at(-1)?.[0]?.especieFiltro;
}*/

describe("ContenedorPublicaciones", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("entrega al listado todas las publicaciones en el orden recibido", () => {
		const publicaciones = [crearPublicacion(7), crearPublicacion(2)];
		render(<ContenedorPublicaciones publicaciones={publicaciones}/>);
		expect(publicacionesDelListado()).toEqual(publicaciones);
	});

	it("entrega una lista vacía cuando no hay publicaciones", () => {
		render(<ContenedorPublicaciones publicaciones={[]}/>);
		expect(publicacionesDelListado()).toEqual([]);
	});

	it("actualiza el listado cuando recibe nuevas publicaciones", () => {
		const { rerender } = render(<ContenedorPublicaciones publicaciones={[crearPublicacion(7)]}/>);
		const publicaciones = [crearPublicacion(2), crearPublicacion(9)];
		rerender(<ContenedorPublicaciones publicaciones={publicaciones}/>);
		expect(publicacionesDelListado()).toEqual(publicaciones);
	});

	it("actualiza los datos aunque la publicación conserve el mismo ID", () => {
		const publicacion = crearPublicacion(7);
		const { rerender } = render(<ContenedorPublicaciones publicaciones={[publicacion]}/>);
		const actualizada = {...publicacion, precio: 80, foto: "/tomate.jpg"};
		rerender(<ContenedorPublicaciones publicaciones={[actualizada]}/>);
		expect(publicacionesDelListado()).toEqual([actualizada]);
	});


	it("quita la especie de la URL al limpiar filtros y conserva los demás parámetros", async () => {
		const urlAnterior = window.location.href;
		window.history.replaceState(window.history.state, "", "/publicaciones?especie=Manzana&orden=asc#lista");

		try {
			const publicaciones = [
				{ ...crearPublicacion(1), especie: "Manzana" },
				{ ...crearPublicacion(2), especie: "Pera" },
			];
			render(<ContenedorPublicaciones publicaciones={publicaciones} especie="Manzana" />);
			expect(publicacionesDelListado()).toEqual([publicaciones[0]]);

			fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

			await waitFor(() => expect(publicacionesDelListado()).toEqual(publicaciones));
			expect(window.location.pathname).toBe("/publicaciones");
			expect(window.location.search).toBe("?orden=asc");
			expect(window.location.hash).toBe("#lista");
		} finally {
			window.history.replaceState(window.history.state, "", urlAnterior);
		}
	});

	/* Tests nuevos
	it("vacía el listado cuando se quitan las publicaciones", () => {
		const { rerender } = render(<ContenedorPublicaciones publicaciones={[crearPublicacion(7)]}/>);
		rerender(<ContenedorPublicaciones publicaciones={[]}/>);
		expect(publicacionesDelListado()).toEqual([]);
	});

	it("muestra los resultados que llegan después de una lista vacía", () => {
		const { rerender } = render(<ContenedorPublicaciones publicaciones={[]}/>);
		const publicaciones = [crearPublicacion(7)];
		rerender(<ContenedorPublicaciones publicaciones={publicaciones}/>);
		expect(publicacionesDelListado()).toEqual(publicaciones);
	});
	
	it("pasa la especie válida al filtro", () => {
		const publicaciones = [{ ...crearPublicacion(1), especie: "Manzana" }];
		render(<ContenedorPublicaciones publicaciones={publicaciones} especie="Manzana"/>);
		expect(especieDelFiltro()).toBe("Manzana");
	});

	it("pasa una especie vacía al filtro cuando la especie no es válida", () => {
		const publicaciones = [{ ...crearPublicacion(1), especie: "Manzana" }];
		render(<ContenedorPublicaciones publicaciones={publicaciones} especie="Error"/>);
		expect(especieDelFiltro()).toBe("");
	});*/
});
