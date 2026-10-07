import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerPreciosReferencia, type PrecioReferencia } from "./consultas-precios-referencia";
import PreciosReferencia from "./PreciosReferencia";

beforeEach(() => vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "local"));
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

function filaFiltro(
    id: string,
    especie: string,
    variedad: string,
    unidad: string,
    pais: string,
    categoria: string,
    calibre: string,
): PrecioReferencia {
    return {
        id, especie, variedad, unidad, pais, categoria, calibre,
        precioMinimoUnidad: 10, precioMaximoUnidad: 20,
        precioMinimoKg: 10, precioMaximoKg: 20,
        esReferencia: false,
    };
}

const filasFiltros: PrecioReferencia[] = [
    filaFiltro("gala-caja-uy", "Manzana", "Gala", "Caja", "URUGUAY", "I", "G"),
    filaFiltro("gala-caja-br", "Manzana", "Gala", "Caja", "BRASIL", "I", "M"),
    filaFiltro("gala-bolsa-uy", "Manzana", "Gala", "Bolsa", "URUGUAY", "II", "M"),
    filaFiltro("fuji-caja-uy", "Manzana", "Fuji", "Caja", "URUGUAY", "I", "M"),
    filaFiltro("fuji-bolsa-br", "Manzana", "Fuji", "Bolsa", "BRASIL", "II", "G"),
    filaFiltro("williams-cajon-ar", "Pera", "Williams", "Cajón", "ARGENTINA", "Extra", "P"),
    filaFiltro("williams-cajon-uy", "Pera", "Williams", "Cajón", "URUGUAY", "I", "G"),
    filaFiltro("conferencia-bolsa-br", "Pera", "Conferencia", "Bolsa", "BRASIL", "II", "P"),
    filaFiltro("acelga-atado-uy", "Acelga", "-", "Atado", "URUGUAY", "I", "M"),
    filaFiltro("acelga-bolsa-br", "Acelga", "-", "Bolsa", "BRASIL", "II", "P"),
];

function renderizarFiltros() {
    render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={filasFiltros} />);
}

function seleccionar(nombre: string, opcion: string) {
    const select = screen.getByRole("combobox", { name: nombre });
    fireEvent.mouseDown(select);
    const listbox = screen.getByRole("listbox");
    const opcionElemento = within(listbox).getByRole("option", { name: opcion });
    fireEvent.click(opcionElemento);
}

function opcionesDe(nombre: string) {
    const select = screen.getByRole("combobox", { name: nombre });
    if (select.getAttribute("aria-disabled") === "true") return [];
    fireEvent.mouseDown(select);
    const listbox = screen.getByRole("listbox");
    const opciones = within(listbox)
        .getAllByRole("option")
        .map((opcion) => opcion.textContent?.trim());
    fireEvent.keyDown(listbox, { key: "Escape", code: "Escape", keyCode: 27 });
    return opciones;
}

function esperarSelectVacio(nombre: string) {
    const select = screen.getByRole("combobox", { name: nombre });
    expect(select.textContent?.replace(/\u200b/g, "").trim()).toBe("");
}

