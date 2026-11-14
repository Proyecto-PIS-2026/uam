import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DatosCatalogo, ElementoCatalogo, ResultadoCatalogo, TipoCatalogo } from "../../catalogos/tipos";
import CatalogosPublicacion from "./CatalogosPublicacion";

const mocks = vi.hoisted(() => ({
    listar: vi.fn<(tipo: TipoCatalogo) => Promise<ElementoCatalogo[]>>(),
    guardar: vi.fn<(tipo: TipoCatalogo, datos: DatosCatalogo, id?: number) => Promise<ResultadoCatalogo>>(),
    eliminar: vi.fn<(tipo: TipoCatalogo, id: number) => Promise<ResultadoCatalogo>>(),
}));

vi.mock("../../catalogos/acciones", () => ({
    listarCatalogo: mocks.listar,
    guardarElementoCatalogo: mocks.guardar,
    eliminarElementoCatalogo: mocks.eliminar,
}));

const elementos: Record<TipoCatalogo, ElementoCatalogo[]> = {
    empaquetados: [{ id: 1, nombre: "Cajón" }],
    kilos: [{ id: 2, nombre: "10-12" }],
    calibres: [{ id: 3, nombre: "Grande", codigo: "G" }],
    categorias: [{ id: 4, nombre: "Primera" }],
};

beforeEach(() => {
    vi.resetAllMocks();
    mocks.listar.mockImplementation(async (tipo) => elementos[tipo]);
    mocks.guardar.mockResolvedValue({ ok: true });
    mocks.eliminar.mockResolvedValue({ ok: true });
});

afterEach(cleanup);

async function preparar() {
    render(<CatalogosPublicacion />);
    await screen.findByRole("button", { name: "Modificar Cajón" });
}

async function seleccionarCatalogo(etiqueta: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: /Catálogo/ }));
    fireEvent.click(await screen.findByRole("option", { name: etiqueta, exact: true }));
    await waitFor(() => expect(screen.queryByRole("listbox")).not.toBeInTheDocument());
}

