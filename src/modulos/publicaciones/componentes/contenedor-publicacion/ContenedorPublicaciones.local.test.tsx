import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/PublicacionesOperador";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/acciones/PublicacionesProductor";
import ContenedorPublicaciones from "./ContenedorPublicaciones";
import type { OrdenConsulta } from "@/modulos/consulta-mercado/acciones/filtros-consulta";

vi.mock("../../../consulta-mercado/acciones/ConsultarPublicacionOperador.action", () => ({ default: vi.fn() }));
vi.mock("../../tiempo-real/use-actualizaciones-publicaciones", () => ({ useActualizacionesPublicaciones: vi.fn() }));

type Publicacion = PublicacionListado | PublicacionProductorListado;

type PropsListadoPublicaciones = {
    publicaciones: Publicacion[];
};



const { mockListadoPublicaciones } = vi.hoisted(() => ({
  mockListadoPublicaciones: vi.fn<(props: PropsListadoPublicaciones) => null>(() => null),
}));



vi.mock("../listado-publicaciones/ListadoPublicaciones", () => ({ default: mockListadoPublicaciones }));


function crearPublicacion(id: number): PublicacionListado {
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
		tipoPublicacion: "OPERADOR",
		operador: {
			id: 10,
			nombreFantasia: "Huerta Sur",
			whatsApp: "099123456",
		},
	};
}

function publicacionesDelListado(): Publicacion[] | undefined {
    return mockListadoPublicaciones.mock.calls.at(-1)?.[0]?.publicaciones;
}



