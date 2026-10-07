import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPreciosReferencia, type PrecioReferencia } from "./consultas-precios-referencia";
import PreciosReferencia from "./PreciosReferencia";

const { navegar } = vi.hoisted(() => ({ navegar: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navegar }) }));

beforeEach(() => {
    vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "local");
    navegar.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

const filasConPreciosDistintos: PrecioReferencia[] = [
    {
        id: "bajo", especie: "Acelga", variedad: "Común", calibre: "M", pais: "URUGUAY",
        unidad: "UN", categoria: "I", esReferencia: false,
        precioMinimoUnidad: 10, precioMaximoUnidad: 90,
        precioMinimoKg: 100, precioMaximoKg: 120,
    },
    {
        id: "justo", especie: "Banana", variedad: "Cavendish", calibre: "M", pais: "URUGUAY",
        unidad: "UN", categoria: "I", esReferencia: false,
        precioMinimoUnidad: 50, precioMaximoUnidad: 70,
        precioMinimoKg: 5, precioMaximoKg: 10,
    },
    {
        id: "alto", especie: "Cebolla", variedad: "Blanca", calibre: "M", pais: "URUGUAY",
        unidad: "UN", categoria: "I", esReferencia: false,
        precioMinimoUnidad: 80, precioMaximoUnidad: 100,
        precioMinimoKg: 20, precioMaximoKg: 80,
    },
];

function renderizarPreciosDistintos() {
    render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={filasConPreciosDistintos} />);
}

function esperarEspeciesEnTabla(...especies: string[]) {
    const tabla = within(screen.getByRole("table"));
    const visibles = tabla.getAllByRole("row").slice(1).map((fila) =>
        within(fila).getAllByRole("cell")[0].textContent,
    );
    expect(visibles).toEqual(especies);
}