describe("CatalogosPublicacion", () => {
    it("ofrece los cuatro catálogos y carga inicialmente los empaquetados", async () => {
        await preparar();

        expect(mocks.listar).toHaveBeenCalledExactlyOnceWith("empaquetados");
        const tabla = screen.getByRole("table", { name: "Valores de Empaquetados" });
        expect(tabla).toHaveTextContent("Cajón");
        expect(within(tabla).getAllByRole("columnheader").map((columna) => columna.textContent)).toEqual(["Valor", "Opciones"]);
        expect(screen.queryByText("Administrá los valores disponibles para todas las especies y variedades.")).not.toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /Catálogo/ }));
        expect((await screen.findAllByRole("option")).map((opcion) => opcion.textContent)).toEqual(["Empaquetados", "Kilos", "Calibres", "Categorías"]);
    });

    it.each([
        { tipo: "kilos", etiqueta: "Kilos", valor: "10-12" },
        { tipo: "calibres", etiqueta: "Calibres", valor: "G - Grande" },
        { tipo: "categorias", etiqueta: "Categorías", valor: "Primera" },
    ])("carga el listado de $etiqueta al seleccionarlo", async ({ tipo, etiqueta, valor }) => {
        await preparar();
        await seleccionarCatalogo(etiqueta);

        expect(await screen.findByRole("table", { name: `Valores de ${etiqueta}` })).toHaveTextContent(valor);
        expect(mocks.listar).toHaveBeenLastCalledWith(tipo);
        expect(screen.queryByText("Cajón")).not.toBeInTheDocument();
    });

    it("ignora la respuesta anterior si se cambia de catálogo durante una carga", async () => {
        await preparar();
        let resolverKilos!: (datos: ElementoCatalogo[]) => void;
        mocks.listar.mockImplementation((tipo) => tipo === "kilos"
            ? new Promise((resolve) => { resolverKilos = resolve; })
            : Promise.resolve(elementos[tipo]));

        await seleccionarCatalogo("Kilos");
        expect(screen.getByText("Cargando catálogo...")).toBeInTheDocument();
        await seleccionarCatalogo("Categorías");
        await screen.findByText("Primera");
        await act(async () => { resolverKilos(elementos.kilos); });

        expect(screen.getByText("Primera")).toBeInTheDocument();
        expect(screen.queryByText("10-12")).not.toBeInTheDocument();
    });

    it("permite reintentar una carga fallida", async () => {
        mocks.listar.mockRejectedValueOnce(new Error("Fallo de red"));
        render(<CatalogosPublicacion />);

        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el catálogo");
        expect(screen.getByRole("button", { name: "Agregar valor" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
        expect(await screen.findByText("Cajón")).toBeInTheDocument();
    });

    it("agrega un valor al catálogo elegido y vuelve a cargar el listado", async () => {
        await preparar();
        fireEvent.click(screen.getByRole("button", { name: "Agregar valor" }));
        const dialogo = screen.getByRole("dialog", { name: "Agregar valor" });
        fireEvent.change(within(dialogo).getByRole("textbox", { name: /Nombre/ }), { target: { value: "Bolsa" } });
        mocks.listar.mockResolvedValueOnce([...elementos.empaquetados, { id: 5, nombre: "Bolsa" }]);
        fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

        expect(await screen.findByRole("button", { name: "Modificar Bolsa" })).toBeInTheDocument();
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith("empaquetados", { nombre: "Bolsa" }, undefined);
        expect(mocks.listar).toHaveBeenCalledTimes(2);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("modifica el mismo ID y explica el efecto sobre todas sus publicaciones", async () => {
        await preparar();
        fireEvent.click(screen.getByRole("button", { name: "Modificar Cajón" }));
        const dialogo = screen.getByRole("dialog", { name: "Modificar valor" });
        expect(within(dialogo).getByText("El cambio se reflejará en todas las publicaciones que usan este valor.")).toBeInTheDocument();
        expect(within(dialogo).getByRole("textbox", { name: /Nombre/ })).toHaveValue("Cajón");
        fireEvent.change(within(dialogo).getByRole("textbox", { name: /Nombre/ }), { target: { value: "Cajón grande" } });
        fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith("empaquetados", { nombre: "Cajón grande" }, 1));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("conserva código y descripción al editar un calibre", async () => {
        await preparar();
        await seleccionarCatalogo("Calibres");
        fireEvent.click(await screen.findByRole("button", { name: "Modificar G - Grande" }));
        const dialogo = screen.getByRole("dialog", { name: "Modificar valor" });
        expect(within(dialogo).getByRole("textbox", { name: /Código/ })).toHaveValue("G");
        fireEvent.change(within(dialogo).getByRole("textbox", { name: /Descripción/ }), { target: { value: "Grande especial" } });
        fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith("calibres", { codigo: "G", nombre: "Grande especial" }, 3));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it.each(["alta", "edición"])("mantiene el formulario de %s abierto cuando el valor está duplicado", async (operacion) => {
        mocks.guardar.mockResolvedValue({ ok: false, mensaje: "Ya existe un valor igual en este catálogo." });
        await preparar();
        fireEvent.click(screen.getByRole("button", { name: operacion === "alta" ? "Agregar valor" : "Modificar Cajón" }));
        const dialogo = screen.getByRole("dialog");
        fireEvent.change(within(dialogo).getByRole("textbox", { name: /Nombre/ }), { target: { value: "Bolsa" } });
        fireEvent.click(within(dialogo).getByRole("button", { name: "Guardar" }));

        expect(await within(dialogo).findByRole("alert")).toHaveTextContent("Ya existe un valor igual");
        expect(within(dialogo).getByRole("textbox", { name: /Nombre/ })).toHaveValue("Bolsa");
        expect(mocks.listar).toHaveBeenCalledOnce();
    });

    it("bloquea los controles y no duplica un guardado pendiente", async () => {
        let resolver!: (resultado: ResultadoCatalogo) => void;
        mocks.guardar.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
        await preparar();
        const selector = screen.getByRole("combobox");
        fireEvent.click(screen.getByRole("button", { name: "Modificar Cajón" }));
        const guardar = screen.getByRole("button", { name: "Guardar" });
        fireEvent.click(guardar);
        fireEvent.click(guardar);

        expect(guardar).toBeDisabled();
        expect(selector).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(mocks.guardar).toHaveBeenCalledOnce();
        await act(async () => { resolver({ ok: true }); });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    it("muestra un popup y conserva el valor cuando tiene publicaciones asociadas", async () => {
        mocks.eliminar.mockResolvedValue({ ok: false, mensaje: "No se puede eliminar porque existen publicaciones asociadas." });
        await preparar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar Cajón" }));
        const confirmacion = screen.getByRole("alertdialog", { name: "Eliminar valor" });
        fireEvent.click(within(confirmacion).getByRole("button", { name: "Eliminar" }));

        const aviso = await screen.findByRole("alertdialog", { name: "No se pudo eliminar" });
        expect(aviso).toHaveTextContent("existen publicaciones asociadas");
        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith("empaquetados", 1);
        expect(mocks.listar).toHaveBeenCalledOnce();
        fireEvent.click(within(aviso).getByRole("button", { name: "Entendido" }));
        expect(await screen.findByRole("button", { name: "Modificar Cajón" })).toBeInTheDocument();
    });

    it("elimina un valor libre después de confirmar y actualiza el listado", async () => {
        await preparar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar Cajón" }));
        mocks.listar.mockResolvedValueOnce([]);
        fireEvent.click(within(screen.getByRole("alertdialog", { name: "Eliminar valor" })).getByRole("button", { name: "Eliminar" }));

        expect(await screen.findByText("No hay valores en este catálogo.")).toBeInTheDocument();
        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith("empaquetados", 1);
        expect(screen.queryByText("Cajón")).not.toBeInTheDocument();
    });

    it("cancelar la confirmación no elimina el valor", async () => {
        await preparar();
        fireEvent.click(screen.getByRole("button", { name: "Eliminar Cajón" }));
        fireEvent.click(within(screen.getByRole("alertdialog", { name: "Eliminar valor" })).getByRole("button", { name: "Cancelar" }));

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(mocks.eliminar).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Modificar Cajón" })).toBeInTheDocument();
    });
});