describe("PreciosReferencia", () => {
    
    beforeEach(() => {
        vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "local");
        document.body.style.setProperty("--Mui-transitions-disabled", "true");
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

        seleccionar("Especie", "Manzana");
        seleccionar("Variedad", "Gala");

        expect(screen.getByText("1 resultados")).toBeInTheDocument();
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "Gala" })).toBeInTheDocument();
        expect(within(screen.getByRole("table")).queryByRole("cell", { name: "Fuji" })).not.toBeInTheDocument();
    });

    it("habilita Variedad y Presentación en orden y ofrece solo opciones de la jerarquía elegida", () => {
        renderizarFiltros();

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveAttribute("aria-disabled", "true");
        expect(opcionesDe("Especie")).toEqual(["Todas las especies", "Acelga", "Manzana", "Pera"]);

        seleccionar("Especie", "Manzana");
        expect(screen.getByRole("combobox", { name: "Variedad" })).not.toHaveAttribute("aria-disabled");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveAttribute("aria-disabled", "true");
        expect(opcionesDe("Variedad")).toEqual(["Todas las variedades", "Fuji", "Gala"]);
        expect(opcionesDe("País")).toEqual(["Todos los países", "BRASIL", "URUGUAY"]);

        seleccionar("Variedad", "Gala");
        expect(screen.getByRole("combobox", { name: "Presentación" })).not.toHaveAttribute("aria-disabled");
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Bolsa", "Caja"]);

        seleccionar("Presentación", "Bolsa");
        expect(opcionesDe("País")).toEqual(["Todos los países", "URUGUAY"]);
        expect(opcionesDe("Categoría")).toEqual(["Todas las categorías", "II"]);
        expect(opcionesDe("Calibre")).toEqual(["Todos los calibres", "M"]);
        expect(screen.getByText("1 resultados")).toBeInTheDocument();
    });

    it("acota País, Categoría, Calibre y Presentación según las facetas elegidas", () => {
        renderizarFiltros();
        fireEvent.click(screen.getByRole("button", { name: "Más filtros" }));

        seleccionar("Especie", "Manzana");
        seleccionar("Variedad", "Gala");

        seleccionar("País", "BRASIL");
        expect(opcionesDe("Categoría")).toEqual(["Todas las categorías", "I"]);
        expect(opcionesDe("Calibre")).toEqual(["Todos los calibres", "M"]);
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Caja"]);

        seleccionar("País", "Todos los países");
        seleccionar("Calibre", "G");
        expect(opcionesDe("País")).toEqual(["Todos los países", "URUGUAY"]);
        expect(opcionesDe("Categoría")).toEqual(["Todas las categorías", "I"]);
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Caja"]);

        seleccionar("Calibre", "Todos los calibres");
        seleccionar("Categoría", "II");
        expect(opcionesDe("País")).toEqual(["Todos los países", "URUGUAY"]);
        expect(opcionesDe("Calibre")).toEqual(["Todos los calibres", "M"]);
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Bolsa"]);
    }, 15000);

    it("conserva facetas compatibles al cambiar de especie y reinicia Variedad y Presentación", () => {
        renderizarFiltros();
        seleccionar("Especie", "Manzana");
        seleccionar("Variedad", "Gala");
        seleccionar("Presentación", "Caja");
        seleccionar("País", "URUGUAY");
        seleccionar("Categoría", "I");
        seleccionar("Calibre", "G");

        seleccionar("Especie", "Pera");

        esperarSelectVacio("Variedad");
        esperarSelectVacio("Presentación");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("URUGUAY");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("G");
        expect(opcionesDe("Variedad")).toEqual(["Todas las variedades", "Williams"]);
        expect(screen.getByText("1 resultados")).toBeInTheDocument();
        esperarEspeciesEnTabla("Pera");
    });

    it("descarta las facetas incompatibles al cambiar de especie", () => {
        renderizarFiltros();
        seleccionar("Especie", "Pera");
        seleccionar("Variedad", "Williams");
        seleccionar("Presentación", "Cajón");
        seleccionar("País", "ARGENTINA");
        seleccionar("Categoría", "Extra");
        seleccionar("Calibre", "P");

        seleccionar("Especie", "Manzana");

        esperarSelectVacio("Variedad");
        esperarSelectVacio("Presentación");
        esperarSelectVacio("País");
        esperarSelectVacio("Categoría");
        esperarSelectVacio("Calibre");
        expect(screen.getByText("5 resultados")).toBeInTheDocument();
        expect(opcionesDe("Variedad")).toEqual(["Todas las variedades", "Fuji", "Gala"]);
    });

    it("reinicia Presentación al cambiar de variedad y selecciona la variedad única '-'", () => {
        renderizarFiltros();
        seleccionar("Especie", "Manzana");
        seleccionar("Variedad", "Gala");
        seleccionar("Presentación", "Caja");

        seleccionar("Variedad", "Fuji");
        esperarSelectVacio("Presentación");
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Bolsa", "Caja"]);

        seleccionar("Especie", "Acelga");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("-");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: "Presentación" })).not.toHaveAttribute("aria-disabled");
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Atado", "Bolsa"]);
        expect(screen.getByText("2 resultados")).toBeInTheDocument();
    });

    it("selecciona la variedad '-' si otra faceta la deja como única opción", () => {
        const filas = [
            filaFiltro("ajo-uruguay", "Ajo", "-", "Caja", "URUGUAY", "I", "M"),
            filaFiltro("ajo-brasil", "Ajo", "Morado", "Bolsa", "BRASIL", "I", "M"),
        ];
        render(<PreciosReferencia fechaRelevamiento="2026-08-27" filas={filas} />);

        seleccionar("Especie", "Ajo");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveAttribute("aria-disabled", "true");

        seleccionar("País", "URUGUAY");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("-");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: "Presentación" })).not.toHaveAttribute("aria-disabled");
        expect(opcionesDe("Presentación")).toEqual(["Todas las presentaciones", "Caja"]);
    });

    it("Limpiar filtros restituye los selects y todas sus opciones", () => {
        renderizarFiltros();
        fireEvent.click(screen.getByRole("button", { name: "Más filtros" }));
        seleccionar("Especie", "Pera");
        seleccionar("Variedad", "Williams");
        seleccionar("Presentación", "Cajón");
        seleccionar("País", "ARGENTINA");
        seleccionar("Categoría", "Extra");
        seleccionar("Calibre", "P");
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        esperarSelectVacio("Especie");
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("combobox", { name: "Presentación" })).toHaveAttribute("aria-disabled", "true");
        expect(opcionesDe("País")).toEqual(["Todos los países", "ARGENTINA", "BRASIL", "URUGUAY"]);
        expect(opcionesDe("Categoría")).toEqual(["Todas las categorías", "Extra", "I", "II"]);
        expect(opcionesDe("Calibre")).toEqual(["Todos los calibres", "G", "M", "P"]);
        expect(screen.getByText("10 resultados")).toBeInTheDocument();
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
