import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
	default: (props: Record<string, unknown>) => <img {...props} />,
}));

vi.mock("../../../../compartido/componentes/ConfirmModal", () => ({
	ConfirmModal: ({ abierto, titulo, descripcion, textoConfirmar, textoCancelar, alConfirmar, alCancelar }: {
		abierto: boolean;
		titulo: string;
		descripcion: string;
		textoConfirmar: string;
		textoCancelar: string;
		alConfirmar: () => void;
		alCancelar: () => void;
	}) => abierto ? <div role="alertdialog"><h2>{titulo}</h2><p>{descripcion}</p><button onClick={alCancelar}>{textoCancelar}</button><button onClick={alConfirmar}>{textoConfirmar}</button></div> : null,
}));

import NuevaPublicacionPage from "./page";

const catalogos = {
	operadores: [{ id: 1, nombre: "Operador 1" }],
	especies: [{ id: 2, nombre: "Manzana" }],
	variedades: [{ id: 3, nombre: "Royal", especieId: 2 }],
	presentaciones: [{ id: 4, nombre: "Caja", variedadId: 3 }],
	categorias: [{ id: 5, nombre: "Primera", especieId: 2 }],
	calibres: [{ id: 6, nombre: "Grande" }],
	paises: [{ id: 7, nombre: "Uruguay" }],
};

function prepararFetch(publicaciones: Array<Record<string, unknown>> = [], resultadoAlta: Record<string, unknown> = { mensaje: "Publicación creada correctamente.", id: 15 }, estadoAlta = 201) {
	vi.stubGlobal("fetch", vi.fn((url: string, opciones?: RequestInit) => {
		if (opciones?.method === "POST") {
			return Promise.resolve(new Response(JSON.stringify(resultadoAlta), { status: estadoAlta }));
		}
		if (opciones?.method === "DELETE") {
			return Promise.resolve(new Response(JSON.stringify({ mensaje: "Publicación eliminada." }), { status: 200 }));
		}
		if (url.includes("/operador/")) {
			return Promise.resolve(new Response(JSON.stringify({ publicaciones }), { status: 200 }));
		}
		return Promise.resolve(new Response(JSON.stringify(catalogos), { status: 200 }));
	}));
}

function completarFormulario(formulario: HTMLFormElement) {
	const formularioConsultable = within(formulario);
	fireEvent.change(formularioConsultable.getByLabelText("Operador"), { target: { value: "1" } });
	fireEvent.change(formularioConsultable.getByLabelText("País de origen"), { target: { value: "7" } });
	fireEvent.change(formularioConsultable.getByLabelText("Especie"), { target: { value: "2" } });
	fireEvent.change(formularioConsultable.getByLabelText("Variedad"), { target: { value: "3" } });
	fireEvent.change(formularioConsultable.getByLabelText("Presentación"), { target: { value: "4" } });
	fireEvent.change(formularioConsultable.getByLabelText("Categoría"), { target: { value: "5" } });
	fireEvent.change(formularioConsultable.getByLabelText("Calibre"), { target: { value: "6" } });
	fireEvent.change(formularioConsultable.getByLabelText("Precio"), { target: { value: "1250" } });
}

describe("NuevaPublicacionPage", () => {
	beforeEach(() => {
		prepararFetch();
		HTMLDialogElement.prototype.showModal = function () { this.open = true; };
		HTMLDialogElement.prototype.close = function () { this.open = false; };
	});

	it("abre el formulario de nueva publicación", async () => {
		render(<NuevaPublicacionPage />);
		fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
		expect(screen.getByRole("heading", { name: "Nueva publicación" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
	});

	it("carga las publicaciones al seleccionar un operador", async () => {
		render(<NuevaPublicacionPage />);
		const operadores = await screen.findAllByLabelText("Operador");
		const operador = operadores[0];
		fireEvent.change(operador, { target: { value: "1" } });
		expect(await screen.findByText("Este operador no tiene publicaciones.")).toBeInTheDocument();
	});

	it("conserva únicamente dígitos en el precio", async () => {
		render(<NuevaPublicacionPage />);
		const precio = await screen.findByLabelText("Precio");
		fireEvent.change(precio, { target: { value: "12a.50" } });
		expect(precio).toHaveValue("1250");
	});

	it("muestra la vista previa de una fotografía válida", async () => {
		const resultadoLectura = "data:image/png;base64,imagen";
		vi.stubGlobal("FileReader", class {
			result = resultadoLectura;
			onload: (() => void) | null = null;
			readAsDataURL() { this.onload?.(); }
		});
		render(<NuevaPublicacionPage />);
		const fotografia = await screen.findByLabelText("Fotografía");
		const archivo = new File(["imagen"], "foto.png", { type: "image/png" });
		fireEvent.change(fotografia, { target: { files: [archivo] } });
		expect(await screen.findByAltText("Vista previa de la fotografía")).toBeInTheDocument();
	});

	it("rechaza una fotografía inválida", async () => {
		render(<NuevaPublicacionPage />);
		fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
		const fotografia = await screen.findByLabelText("Fotografía");
		const archivo = new File(["texto"], "archivo.txt", { type: "text/plain" });
		fireEvent.change(fotografia, { target: { files: [archivo] } });
		expect(await screen.findByRole("alert")).toHaveTextContent("La fotografía debe ser PNG, JPEG o WebP");
	});

	it("muestra los errores devueltos al enviar", async () => {
		prepararFetch([], { errores: ["La publicación no es válida."] }, 400);
		render(<NuevaPublicacionPage />);
		fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
		const formulario = (await screen.findByRole("button", { name: "Crear publicación" })).closest("form");
		if (!formulario) throw new Error("No se encontró el formulario de publicación.");

		fireEvent.submit(formulario);

		expect(await screen.findByRole("alert")).toHaveTextContent("La publicación no es válida.");
	});

	it("elimina una publicación desde la confirmación", async () => {
		prepararFetch([{
			id: 15,
			fecha: "2026-09-26T00:00:00.000Z",
			especie: "Manzana",
			variedad: "Royal",
			presentacion: "Caja",
			categoria: "Primera",
			calibre: "Grande",
			pais: "Uruguay",
			precio: "1250",
			disponible: true,
		}]);
		render(<NuevaPublicacionPage />);
		const operadores = await screen.findAllByLabelText("Operador");
		fireEvent.change(operadores[0], { target: { value: "1" } });
		fireEvent.click(await screen.findByRole("button", { name: "Eliminar publicación" }));
		fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

		await waitFor(() => expect(fetch).toHaveBeenCalledWith("/api/publicaciones/15?operadorId=1", { method: "DELETE" }));
	});

	it("envía una publicación válida y muestra el mensaje de éxito", async () => {
		render(<NuevaPublicacionPage />);
		fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
		const botonCrear = await screen.findByRole("button", { name: "Crear publicación" });
		const formulario = botonCrear.closest("form");
		if (!formulario) throw new Error("No se encontró el formulario de publicación.");
		completarFormulario(formulario);
		fireEvent.click(within(formulario).getByLabelText("Disponible"));
		fireEvent.submit(formulario);

		expect(await screen.findByRole("status")).toHaveTextContent("Publicación creada correctamente. ID: 15");
		expect(fetch).toHaveBeenCalledWith("/api/publicaciones", expect.objectContaining({ method: "POST" }));
	});
});