describe("ContenedorPublicaciones", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("entrega primero las especies prioritarias y luego las demás en orden alfabético", () => {
		const publicaciones = [
			{...crearPublicacion(1), especie: "Pera"},
			{...crearPublicacion(2), especie: "Manzana"},
			{...crearPublicacion(3), especie: "Acelga"},
			{...crearPublicacion(4), especie: "Papa"},
		];
		render(<ContenedorPublicaciones publicaciones={publicaciones}/>);
		expect(publicacionesDelListado()).toEqual([publicaciones[3], publicaciones[1], publicaciones[2], publicaciones[0]]);
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

	it("sincroniza la especie elegida en la URL y permite volver a todas", async () => {
		const urlAnterior = window.location.href;
		window.history.replaceState(window.history.state, "", "/publicaciones?especie=Manzana&orden=asc#lista");
		try {
			const publicaciones = [
				{ ...crearPublicacion(1), especie: "Manzana" },
				{ ...crearPublicacion(2), especie: "Pera" },
			];
			render(<ContenedorPublicaciones publicaciones={publicaciones} especie="Manzana" />);
			fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
			fireEvent.click(screen.getByRole("option", { name: "Pera" }));
			await waitFor(() => expect(publicacionesDelListado()).toEqual([publicaciones[1]]));
			expect(new URL(window.location.href).searchParams.get("especie")).toBe("Pera");
			expect(new URL(window.location.href).searchParams.get("orden")).toBe("asc");
			expect(window.location.hash).toBe("#lista");
			fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
			fireEvent.click(screen.getByRole("option", { name: "Todas" }));
			await waitFor(() => expect(publicacionesDelListado()).toEqual(publicaciones));
			expect(window.location.search).toBe("?orden=asc");
		} finally {
			window.history.replaceState(window.history.state, "", urlAnterior);
		}
	});

	it("filtra publicaciones por nombre del productor", () => {
		const { operador, ...camposComunes } = crearPublicacion(1);
		const publicacion: PublicacionProductorListado = {
			...camposComunes,
			tipoPublicacion: "PRODUCTOR",
			productor: {
				...operador,
				nombreFantasia: "Mercado Verde",
				fotoPerfil: null,
			},
			ubicaciones: [],
		};
		render(<ContenedorPublicaciones publicaciones={[publicacion]} />);
		fireEvent.change(screen.getByLabelText("Buscar publicaciones"), {target: { value: "mercado verde" }});
		expect(publicacionesDelListado()).toEqual([publicacion]);
		fireEvent.change(screen.getByLabelText("Buscar publicaciones"), {target: { value: "Otro productor" }});
		expect(publicacionesDelListado()).toEqual([]);
	});

	it.each([
		{ orden: "alfabeticoAsc", esperado: [2, 3, 1] },
		{ orden: "alfabeticoDesc", esperado: [1, 3, 2] },
		{ orden: "precioAsc", esperado: [3, 1, 2] },
		{ orden: "precioDesc", esperado: [2, 1, 3] },
		{ orden: "prioridad", esperado: [3, 1, 2] },
		{ orden: "ninguno", esperado: [1, 2, 3] },
	] satisfies { orden: OrdenConsulta; esperado: number[] }[])("aplica el orden inicial $orden", ({ orden, esperado }) => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Tomate", precio: 30 },
			{ ...crearPublicacion(2), especie: "Acelga", precio: 50 },
			{ ...crearPublicacion(3), especie: "Papa", precio: 10 },
		];

		render(<ContenedorPublicaciones publicaciones={datos} ordenInicial={orden} />);

		expect(publicacionesDelListado()?.map((publicacion) => publicacion.id)).toEqual(esperado);
	});

	it("oculta Ordenar por y aplica el predeterminado cuando está deshabilitado", () => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Acelga" },
			{ ...crearPublicacion(2), especie: "Tomate" },
		];
		render(<ContenedorPublicaciones publicaciones={datos} ordenInicial="alfabeticoDesc" ordenamientoHabilitado={false} />);
		expect(screen.queryByRole("button", { name: "Ordenar por" })).not.toBeInTheDocument();
		expect(publicacionesDelListado()?.map((publicacion) => publicacion.id)).toEqual([2, 1]);
	});

	it("permite cambiar el orden cuando está habilitado", async () => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Tomate" },
			{ ...crearPublicacion(2), especie: "Acelga" },
		];
		render(<ContenedorPublicaciones publicaciones={datos} ordenInicial="alfabeticoAsc" ordenamientoHabilitado />);
		expect(publicacionesDelListado()?.map((publicacion) => publicacion.id)).toEqual([2, 1]);
		fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
		fireEvent.click(screen.getByRole("menuitemradio", { name: "Z-A" }));
		await waitFor(() => expect(publicacionesDelListado()?.map((publicacion) => publicacion.id)).toEqual([1, 2]));
	});

	it("filtra por especie conservando el orden configurado", () => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Tomate", precio: 30 },
			{ ...crearPublicacion(2), especie: "Papa", precio: 5 },
			{ ...crearPublicacion(3), especie: "Tomate", precio: 10 },
		];
		render(<ContenedorPublicaciones publicaciones={datos} especie="Tomate" ordenInicial="precioAsc" ordenamientoHabilitado={false} />);
		expect(publicacionesDelListado()?.map((publicacion) => publicacion.id)).toEqual([3, 1]);
	});

	it.each(["precioAsc", "precioDesc"] as const)("coloca las publicaciones sin precio al final con %s", (orden) => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Tomate", precio: null },
			{ ...crearPublicacion(2), especie: "Acelga", precio: 50 },
			{ ...crearPublicacion(3), especie: "Papa", precio: 10 },
			{ ...crearPublicacion(4), especie: "Pera", precio: null },
		];
		render(<ContenedorPublicaciones publicaciones={datos} ordenInicial={orden} />);
		const resultado = publicacionesDelListado();
		expect(resultado?.slice(0, 2).map((publicacion) => publicacion.id)).toEqual(orden === "precioAsc" ? [3, 2] : [2, 3]);
		expect(resultado?.slice(2).map((publicacion) => publicacion.precio)).toEqual([null, null]);
	});

	it("no modifica el arreglo de publicaciones recibido", () => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Tomate" },
			{ ...crearPublicacion(2), especie: "Acelga" },
		];
		const copia = datos.map((publicacion) => ({ ...publicacion }));
		render(<ContenedorPublicaciones publicaciones={datos} ordenInicial="alfabeticoAsc" />);
		expect(datos).toEqual(copia);
		expect(datos.map((publicacion) => publicacion.id)).toEqual([1, 2]);
	});

	it("descarta una especie inexistente en lugar de vaciar el listado", () => {
		const datos = [
			{ ...crearPublicacion(1), especie: "Tomate" },
			{ ...crearPublicacion(2), especie: "Acelga" },
		];
		render(<ContenedorPublicaciones publicaciones={datos} especie="Inexistente" ordenInicial="alfabeticoAsc" />);
		expect(publicacionesDelListado()?.map((publicacion) => publicacion.id)).toEqual([2, 1]);
	});
});