describe("PreciosReferencia", () => {
    it.each(["tabla", "móvil"] as const)("abre el histórico desde %s con los identificadores y filtros de la fila", (vista) => {
        const fila: PrecioReferencia = {
            ...filasConPreciosDistintos[1],
            id: JSON.stringify([2, 60, "Cavendish", "M", "URUGUAY", "UN", "I"]),
        };
        render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={[fila]} />);

        const registro = vista === "tabla"
            ? within(screen.getByRole("table")).getAllByRole("row")[1]
            : within(screen.getByRole("list", { name: "Precios relevados" })).getByRole("listitem");
        fireEvent.click(registro);

        expect(navegar).toHaveBeenCalledOnce();
        expect(navegar).toHaveBeenCalledWith(
            "/precios-historicos?classification_id=2&species_id=60&producto=Banana&variedad=Cavendish&pais=URUGUAY&calibre=M&categoria=I",
        );
    });

    it("muestra todos los registros y permite ver solo los marcados como referencia", async () => {
        const datos = await obtenerPreciosReferencia();
        render(<PreciosReferencia {...datos} />);

        expect(screen.getByRole("heading", { name: "Precios de referencia" })).toBeInTheDocument();
        expect(screen.getByText("363 resultados")).toBeInTheDocument();
        expect(within(screen.getByRole("table")).getAllByText("Referencia").length).toBeGreaterThan(1);

        fireEvent.click(screen.getByRole("checkbox", { name: "Solo registros de referencia" }));

        expect(screen.getByText("67 resultados")).toBeInTheDocument();
        const filasVisibles = within(screen.getByRole("table")).getAllByRole("row").slice(1);
        expect(filasVisibles).toHaveLength(40);
        for (const fila of filasVisibles) {
            expect(within(fila).getByText("Referencia")).toBeInTheDocument();
        }
    });

    it("encuentra una especie con tilde aunque se busque sin ella", async () => {
        const datos = await obtenerPreciosReferencia();
        render(<PreciosReferencia {...datos} />);

        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar especie o variedad" }), { target: { value: "brocoli" } });

        const filasVisibles = within(screen.getByRole("table")).getAllByRole("row").slice(1);
        expect(filasVisibles.length).toBeGreaterThan(0);
        for (const fila of filasVisibles) {
            expect(within(fila).getByText("Brócoli")).toBeInTheDocument();
        }
        expect(screen.queryByText("Acelga")).not.toBeInTheDocument();
    });

    it("muestra la variedad en su propia columna y omite la clasificación de la vista", () => {
        const filas = [
            {
                id: "gala", especie: "Manzana", variedad: "Gala",
                calibre: "M", pais: "URUGUAY", unidad: "KG", categoria: "I",
                precioMinimoUnidad: 100, precioMaximoUnidad: 120,
                precioMinimoKg: 100, precioMaximoKg: 120, esReferencia: false,
            },
        ];
        render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={filas} />);

        expect(screen.getByRole("columnheader", { name: "Especie" })).toBeInTheDocument();
        expect(screen.getByRole("columnheader", { name: "Variedad" })).toBeInTheDocument();
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "Gala" })).toBeInTheDocument();
        expect(screen.queryByRole("columnheader", { name: "Clasificación" })).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Clasificación" })).not.toBeInTheDocument();
    });

    it("filtra por variedad", () => {
        const base = {
            especie: "Manzana", calibre: "M", pais: "URUGUAY",
            unidad: "KG", categoria: "I", precioMinimoUnidad: 100, precioMaximoUnidad: 120,
            precioMinimoKg: 100, precioMaximoKg: 120, esReferencia: false,
        };
        const filas = [
            { ...base, id: "gala", variedad: "Gala" },
            { ...base, id: "fuji", variedad: "Fuji" },
        ];
        render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={filas} />);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Variedad" }));
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));

        expect(screen.getByText("1 resultados")).toBeInTheDocument();
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "Gala" })).toBeInTheDocument();
        expect(within(screen.getByRole("table")).queryByRole("cell", { name: "Fuji" })).not.toBeInTheDocument();
    });

    it("ignora las palabras de clasificación en la búsqueda", async () => {
        const datos = await obtenerPreciosReferencia();
        render(<PreciosReferencia {...datos} />);

        fireEvent.change(screen.getByRole("searchbox", { name: "Buscar especie o variedad" }), {
            target: { value: "Inflorescencias" },
        });

        expect(screen.getByText("0 resultados")).toBeInTheDocument();
    });

    it("filtra el precio mínimo por el mínimo por unidad, inclusive", () => {
        renderizarPreciosDistintos();

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "50" } });

        expect(screen.getByText("2 resultados")).toBeInTheDocument();
        esperarEspeciesEnTabla("Banana", "Cebolla");
    });

    it("filtra el precio máximo por el máximo por unidad, inclusive", () => {
        renderizarPreciosDistintos();

        fireEvent.change(screen.getByRole("textbox", { name: /precio máximo/i }), { target: { value: "70" } });

        expect(screen.getByText("1 resultados")).toBeInTheDocument();
        esperarEspeciesEnTabla("Banana");

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "50" } });
        esperarEspeciesEnTabla("Banana");
    });

    it("cambia entre precios por unidad y por kg para ambos límites", () => {
        renderizarPreciosDistintos();

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "50" } });
        esperarEspeciesEnTabla("Banana", "Cebolla");

        fireEvent.mouseDown(screen.getByRole("combobox", { name: /precio por/i }));
        fireEvent.click(screen.getByRole("option", { name: /kg/i }));
        esperarEspeciesEnTabla("Acelga");

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "" } });
        fireEvent.change(screen.getByRole("textbox", { name: /precio máximo/i }), { target: { value: "10" } });
        esperarEspeciesEnTabla("Banana");
    });

    it("acepta límites decimales con coma o punto", () => {
        const filas = [
            { ...filasConPreciosDistintos[0], precioMinimoUnidad: 12.5, precioMaximoUnidad: 18.5 },
            { ...filasConPreciosDistintos[1], precioMinimoUnidad: 12.75, precioMaximoUnidad: 20.75 },
        ];
        render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={filas} />);

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "12,7" } });
        esperarEspeciesEnTabla("Banana");

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "" } });
        fireEvent.change(screen.getByRole("textbox", { name: /precio máximo/i }), { target: { value: "20.7" } });
        esperarEspeciesEnTabla("Acelga");
    });

    it("limpiar filtros restablece límites y el tipo de precio", () => {
        renderizarPreciosDistintos();

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "50" } });
        fireEvent.change(screen.getByRole("textbox", { name: /precio máximo/i }), { target: { value: "100" } });
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /precio por/i }));
        fireEvent.click(screen.getByRole("option", { name: /kg/i }));

        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

        expect(screen.getByRole("textbox", { name: /precio mínimo/i })).toHaveValue("");
        expect(screen.getByRole("textbox", { name: /precio máximo/i })).toHaveValue("");
        expect(screen.getByRole("combobox", { name: /precio por/i })).toHaveTextContent("Unidad");
        expect(screen.getByText("3 resultados")).toBeInTheDocument();
        esperarEspeciesEnTabla("Acelga", "Banana", "Cebolla");
    });

    it("permite desplegar y cerrar los filtros adicionales en móvil", () => {
        renderizarPreciosDistintos();

        const boton = screen.getByRole("button", { name: /más filtros/i });
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(document.getElementById(boton.getAttribute("aria-controls") ?? "")).toBeInTheDocument();

        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByRole("textbox", { name: /precio mínimo/i })).toBeInTheDocument();
        expect(screen.getByRole("textbox", { name: /precio máximo/i })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: /precio por/i })).toBeInTheDocument();

        fireEvent.change(screen.getByRole("textbox", { name: /precio mínimo/i }), { target: { value: "50" } });
        esperarEspeciesEnTabla("Banana", "Cebolla");

        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "false");
        esperarEspeciesEnTabla("Banana", "Cebolla");
    });
});
