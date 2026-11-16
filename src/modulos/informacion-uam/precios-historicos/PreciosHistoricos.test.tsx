import { fireEvent, render, screen, within } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ComponentProps } from "react";
import PreciosHistoricos from "./PreciosHistoricos";
import type GraficaPreciosHistoricos from "./GraficaPreciosHistoricos";
import type { HistoricoProducto, ProductoSeleccionado, ValorHistorico } from "./tipos";

type PropsGrafica = ComponentProps<typeof GraficaPreciosHistoricos>;
const { navegar, renderizarGrafica } = vi.hoisted(() => ({
    navegar: vi.fn(),
    renderizarGrafica: vi.fn<(props: PropsGrafica) => void>(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: navegar }) }));
vi.mock("./GraficaPreciosHistoricos", () => ({
    default: (props: PropsGrafica) => {
        renderizarGrafica(props);
        return <div data-testid="grafica-historico" />;
    },
}));

function propsGrafica(): PropsGrafica {
    return renderizarGrafica.mock.calls.at(-1)![0];
}

const urlInicial = window.location.href;
const estadoInicial = window.history.state;

const producto: ProductoSeleccionado = {
    id: "60",
    especie: "Banana",
    variedad: "Cavendish",
    pais: "ECUADOR",
    calibre: "M",
    categoria: "I",
};

const historico: HistoricoProducto = {
    classification_id: 2,
    classification: "Frutas",
    species_id: 60,
    species: "Banana",
    from: "2025-11-01",
    to: "2025-11-08",
    series: [{
        date: "2025-11-03",
        volume_kg: 2000,
        presentations: ["ECUADOR", "BRASIL"].map((country) => ({
            country, variety: "Cavendish", caliber: "M", measure_unit: "KG",
            prices: ["I", "II"].map((category) => ({
                category, min_kg: 50, max_kg: 60, min_un: 50, max_un: 60, is_reference: category === "I",
            })),
        })),
    }],
};

const fechas = { desde: "2025-11-01", hasta: "2025-11-08" };

const productoSinFiltros: ProductoSeleccionado = {
    ...producto, variedad: "", pais: "", calibre: "", categoria: "",
};

const opcionesEspecie = {
    variedades: ["Cavendish", "Orgánica"], paises: ["ECUADOR", "BRASIL", "URUGUAY"],
    calibres: ["M", "G", "P"], categorias: ["I", "II", "III"],
};

const valoresInesperados: { valor: ValorHistorico; texto: string }[] = [
    { valor: true, texto: "true" },
    { valor: false, texto: "false" },
    { valor: { dato: "Ñ" }, texto: '{"dato":"Ñ"}' },
    { valor: ["Ñ", false], texto: '["Ñ",false]' },
    { valor: null, texto: "—" },
    { valor: "true", texto: "true" },
];

const historicoConFiltros: HistoricoProducto = {
    ...historico,
    series: [{
        date: "2025-11-03",
        volume_kg: 2000,
        presentations: [
            {
                variety: "Cavendish", country: "ECUADOR", caliber: "M", measure_unit: "KG",
                prices: [
                    { category: "I", min_kg: 50, max_kg: 60, min_un: 500, max_un: 600, is_reference: true },
                    { category: "II", min_kg: 30, max_kg: 40, min_un: 300, max_un: 400, is_reference: false },
                ],
            },
            {
                variety: "Cavendish", country: "BRASIL", caliber: "G", measure_unit: "Cajón",
                prices: [{ category: "I", min_kg: 70, max_kg: 80, min_un: 700, max_un: 800, is_reference: false }],
            },
            {
                variety: "Orgánica", country: "URUGUAY", caliber: "P", measure_unit: "UN",
                prices: [{ category: "III", min_kg: 20, max_kg: 25, min_un: 200, max_un: 250, is_reference: true }],
            },
            {
                variety: "Orgánica", country: "ECUADOR", caliber: "G", measure_unit: "Cajón",
                prices: [{ category: "II", min_kg: 45, max_kg: 55, min_un: 450, max_un: 550, is_reference: false }],
            },
        ],
    }],
};

function seleccionarFiltro(nombre: string, opcion: string) {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: nombre }));
    fireEvent.click(screen.getByRole("option", { name: opcion }));
}

function leerOpcionesFiltro(nombre: string): string[] {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: nombre }));
    const opciones = within(screen.getByRole("listbox")).getAllByRole("option");
    const valores = opciones.slice(1).map((opcion) => opcion.textContent ?? "");
    const seleccionada = opciones.find((opcion) => opcion.getAttribute("aria-selected") === "true");
    expect(seleccionada).toBeDefined();
    fireEvent.click(seleccionada!);
    return valores;
}

function abrirFiltrosAdicionales() {
    const boton = screen.queryByRole("button", { name: "Más filtros" });
    if (boton?.getAttribute("aria-expanded") === "false") fireEvent.click(boton);
}

function firmasFilasVisibles(): string[] {
    const tabla = within(screen.getByRole("table"));
    const encabezados = tabla.getAllByRole("columnheader").map((celda) => celda.textContent);
    const columnas = ["Variedad", "País", "Calibre", "Categoría"].map((nombre) => encabezados.indexOf(nombre));
    return tabla.getAllByRole("row").slice(1).map((fila) => {
        const celdas = within(fila).getAllByRole("cell");
        return columnas.map((indice) => celdas[indice].textContent).join("|");
    });
}

function historicoConRegistros(cantidad: number): HistoricoProducto {
    const registro = historico.series[0];
    const presentacion = registro.presentations[0];
    return {
        ...historico,
        series: [{
            ...registro,
            presentations: Array.from({ length: cantidad }, (_, indice) => ({
                ...presentacion,
                variety: `Variedad ${indice + 1}`,
                prices: [presentacion.prices[0]],
            })),
        }],
    };
}

describe("PreciosHistoricos", () => {
    beforeEach(() => {
        navegar.mockReset().mockImplementation((url: string) => window.history.replaceState(null, "", url));
        renderizarGrafica.mockClear();
    });
    afterEach(() => {
        window.history.replaceState(estadoInicial, "", urlInicial);
    });

    it("prioriza las especies UAM al completar el catálogo con la selección del enlace", () => {
        const nombres = ["Pera", "Lechuga", "Acelga", "MORRON", "papa", "Manzana", "Sandía"];
        const especies = nombres.map((especie, indice) => ({ id: String(100 + indice), especie }));
        render(<PreciosHistoricos producto={producto} historico={historico} especies={especies} {...fechas} />);

        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
        const lista = screen.getByRole("listbox");
        expect(within(lista).getAllByRole("option").map((opcion) => opcion.textContent)).toEqual([
            "papa", "Banana", "Manzana", "MORRON", "Sandía", "Lechuga", "Acelga", "Pera",
        ]);
        expect(within(lista).getByRole("option", { name: "Banana" })).toHaveAttribute("aria-selected", "true");
        fireEvent.keyDown(lista, { key: "Escape", code: "Escape", keyCode: 27 });

        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveTextContent("Banana");
        expect(especies.map((especie) => especie.especie)).toEqual(nombres);
        expect(navegar).not.toHaveBeenCalled();
    });

    it("carga el histórico al elegir una especie desde la entrada directa y permite filtrar sin consultar", () => {
        window.history.replaceState(null, "", "/precios-historicos");
        const especies = [{ id: "60", especie: "Banana" }];
        const { rerender } = render(<PreciosHistoricos key="entrada" producto={{ ...productoSinFiltros, id: "", especie: "Producto" }} historico={null} especies={especies} {...fechas} />);

        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Histórico de precios");
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(navegar).not.toHaveBeenCalled();

        seleccionarFiltro("Especie", "Banana");

        expect(navegar).toHaveBeenCalledOnce();
        const url = new URL(navegar.mock.calls[0][0], window.location.origin);
        expect(Object.fromEntries(url.searchParams)).toEqual({ species_id: "60", producto: "Banana", from: fechas.desde, to: fechas.hasta });
        expect(navegar.mock.calls[0][1]).toEqual({ scroll: false });
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
        expect(propsGrafica()).toMatchObject({ cargando: true, registros: [] });
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveAttribute("aria-disabled", "true");
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();

        rerender(<PreciosHistoricos key="60" producto={productoSinFiltros} historico={historicoConFiltros} especies={especies} {...fechas} />);

        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
        expect(propsGrafica().cargando).toBe(false);
        expect(propsGrafica().registros).toHaveLength(5);
        abrirFiltrosAdicionales();
        seleccionarFiltro("Variedad", "Orgánica");
        seleccionarFiltro("País", "URUGUAY");
        seleccionarFiltro("Calibre", "P");
        seleccionarFiltro("Categoría", "III");

        expect(firmasFilasVisibles()).toEqual(["Orgánica|URUGUAY|P|III"]);
        expect(propsGrafica().registros).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Más filtros" })).toHaveAttribute("aria-expanded", "true");
        expect(Object.fromEntries(new URL(window.location.href).searchParams)).toMatchObject({ variedad: "Orgánica", pais: "URUGUAY", calibre: "P", categoria: "III" });
        expect(navegar).toHaveBeenCalledOnce();
    });

    it("reúne fechas y filtros en un único panel de consulta antes de la gráfica y el listado", () => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);
        abrirFiltrosAdicionales();
        const formulario = screen.getByRole("form", { name: "Consultar período histórico" });
        const grafica = screen.getByTestId("grafica-historico");
        const filtros = screen.getByRole("region", { name: "Filtros de precios históricos" });
        const tabla = screen.getByRole("table");

        expect(document.querySelectorAll("form")).toHaveLength(1);
        for (const nombre of ["Especie", "Variedad", "País", "Calibre", "Categoría"]) {
            expect(formulario).toContainElement(within(filtros).getByRole("combobox", { name: nombre }));
        }
        expect(formulario).toContainElement(within(filtros).getByLabelText(/^Desde/));
        expect(formulario).toContainElement(within(filtros).getByLabelText(/^Hasta/));
        expect(formulario).not.toContainElement(grafica);
        expect(filtros.compareDocumentPosition(grafica) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(grafica.compareDocumentPosition(tabla) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
        expect(document.querySelectorAll('button[type="submit"]')).toHaveLength(1);
        expect(within(filtros).getByRole("button", { name: "Consultar" })).toHaveAttribute("type", "submit");
        expect(propsGrafica()).toMatchObject({ ...fechas, producto: "Banana", cargando: false, error: false });
    });

    it.each([
        ["Desde", "2025-11-04"],
        ["Hasta", "2025-11-02"],
    ])("conserva el período aplicado y los parámetros ajenos mientras se edita %s", (campo, valor) => {
        const estado = { __NA: true, arbol: { producto: "Banana", datosCargados: true } };
        window.history.replaceState(estado, "", "/precios-historicos?species_id=60&producto=Banana&from=" + fechas.desde + "&to=" + fechas.hasta + "&extra=anterior#tabla");
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        const urlAplicada = window.location.href;
        const registrosAplicados = propsGrafica().registros;

        fireEvent.change(screen.getByLabelText(new RegExp("^" + campo)), { target: { value: valor } });

        expect(window.location.href).toBe(urlAplicada);
        expect(window.history.state).toEqual(estado);
        expect(firmasFilasVisibles()).toHaveLength(5);
        expect(propsGrafica().registros).toEqual(registrosAplicados);
        expect(navegar).not.toHaveBeenCalled();
    });

    it("elimina la clasificación de una URL antigua al montar y conserva especie, filtros y parámetros ajenos", () => {
        window.history.replaceState(
            estadoInicial,
            "",
            "/precios-historicos?classification_id=invalida&classification_id=otra&species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Cavendish&pais=ECUADOR&calibre=M&categoria=I&extra=anterior&extra=segundo#tabla",
        );
        render(
            <PreciosHistoricos
                producto={{ ...producto, id: JSON.stringify(["invalida", "60"]) }}
                historico={historicoConFiltros}
                {...fechas}
            />,
        );

        const parametros = new URL(window.location.href).searchParams;
        expect(parametros.has("classification_id")).toBe(false);
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            variedad: "Cavendish", pais: "ECUADOR", calibre: "M", categoria: "I",
            from: fechas.desde, to: fechas.hasta,
        });
        expect(parametros.getAll("extra")).toEqual(["anterior", "segundo"]);
        expect(window.location.hash).toBe("#tabla");
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I"]);
        expect(navegar).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(navegar).toHaveBeenCalledOnce();
        const destino = new URL(navegar.mock.calls[0][0], "https://app.example.test");
        expect(destino.searchParams.has("classification_id")).toBe(false);
        expect(destino.searchParams.get("species_id")).toBe("60");
        expect(destino.searchParams.getAll("extra")).toEqual(["anterior", "segundo"]);
        expect(destino.hash).toBe("#tabla");
    });

    it("restaura los filtros y las mismas filas al recargar la URL actualizada", () => {
        window.history.replaceState(
            estadoInicial,
            "",
            "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&extra=anterior&extra=segundo#tabla",
        );
        const { unmount } = render(
            <PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />,
        );
        abrirFiltrosAdicionales();
        seleccionarFiltro("Variedad", "Orgánica");
        seleccionarFiltro("País", "ECUADOR");
        seleccionarFiltro("Calibre", "G");
        seleccionarFiltro("Categoría", "II");
        expect(firmasFilasVisibles()).toEqual(["Orgánica|ECUADOR|G|II"]);
        expect(navegar).not.toHaveBeenCalled();
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            variedad: "Orgánica", pais: "ECUADOR", calibre: "G", categoria: "II",
            from: fechas.desde, to: fechas.hasta,
        });
        expect(parametros.getAll("extra")).toEqual(["anterior", "segundo"]);
        expect(window.location.hash).toBe("#tabla");
        expect(navegar).not.toHaveBeenCalled();
        unmount();

        const productoRecargado: ProductoSeleccionado = {
            id: parametros.get("species_id")!,
            especie: parametros.get("producto")!,
            variedad: parametros.get("variedad")!,
            pais: parametros.get("pais")!,
            calibre: parametros.get("calibre")!,
            categoria: parametros.get("categoria")!,
        };
        render(
            <PreciosHistoricos
                producto={productoRecargado}
                historico={historicoConFiltros}
                desde={parametros.get("from")!}
                hasta={parametros.get("to")!}
            />,
        );
        abrirFiltrosAdicionales();
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Orgánica");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("ECUADOR");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("G");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("II");
        expect(screen.getByLabelText(/^Desde/)).toHaveValue(fechas.desde);
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(fechas.hasta);
        expect(firmasFilasVisibles()).toEqual(["Orgánica|ECUADOR|G|II"]);
        expect(document.querySelectorAll("article")).toHaveLength(1);
        expect(navegar).not.toHaveBeenCalled();
    });

    it("conserva filtros literales con guion y la presentación seleccionada al recargar", () => {
        const presentacion = historicoConFiltros.series[0].presentations[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: [{
                ...historicoConFiltros.series[0],
                presentations: [
                    ...historicoConFiltros.series[0].presentations,
                    {
                        ...presentacion, variety: "-", country: "-", caliber: "-",
                        prices: [{ ...presentacion.prices[0], category: "-" }],
                    },
                ],
            }],
        };
        const sinFiltros: ProductoSeleccionado = {
            ...producto, variedad: "", pais: "", calibre: "", categoria: "",
        };
        const { unmount } = render(<PreciosHistoricos producto={sinFiltros} historico={datos} {...fechas} />);
        expect(firmasFilasVisibles()).toHaveLength(6);
        abrirFiltrosAdicionales();
        for (const nombre of ["Variedad", "País", "Calibre", "Categoría"]) {
            seleccionarFiltro(nombre, "-");
        }
        expect(firmasFilasVisibles()).toEqual(["-|-|-|-"]);
        expect(navegar).not.toHaveBeenCalled();
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            variedad: "-", pais: "-", calibre: "-", categoria: "-",
            from: fechas.desde, to: fechas.hasta,
        });
        unmount();

        render(
            <PreciosHistoricos
                producto={{
                    ...producto,
                    variedad: parametros.get("variedad")!, pais: parametros.get("pais")!,
                    calibre: parametros.get("calibre")!, categoria: parametros.get("categoria")!,
                }}
                historico={datos}
                desde={parametros.get("from")!}
                hasta={parametros.get("to")!}
            />,
        );
        abrirFiltrosAdicionales();
        expect(firmasFilasVisibles()).toEqual(["-|-|-|-"]);
        expect(Object.fromEntries(new FormData(screen.getByRole("form") as HTMLFormElement))).toMatchObject({
            variedad: "-", pais: "-", calibre: "-", categoria: "-",
        });
        expect(navegar).not.toHaveBeenCalled();
    });

    it.each([undefined, null])("muestra los precios y un guion cuando no hay volumen: %s", (volumen) => {
        const datos = {
            ...historico,
            series: [{ ...historico.series[0], volume_kg: volumen }],
        };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        const tabla = within(screen.getByRole("table"));
        expect(tabla.getByRole("cell", { name: "ECUADOR" })).toBeInTheDocument();
        expect(tabla.getByRole("cell", { name: "—" })).toBeInTheDocument();
        const tarjeta = within(document.querySelector("article")!);
        expect(tarjeta.getByLabelText("Volumen: —")).toHaveTextContent(/^—$/);
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
    });

    it("distingue un volumen de cero del volumen ausente", () => {
        const datos = { ...historico, series: [{ ...historico.series[0], volume_kg: 0 }] };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: "0 kg" })).toBeInTheDocument();
        const tarjeta = within(document.querySelector("article")!);
        expect(tarjeta.getByLabelText("Volumen: 0 kg")).toHaveTextContent(/^0 kg$/);
    });

    it.each(["Ñ", "002000.50"])("muestra el volumen de texto recibido literalmente en tabla y móvil: %s", (volumen) => {
        const datos: HistoricoProducto = { ...historico, series: [{ ...historico.series[0], volume_kg: volumen }] };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: `${volumen} kg` })).toBeInTheDocument();
        expect(within(document.querySelector("article")!).getByLabelText(`Volumen: ${volumen} kg`)).toHaveTextContent(`${volumen} kg`);
        expect(datos.series[0].volume_kg).toBe(volumen);
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each(["2025-11-00", "2025-11-31"])("muestra una fecha recibida inválida literalmente sin impedir la consulta: %s", (date) => {
        const datos: HistoricoProducto = { ...historico, series: [{ ...historico.series[0], date }] };
        render(<PreciosHistoricos producto={producto} historico={datos} desde="2025-10-01" hasta="2025-12-01" />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: date })).toBeInTheDocument();
        expect(within(document.querySelector("article")!).getByText(date)).toHaveAttribute("datetime", date);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each(valoresInesperados)("conserva y muestra una fecha inesperada dentro de un registro: $texto", ({ valor, texto }) => {
        const datos: HistoricoProducto = { ...historico, series: [{ ...historico.series[0], date: valor }] };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: texto })).toBeInTheDocument();
        expect(document.querySelector("article time")).toHaveTextContent(texto);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-04" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(within(screen.getByRole("table")).getByRole("cell", { name: texto })).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra primero las fechas más nuevas en tabla y móvil antes de paginar sin modificar los datos originales", () => {
        const registro = historico.series[0];
        const presentacion = registro.presentations[0];
        const registrosCronologicos = Array.from({ length: 45 }, (_, indice) => ({
            ...registro,
            date: new Date(Date.UTC(2025, 10, indice + 1)).toISOString().slice(0, 10),
            presentations: [{ ...presentacion, prices: [presentacion.prices[0]] }],
        }));
        const datos: HistoricoProducto = {
            ...historico,
            from: "2025-11-01",
            to: "2025-12-15",
            series: [
                ...registrosCronologicos.filter((_, indice) => indice % 2 === 0),
                ...registrosCronologicos.filter((_, indice) => indice % 2 !== 0),
            ],
        };
        const ordenOriginal = datos.series.map(({ date }) => date);
        const fechasEsperadas = [...registrosCronologicos].reverse().map(({ date }) => {
            const [anio, mes, dia] = date.split("-");
            return `${dia}/${mes}/${anio}`;
        });
        render(<PreciosHistoricos producto={producto} historico={datos} desde={datos.from} hasta={datos.to} />);
        const tabla = screen.getByRole("table");
        const fechasTabla = () => within(tabla).getAllByRole("row").slice(1)
            .map((fila) => within(fila).getAllByRole("cell")[0].textContent);
        const fechasMobile = () => Array.from(document.querySelectorAll("article header time"))
            .map((fecha) => fecha.textContent);

        expect(fechasTabla()).toEqual(fechasEsperadas.slice(0, 40));
        expect(fechasMobile()).toEqual(fechasEsperadas.slice(0, 40));

        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(fechasTabla()).toEqual(fechasEsperadas.slice(40));
        expect(fechasMobile()).toEqual(fechasEsperadas.slice(40));
        expect(datos.series.map(({ date }) => date)).toEqual(ordenOriginal);
    });

    it("limita a 40 registros por página en tabla y móvil y permite recorrer todos sin nuevas consultas", () => {
        render(<PreciosHistoricos producto={{ ...producto, variedad: "" }} historico={historicoConRegistros(83)} {...fechas} />);
        const tabla = screen.getByRole("table");
        const paginacion = within(screen.getByRole("navigation", { name: "Páginas de precios históricos" }));
        const registrosGrafica = propsGrafica().registros;

        expect(registrosGrafica).toHaveLength(83);
        expect(within(tabla).getAllByRole("row")).toHaveLength(41);
        expect(document.querySelectorAll("article")).toHaveLength(40);
        expect(within(tabla).getByRole("cell", { name: "Variedad 1" })).toBeInTheDocument();
        expect(within(tabla).getByRole("cell", { name: "Variedad 40" })).toBeInTheDocument();
        expect(within(tabla).queryByRole("cell", { name: "Variedad 41" })).not.toBeInTheDocument();
        expect(screen.getByText("1-40 de 83")).toBeInTheDocument();
        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(paginacion.getByRole("button", { name: "Anterior" })).toBeDisabled();

        fireEvent.click(paginacion.getByRole("button", { name: "Siguiente" }));
        expect(propsGrafica().registros).toBe(registrosGrafica);
        expect(screen.getByText("41-80 de 83")).toBeInTheDocument();
        expect(within(tabla).getByRole("cell", { name: "Variedad 41" })).toBeInTheDocument();
        expect(within(tabla).getAllByRole("row")).toHaveLength(41);
        expect(document.querySelectorAll("article")).toHaveLength(40);

        fireEvent.click(paginacion.getByRole("button", { name: "Siguiente" }));
        expect(propsGrafica().registros).toBe(registrosGrafica);
        expect(screen.getByText("81-83 de 83")).toBeInTheDocument();
        expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();
        expect(within(tabla).getAllByRole("row")).toHaveLength(4);
        expect(document.querySelectorAll("article")).toHaveLength(3);
        expect(paginacion.getByRole("button", { name: "Siguiente" })).toBeDisabled();

        fireEvent.click(paginacion.getByRole("button", { name: "Anterior" }));
        expect(screen.getByText("Página 2 de 3")).toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
    }, 10_000);

    it("oculta los controles cuando los resultados no superan los 40 registros", () => {
        render(<PreciosHistoricos producto={{ ...producto, variedad: "" }} historico={historicoConRegistros(40)} {...fechas} />);
        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(41);
        expect(screen.queryByRole("navigation", { name: "Páginas de precios históricos" })).not.toBeInTheDocument();
    });

    it("filtra y reinicia la página inmediatamente, y vuelve al inicio al quitar el filtro", () => {
        render(<PreciosHistoricos producto={{ ...producto, variedad: "" }} historico={historicoConRegistros(83)} {...fechas} />);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        expect(screen.getByText("Página 3 de 3")).toBeInTheDocument();

        seleccionarFiltro("Variedad", "Variedad 83");

        expect(firmasFilasVisibles()).toEqual(["Variedad 83|ECUADOR|M|I"]);
        expect(propsGrafica().registros).toHaveLength(1);
        expect(screen.queryByRole("navigation", { name: "Páginas de precios históricos" })).not.toBeInTheDocument();

        seleccionarFiltro("Variedad", "Todas las variedades");

        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(41);
        expect(propsGrafica().registros).toHaveLength(83);
        expect(navegar).not.toHaveBeenCalled();
    });

    it("vuelve a la primera página al consultar otro período", () => {
        render(<PreciosHistoricos producto={{ ...producto, variedad: "" }} historico={historicoConRegistros(83)} {...fechas} />);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(screen.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(navegar).toHaveBeenCalledOnce();
    });

    it("mantiene el encabezado, filtros y columnas mientras carga dentro de la tabla y en móvil", () => {
        render(<PreciosHistoricos producto={producto} historico={null} {...fechas} cargando />);

        expect(screen.getByRole("heading", { name: "Histórico de Banana" })).toBeInTheDocument();
        expect(screen.getByLabelText(/^Desde/)).toHaveValue(fechas.desde);
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(fechas.hasta);
        const tabla = screen.getByRole("table");
        expect(tabla).toHaveAttribute("aria-busy", "true");
        expect(within(tabla).getAllByRole("columnheader")).toHaveLength(8);
        const indicador = within(tabla).getByRole("progressbar", { name: "Cargando precios históricos" });
        expect(indicador.closest("td")).toHaveAttribute("colspan", "8");
        expect(screen.getAllByRole("progressbar", { name: "Cargando precios históricos" })).toHaveLength(2);
        expect(screen.queryByText(/No hay registros históricos/)).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
    });

    it("reemplaza los registros por el indicador mientras carga y los muestra al terminar", () => {
        const { rerender } = render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} cargando />);
        expect(within(screen.getByRole("table")).queryByRole("cell", { name: "ECUADOR" })).not.toBeInTheDocument();

        rerender(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "ECUADOR" })).toBeInTheDocument();
    });

    it("muestra los datos del período consultado y filtra la presentación elegida", () => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);

        expect(screen.getByRole("heading", { name: "Histórico de Banana" })).toBeInTheDocument();
        expect(screen.getByText("1")).toBeInTheDocument();
        const tabla = within(screen.getByRole("table"));
        expect(tabla.getAllByRole("row")).toHaveLength(2);
        expect(tabla.getByRole("cell", { name: "ECUADOR" })).toBeInTheDocument();
        expect(tabla.queryByRole("cell", { name: "BRASIL" })).not.toBeInTheDocument();
        expect(tabla.getByRole("cell", { name: "I" })).toBeInTheDocument();
        expect(tabla.queryByRole("cell", { name: "II" })).not.toBeInTheDocument();
    });

    it("inicializa los controles con los filtros de la fila seleccionada en precios de referencia", () => {
        render(<PreciosHistoricos producto={producto} historico={historicoConFiltros} {...fechas} />);

        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Cavendish");
        abrirFiltrosAdicionales();
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("ECUADOR");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("M");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("I");
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I"]);
        expect(navegar).not.toHaveBeenCalled();
    });

    it("mantiene las fechas y Consultar disponibles al ocultar los filtros adicionales", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        const masFiltros = screen.getByRole("button", { name: "Más filtros" });
        expect(masFiltros).toHaveAttribute("aria-expanded", "false");
        fireEvent.click(masFiltros);
        expect(masFiltros).toHaveAttribute("aria-expanded", "true");
        const panel = document.getElementById(masFiltros.getAttribute("aria-controls") ?? "");
        const desde = screen.getByLabelText(/^Desde/);
        const hasta = screen.getByLabelText(/^Hasta/);
        expect(panel).not.toBeNull();
        expect(panel).not.toContainElement(desde);
        expect(panel).not.toContainElement(hasta);
        for (const nombre of ["País", "Calibre", "Categoría"]) {
            expect(panel).toContainElement(screen.getByRole("combobox", { name: nombre }));
        }

        fireEvent.click(masFiltros);

        expect(masFiltros).toHaveAttribute("aria-expanded", "false");
        expect(desde).toBeVisible();
        expect(hasta).toBeVisible();
        expect(desde).toBeEnabled();
        expect(hasta).toBeEnabled();
        seleccionarFiltro("Variedad", "Orgánica");
        expect(firmasFilasVisibles()).toHaveLength(2);
        fireEvent.change(hasta, { target: { value: "2025-11-02" } });
        expect(firmasFilasVisibles()).toHaveLength(2);
        const consultar = screen.getByRole("button", { name: "Consultar" });
        expect(consultar).toBeVisible();
        expect(consultar).toBeEnabled();
        fireEvent.click(consultar);

        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1);
        expect(propsGrafica().registros).toHaveLength(0);
        expect(hasta).toHaveValue("2025-11-02");
        expect(masFiltros).toHaveAttribute("aria-expanded", "false");
        expect(navegar).not.toHaveBeenCalled();
        expect(new URL(window.location.href).searchParams.get("to")).toBe("2025-11-02");
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it.each([
        ["Calibre", "G", "Todos los calibres", ["Cavendish|BRASIL|G|I", "Orgánica|ECUADOR|G|II"], [[70, 80], [45, 55]]],
        ["País", "BRASIL", "Todos los países", ["Cavendish|BRASIL|G|I"], [[70, 80]]],
        ["Categoría", "II", "Todas las categorías", ["Cavendish|ECUADOR|M|II", "Orgánica|ECUADOR|G|II"], [[30, 40], [45, 55]]],
        ["Variedad", "Orgánica", "Todas las variedades", ["Orgánica|URUGUAY|P|III", "Orgánica|ECUADOR|G|II"], [[20, 25], [45, 55]]],
    ] as const)("aplica y quita el filtro por %s inmediatamente en tabla, móvil, gráfica y URL", (nombre, opcion, todas, esperadas, preciosEsperados) => {
        window.history.replaceState(estadoInicial, "", "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&extra=anterior&extra=segundo#tabla");
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro(nombre, opcion);

        expect(firmasFilasVisibles()).toEqual(esperadas);
        expect(document.querySelectorAll("article")).toHaveLength(esperadas.length);
        expect(propsGrafica().registros.map(({ precio }) => [precio.min_kg, precio.max_kg])).toEqual(preciosEsperados);
        expect(screen.getByRole("button", { name: "Más filtros" })).toHaveAttribute("aria-expanded", "true");
        const parametro = { Calibre: "calibre", País: "pais", Categoría: "categoria", Variedad: "variedad" }[nombre];
        const url = new URL(window.location.href);
        expect(Object.fromEntries(url.searchParams)).toMatchObject({ species_id: "60", producto: "Banana", from: fechas.desde, to: fechas.hasta, [parametro]: opcion });
        expect(url.searchParams.getAll("extra")).toEqual(["anterior", "segundo"]);
        expect(url.hash).toBe("#tabla");
        expect(navegar).not.toHaveBeenCalled();

        seleccionarFiltro(nombre, todas);

        expect(firmasFilasVisibles()).toHaveLength(5);
        expect(propsGrafica().registros).toHaveLength(5);
        expect(new URL(window.location.href).searchParams.has(parametro)).toBe(false);
        expect(navegar).not.toHaveBeenCalled();
    });

    it("recalcula las opciones al acotar el período y las recupera al ampliarlo dentro del histórico cargado", () => {
        const registro = historicoConFiltros.series[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: [
                { ...registro, date: "2025-11-02", presentations: registro.presentations.slice(0, 1) },
                { ...registro, date: "2025-11-07", presentations: registro.presentations.slice(1) },
            ],
        };
        render(<PreciosHistoricos producto={{ ...productoSinFiltros, calibre: "G" }} historico={datos} opcionesFiltros={opcionesEspecie} {...fechas} />);
        abrirFiltrosAdicionales();
        expect(firmasFilasVisibles()).toHaveLength(2);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M", "P"]);

        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2025-11-03" } });
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M", "P"]);
        expect(firmasFilasVisibles()).toHaveLength(2);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(Object.fromEntries(new FormData(screen.getByRole("form", { name: "Consultar período histórico" }) as HTMLFormElement))).toMatchObject({ calibre: "" });
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Cavendish"]);
        expect(leerOpcionesFiltro("País")).toEqual(["ECUADOR"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["M"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I", "II"]);
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I", "Cavendish|ECUADOR|M|II"]);
        expect(propsGrafica().registros).toHaveLength(2);
        expect(new URL(window.location.href).searchParams.has("calibre")).toBe(false);
        expect(propsGrafica()).toMatchObject({ desde: fechas.desde, hasta: "2025-11-03" });

        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: fechas.hasta } });
        expect(leerOpcionesFiltro("Calibre")).toEqual(["M"]);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(leerOpcionesFiltro("Variedad")).toEqual(["Cavendish", "Orgánica"]);
        expect(leerOpcionesFiltro("País")).toEqual(["URUGUAY", "BRASIL", "ECUADOR"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M", "P"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I", "II", "III"]);
        expect(firmasFilasVisibles()).toHaveLength(5);
        seleccionarFiltro("Calibre", "G");
        expect(firmasFilasVisibles()).toEqual(["Cavendish|BRASIL|G|I", "Orgánica|ECUADOR|G|II"]);
        expect(navegar).not.toHaveBeenCalled();
    }, 10_000);

    it("excluye Papa Blanca de 2020 al consultar 2023 a 2026 y la ofrece cuando se amplía el período", () => {
        const presentacion = historico.series[0].presentations[0];
        const datos: HistoricoProducto = {
            ...historico, species_id: 15, species: "Papa", from: "2020-01-01", to: "2026-11-01",
            series: [
                { ...historico.series[0], date: "2020-07-01", presentations: [{ ...presentacion, variety: "Blanca", country: "ARGENTINA", caliber: "G", prices: [{ ...presentacion.prices[0], category: "II" }] }] },
                { ...historico.series[0], date: "2025-07-01", presentations: [{ ...presentacion, variety: "Rosada", country: "URUGUAY", caliber: "M", prices: [presentacion.prices[0]] }] },
            ],
        };
        const papa = { ...productoSinFiltros, id: "15", especie: "Papa" };
        const periodo = { desde: "2023-11-01", hasta: "2026-11-01" };
        const opcionesAnteriores = { variedades: ["Blanca", "Rosada"], paises: ["ARGENTINA", "URUGUAY"], calibres: ["G", "M"], categorias: ["I", "II"] };
        const { rerender } = render(<PreciosHistoricos key="tres-anios" producto={papa} historico={datos} opcionesFiltros={opcionesAnteriores} {...periodo} />);
        abrirFiltrosAdicionales();

        expect(leerOpcionesFiltro("Variedad")).toEqual(["Rosada"]);
        expect(leerOpcionesFiltro("País")).toEqual(["URUGUAY"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["M"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I"]);
        expect(firmasFilasVisibles()).toEqual(["Rosada|URUGUAY|M|I"]);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2020-01-01" } });
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Rosada"]);
        expect(propsGrafica()).toMatchObject(periodo);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        expect(Object.fromEntries(new URL(navegar.mock.calls[0][0], window.location.origin).searchParams)).toMatchObject({ species_id: "15", producto: "Papa", from: "2020-01-01", to: periodo.hasta });
        rerender(<PreciosHistoricos key="seis-anios" producto={papa} historico={datos} opcionesFiltros={opcionesAnteriores} desde="2020-01-01" hasta={periodo.hasta} />);
        abrirFiltrosAdicionales();
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Blanca", "Rosada"]);
        seleccionarFiltro("Variedad", "Blanca");
        expect(firmasFilasVisibles()).toEqual(["Blanca|ARGENTINA|G|II"]);
        expect(propsGrafica().registros).toHaveLength(1);
        expect(propsGrafica().registros[0].dia.date).toBe("2020-07-01");
        expect(navegar).toHaveBeenCalledOnce();
    }, 10_000);

    it("elimina de los selects y la URL los filtros iniciales que no existen en el período cargado", () => {
        window.history.replaceState(estadoInicial, "", "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Inexistente&pais=ARGENTINA&calibre=XXL&categoria=Premium&extra=anterior#tabla");
        render(<PreciosHistoricos producto={{ ...producto, variedad: "Inexistente", pais: "ARGENTINA", calibre: "XXL", categoria: "Premium" }} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();

        expect(Object.fromEntries(new FormData(screen.getByRole("form", { name: "Consultar período histórico" }) as HTMLFormElement))).toMatchObject({ variedad: "", pais: "", calibre: "", categoria: "" });
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Cavendish", "Orgánica"]);
        expect(leerOpcionesFiltro("País")).toEqual(["URUGUAY", "BRASIL", "ECUADOR"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M", "P"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I", "II", "III"]);
        expect(firmasFilasVisibles()).toHaveLength(5);
        expect(Object.fromEntries(new URL(window.location.href).searchParams)).toEqual({ species_id: "60", producto: "Banana", from: fechas.desde, to: fechas.hasta, extra: "anterior" });
        expect(window.location.hash).toBe("#tabla");
        expect(navegar).not.toHaveBeenCalled();
    });

    it("al restaurar un período de la URL limpia solo los atributos ausentes y conserva los que siguen disponibles", () => {
        window.history.replaceState(estadoInicial, "", "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-03&variedad=Cavendish&pais=ECUADOR&calibre=G&categoria=III&extra=anterior#tabla");
        const registro = historicoConFiltros.series[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: [
                { ...registro, date: "2025-11-02", presentations: registro.presentations.slice(0, 1) },
                { ...registro, date: "2025-11-07", presentations: registro.presentations.slice(1) },
            ],
        };
        const { unmount } = render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);
        abrirFiltrosAdicionales();
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Cavendish");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("ECUADOR");
        expect(Object.fromEntries(new FormData(screen.getByRole("form", { name: "Consultar período histórico" }) as HTMLFormElement))).toMatchObject({ variedad: "Cavendish", pais: "ECUADOR", calibre: "", categoria: "" });
        expect(leerOpcionesFiltro("Calibre")).toEqual(["M"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I", "II"]);
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I", "Cavendish|ECUADOR|M|II"]);
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toEqual({ species_id: "60", producto: "Banana", from: fechas.desde, to: "2025-11-03", variedad: "Cavendish", pais: "ECUADOR", extra: "anterior" });
        expect(window.location.hash).toBe("#tabla");
        unmount();

        render(<PreciosHistoricos producto={{ ...productoSinFiltros, variedad: parametros.get("variedad")!, pais: parametros.get("pais")! }} historico={{ ...datos, to: "2025-11-03", series: datos.series.slice(0, 1) }} desde={fechas.desde} hasta="2025-11-03" />);

        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I", "Cavendish|ECUADOR|M|II"]);
        expect(propsGrafica()).toMatchObject({ desde: fechas.desde, hasta: "2025-11-03" });
        expect(navegar).not.toHaveBeenCalled();
    });

    it("incluye ambos extremos del período en las opciones y excluye los registros inmediatamente anteriores y posteriores", () => {
        const presentacion = historico.series[0].presentations[0];
        const datos: HistoricoProducto = {
            ...historico, from: "2025-10-31", to: "2025-11-09",
            series: [
                ["2025-10-31", "Anterior", "ARGENTINA", "XL", "Fuera"],
                [fechas.desde, "Inicio", "URUGUAY", "M", "I"],
                [fechas.hasta, "Fin", "BRASIL", "G", "II"],
                ["2025-11-09", "Posterior", "ECUADOR", "P", "Fuera"],
            ].map(([date, variety, country, caliber, category]) => ({ ...historico.series[0], date, presentations: [{ ...presentacion, variety, country, caliber, prices: [{ ...presentacion.prices[0], category }] }] })),
        };
        render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);
        abrirFiltrosAdicionales();

        expect(leerOpcionesFiltro("Variedad")).toEqual(["Fin", "Inicio"]);
        expect(leerOpcionesFiltro("País")).toEqual(["URUGUAY", "BRASIL"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I", "II"]);
        expect(firmasFilasVisibles()).toEqual(["Fin|BRASIL|G|II", "Inicio|URUGUAY|M|I"]);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: fechas.hasta } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(leerOpcionesFiltro("Variedad")).toEqual(["Fin"]);
        expect(leerOpcionesFiltro("País")).toEqual(["BRASIL"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["II"]);
        expect(firmasFilasVisibles()).toEqual(["Fin|BRASIL|G|II"]);
        expect(navegar).not.toHaveBeenCalled();
    }, 10_000);

    it("mantiene las opciones del período sin cruzarlas con los otros atributos seleccionados", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro("Variedad", "Orgánica");
        seleccionarFiltro("País", "BRASIL");

        expect(firmasFilasVisibles()).toHaveLength(0);
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Cavendish", "Orgánica"]);
        expect(leerOpcionesFiltro("País")).toEqual(["URUGUAY", "BRASIL", "ECUADOR"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M", "P"]);
        expect(leerOpcionesFiltro("Categoría")).toEqual(["I", "II", "III"]);
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Orgánica");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("BRASIL");
        expect(Object.fromEntries(new URL(window.location.href).searchParams)).toMatchObject({ variedad: "Orgánica", pais: "BRASIL" });
        expect(navegar).not.toHaveBeenCalled();
    });

    it("muestra precios de referencia y otros registros del histórico sin un filtro oculto", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);

        const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
        expect(filas).toHaveLength(5);
        const referencias = filas.filter((fila) => within(fila).queryByText("Referencia"));
        expect(referencias).toHaveLength(2);
        expect(filas.length - referencias.length).toBe(3);
        expect(screen.queryByRole("searchbox", { name: "Buscar especie o variedad" })).not.toBeInTheDocument();
        expect(screen.queryByRole("checkbox", { name: "Solo registros de referencia" })).not.toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
    });

    it("muestra la marca en su columna Referencia y deja vacía la celda de los precios no marcados", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        const tabla = within(screen.getByRole("table"));
        expect(tabla.getByRole("columnheader", { name: "Referencia" })).toBeInTheDocument();
        const encabezados = tabla.getAllByRole("columnheader").map((celda) => celda.textContent);
        const indiceReferencia = encabezados.indexOf("Referencia");
        const indicePrecio = encabezados.indexOf("Precio por kg");
        const esperadas = historicoConFiltros.series[0].presentations.flatMap((presentacion) => presentacion.prices);
        const filas = tabla.getAllByRole("row").slice(1);

        expect(filas).toHaveLength(esperadas.length);
        for (const [indice, fila] of filas.entries()) {
            const celdas = within(fila).getAllByRole("cell");
            expect(celdas[indicePrecio]).not.toHaveTextContent("Referencia");
            if (esperadas[indice].is_reference) {
                expect(celdas[indiceReferencia]).toHaveTextContent("Referencia");
            } else {
                expect(celdas[indiceReferencia]).toBeEmptyDOMElement();
            }
        }
    });

    it("limpia los atributos y restaura el período original inmediatamente, incluidos los cambios de fecha pendientes", () => {
        window.history.replaceState(estadoInicial, "", "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Cavendish&pais=ECUADOR&calibre=M&categoria=I&extra=anterior#tabla");
        render(<PreciosHistoricos producto={producto} historico={historicoConFiltros} {...fechas} />);
        expect(firmasFilasVisibles()).toHaveLength(1);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-04" } });
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2025-11-07" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(firmasFilasVisibles()).toHaveLength(0);
        expect(propsGrafica()).toMatchObject({ desde: "2025-11-04", hasta: "2025-11-07", registros: [] });
        abrirFiltrosAdicionales();
        for (const nombre of ["Variedad", "País", "Calibre", "Categoría"]) expect(leerOpcionesFiltro(nombre)).toEqual([]);
        expect(Object.fromEntries(new FormData(screen.getByRole("form") as HTMLFormElement))).toMatchObject({ variedad: "", pais: "", calibre: "", categoria: "" });
        for (const nombre of ["variedad", "pais", "calibre", "categoria"]) expect(new URL(window.location.href).searchParams.has(nombre)).toBe(false);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });

        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

        expect(firmasFilasVisibles()).toHaveLength(5);
        expect(propsGrafica()).toMatchObject(fechas);
        expect(propsGrafica().registros).toHaveLength(5);
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Cavendish", "Orgánica"]);
        expect(leerOpcionesFiltro("Calibre")).toEqual(["G", "M", "P"]);
        expect(screen.getByLabelText(/^Desde/)).toHaveValue(fechas.desde);
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(fechas.hasta);
        expect(Object.fromEntries(new FormData(screen.getByRole("form") as HTMLFormElement))).toMatchObject({ variedad: "", pais: "", calibre: "", categoria: "" });
        expect(Object.fromEntries(new URL(window.location.href).searchParams)).toEqual({ species_id: "60", producto: "Banana", from: fechas.desde, to: fechas.hasta, extra: "anterior" });
        expect(window.location.hash).toBe("#tabla");
        expect(navegar).not.toHaveBeenCalled();
    }, 10_000);

    it("muestra siempre precios por kg en tabla y móvil sin selectores de presentación ni precio por", () => {
        render(<PreciosHistoricos producto={producto} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();
        const tabla = within(screen.getByRole("table"));
        expect(tabla.getByRole("columnheader", { name: "Precio por kg" })).toBeInTheDocument();
        expect(tabla.getByRole("cell", { name: /\$50\s*-\s*\$?60/ })).toBeInTheDocument();
        expect(document.querySelector("article")?.textContent).toMatch(/\$50\s*-\s*\$?60\s*\/ kg/);
        expect(screen.queryByRole("combobox", { name: "Presentación" })).not.toBeInTheDocument();
        expect(screen.queryByRole("combobox", { name: "Precio por" })).not.toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
    });

    it("muestra los rangos invertidos tal como llegaron del webservice sin corregir sus valores", () => {
        const precioRecibido = {
            category: "I", min_kg: 1250.5, max_kg: 900.25,
            min_un: 12505, max_un: 9002.5, is_reference: false,
        };
        const precioOriginal = { ...precioRecibido };
        const datos: HistoricoProducto = {
            ...historico,
            series: [{
                ...historico.series[0],
                presentations: [{ ...historico.series[0].presentations[0], prices: [precioRecibido] }],
            }],
        };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: "$1 250,5 - $900,25" })).toBeInTheDocument();
        const tarjeta = document.querySelector("article");
        expect(tarjeta).not.toBeNull();
        expect(within(tarjeta!).getByText("$1 250,5 - $900,25 / kg")).toBeInTheDocument();
        expect(precioRecibido).toEqual(precioOriginal);
        expect(propsGrafica().registros[0].precio).toBe(precioRecibido);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it.each(valoresInesperados)("muestra precios, volumen y referencia inesperados sin convertir el registro: $texto", ({ valor, texto }) => {
        const precioRecibido = {
            ...historico.series[0].presentations[0].prices[0],
            min_kg: valor, max_kg: valor, min_un: valor, max_un: valor, is_reference: valor,
        };
        const datos: HistoricoProducto = {
            ...historico,
            series: [{
                ...historico.series[0], volume_kg: valor,
                presentations: [{ ...historico.series[0].presentations[0], prices: [precioRecibido] }],
            }],
        };
        const originales = JSON.stringify(datos);
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        const fila = within(screen.getByRole("table")).getAllByRole("row")[1];
        const celdas = within(fila).getAllByRole("cell");
        expect(celdas[6]).toHaveTextContent(`$${texto} - $${texto}`);
        expect(celdas[7]).toHaveTextContent(valor === null ? "—" : `${texto} kg`);
        const tarjeta = document.querySelector("article")!;
        expect(within(tarjeta).getByText(`$${texto} - $${texto} / kg`)).toBeInTheDocument();
        expect(within(tarjeta).getByLabelText(`Volumen: ${valor === null ? "—" : `${texto} kg`}`)).toBeInTheDocument();
        if (valor === true) {
            expect(within(celdas[5]).getByText("Referencia")).toBeInTheDocument();
            expect(within(tarjeta).getByText("Referencia")).toBeInTheDocument();
        } else if (valor === false) {
            expect(celdas[5]).toBeEmptyDOMElement();
            expect(tarjeta.querySelector("header span")).toBeEmptyDOMElement();
        } else {
            expect(celdas[5]).toHaveTextContent(texto);
            expect(tarjeta.querySelector("header span")).toHaveTextContent(texto);
            expect(within(tarjeta).queryByText("Referencia")).not.toBeInTheDocument();
        }
        expect(JSON.stringify(datos)).toBe(originales);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra atributos inesperados como texto y permite filtrarlos sin modificar el JSON recibido", () => {
        const variedad = { nombre: "Ñ" };
        const pais = ["UY", null];
        const calibre = false;
        const categoria = { codigo: ["I", false] };
        const datos: HistoricoProducto = {
            ...historico,
            series: [{
                ...historico.series[0],
                presentations: [{
                    variety: variedad, country: pais, caliber: calibre, measure_unit: { unidad: ["kg", null] },
                    prices: [{ ...historico.series[0].presentations[0].prices[0], category: categoria }],
                }, {
                    variety: null, country: true, caliber: ["M"], measure_unit: false,
                    prices: [{ ...historico.series[0].presentations[0].prices[0], category: null }],
                }],
            }],
        };
        const originales = JSON.stringify(datos);
        const { unmount } = render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);
        expect(firmasFilasVisibles()).toEqual(['{"nombre":"Ñ"}|["UY",null]|false|{"codigo":["I",false]}', '—|true|["M"]|—']);
        const tarjeta = document.querySelector("article")!;
        expect(tarjeta).toHaveTextContent('Banana · {"nombre":"Ñ"}');
        expect(tarjeta).toHaveTextContent('["UY",null] · Cal. false · Cat. {"codigo":["I",false]}');
        abrirFiltrosAdicionales();
        seleccionarFiltro("Variedad", JSON.stringify(variedad));
        seleccionarFiltro("País", JSON.stringify(pais));
        seleccionarFiltro("Calibre", "false");
        seleccionarFiltro("Categoría", JSON.stringify(categoria));

        expect(firmasFilasVisibles()).toHaveLength(1);
        expect(navegar).not.toHaveBeenCalled();
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            variedad: JSON.stringify(variedad), pais: JSON.stringify(pais), calibre: "false", categoria: JSON.stringify(categoria),
        });
        unmount();
        render(<PreciosHistoricos producto={{ ...productoSinFiltros, variedad: JSON.stringify(variedad), pais: JSON.stringify(pais), calibre: "false", categoria: JSON.stringify(categoria) }} historico={datos} {...fechas} />);
        expect(firmasFilasVisibles()).toEqual(['{"nombre":"Ñ"}|["UY",null]|false|{"codigo":["I",false]}']);
        expect(JSON.stringify(datos)).toBe(originales);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("redondea los valores numéricos a dos decimales sin cambiar los valores recibidos", () => {
        const precioRecibido = { ...historico.series[0].presentations[0].prices[0], min_kg: 10.666666, max_kg: 20.666666 };
        const datos: HistoricoProducto = {
            ...historico,
            series: [{
                ...historico.series[0], volume_kg: 1666.666666,
                presentations: [{ ...historico.series[0].presentations[0], prices: [precioRecibido] }],
            }],
        };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: "$10,67 - $20,67" })).toBeInTheDocument();
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "1 666,67 kg" })).toBeInTheDocument();
        expect(within(document.querySelector("article")!).getByText("$10,67 - $20,67 / kg")).toBeInTheDocument();
        expect(precioRecibido.min_kg).toBe(10.666666);
        expect(precioRecibido.max_kg).toBe(20.666666);
        expect(datos.series[0].volume_kg).toBe(1666.666666);
    });

    it.each([
        { min_kg: "Ñ", max_kg: 60, texto: "$Ñ - $60" },
        { min_kg: 50, max_kg: "Ñ", texto: "$50 - $Ñ" },
        { min_kg: "0012.50", max_kg: "0090.25", texto: "$0012.50 - $0090.25" },
        { min_kg: null, max_kg: 60, texto: "$— - $60" },
    ])("muestra valores de precio recibidos en tabla y móvil sin convertirlos: $texto", ({ min_kg, max_kg, texto }) => {
        const precioRecibido = { ...historico.series[0].presentations[0].prices[0], min_kg, max_kg };
        const datos: HistoricoProducto = {
            ...historico,
            series: [{
                ...historico.series[0],
                presentations: [{ ...historico.series[0].presentations[0], prices: [precioRecibido] }],
            }],
        };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);

        expect(within(screen.getByRole("table")).getByRole("cell", { name: texto })).toBeInTheDocument();
        expect(within(document.querySelector("article")!).getByText(`${texto} / kg`)).toBeInTheDocument();
        expect(precioRecibido).toMatchObject({ min_kg, max_kg });
        expect(propsGrafica().registros[0].precio).toBe(precioRecibido);
        expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("aplica atributos a la gráfica inmediatamente y espera Consultar solo para las fechas", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        expect(propsGrafica().registros).toHaveLength(5);
        seleccionarFiltro("Variedad", "Orgánica");
        expect(propsGrafica().registros).toHaveLength(2);
        abrirFiltrosAdicionales();
        seleccionarFiltro("País", "URUGUAY");
        seleccionarFiltro("Calibre", "P");
        seleccionarFiltro("Categoría", "III");
        expect(propsGrafica().registros).toHaveLength(1);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        expect(propsGrafica()).toMatchObject(fechas);
        expect(propsGrafica().registros).toHaveLength(1);
        expect(navegar).not.toHaveBeenCalled();
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        expect(propsGrafica().registros).toHaveLength(1);
        const [destino, opciones] = navegar.mock.calls[0];
        const parametros = new URL(destino, "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            variedad: "Orgánica", pais: "URUGUAY", calibre: "P", categoria: "III",
            from: "2024-11-01", to: "2025-11-08",
        });
        expect(parametros.has("busqueda")).toBe(false);
        expect(parametros.has("solo_referencias")).toBe(false);
        expect(parametros.has("unidad")).toBe(false);
        expect(parametros.has("precio_por")).toBe(false);
        expect(opciones).toEqual({ scroll: false });
    });

    it("reutiliza un período cubierto después de modificar un filtro sin navegar", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro("Calibre", "G");
        expect(firmasFilasVisibles()).toHaveLength(2);
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2025-11-05" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(firmasFilasVisibles()).toHaveLength(2);
        expect(propsGrafica().registros).toHaveLength(2);
        expect(propsGrafica()).toMatchObject({ desde: fechas.desde, hasta: "2025-11-05" });
        expect(Object.fromEntries(new URL(window.location.href).searchParams)).toMatchObject({ calibre: "G", from: fechas.desde, to: "2025-11-05" });
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
    });

    it("permite reintentar el mismo período cuando la carga anterior falló", () => {
        render(<PreciosHistoricos producto={producto} historico={null} opcionesFiltros={opcionesEspecie} {...fechas} error="No pudimos cargar el histórico." />);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", from: fechas.desde, to: fechas.hasta,
            variedad: producto.variedad, pais: producto.pais, calibre: producto.calibre, categoria: producto.categoria,
        });
    });

    it("consulta otra especie al seleccionarla, conserva el período aplicado y descarta sus atributos anteriores", () => {
        window.history.replaceState(estadoInicial, "", "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Cavendish&pais=ECUADOR&calibre=M&categoria=I&extra=anterior#tabla");
        const especies = [{ id: "60", especie: "Banana" }, { id: "61", especie: "Manzana" }];
        const { rerender } = render(<PreciosHistoricos key="banana" producto={producto} historico={historicoConFiltros} especies={especies} {...fechas} />);
        const periodoAplicado = { desde: "2025-11-02", hasta: "2025-11-07" };
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: periodoAplicado.desde } });
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: periodoAplicado.hasta } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I"]);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });

        seleccionarFiltro("Especie", "Manzana");

        expect(navegar).toHaveBeenCalledOnce();
        const destino = new URL(navegar.mock.calls[0][0], window.location.origin);
        expect(Object.fromEntries(destino.searchParams)).toEqual({ species_id: "61", producto: "Manzana", from: periodoAplicado.desde, to: periodoAplicado.hasta, extra: "anterior" });
        expect(destino.hash).toBe("#tabla");
        expect(navegar.mock.calls[0][1]).toEqual({ scroll: false });
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");
        expect(document.querySelectorAll("article")).toHaveLength(0);
        expect(propsGrafica()).toMatchObject({ cargando: true, registros: [] });
        abrirFiltrosAdicionales();
        for (const nombre of ["Especie", "Variedad", "País", "Calibre", "Categoría"]) {
            expect(screen.getByRole("combobox", { name: nombre })).toHaveAttribute("aria-disabled", "true");
        }
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(navegar).toHaveBeenCalledOnce();

        const nuevaPresentacion = {
            ...historicoConFiltros.series[0].presentations[0], variety: "Red Delicious", country: "ARGENTINA", caliber: "G",
        };
        const nuevoHistorico: HistoricoProducto = {
            ...historico, species_id: 61, species: "Manzana", from: periodoAplicado.desde, to: periodoAplicado.hasta,
            series: [{ ...historico.series[0], presentations: [nuevaPresentacion] }],
        };
        rerender(<PreciosHistoricos key="manzana" producto={{ ...productoSinFiltros, id: "61", especie: "Manzana" }} historico={nuevoHistorico} especies={especies} {...periodoAplicado} />);

        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
        expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Histórico de Manzana");
        expect(firmasFilasVisibles()).toEqual(["Red Delicious|ARGENTINA|G|I", "Red Delicious|ARGENTINA|G|II"]);
        expect(propsGrafica()).toMatchObject({ ...periodoAplicado, producto: "Manzana", cargando: false });
        expect(propsGrafica().registros).toHaveLength(2);
        expect(Object.fromEntries(new FormData(screen.getByRole("form") as HTMLFormElement))).toMatchObject({ variedad: "", pais: "", calibre: "", categoria: "" });
        expect(screen.getByLabelText(/^Desde/)).toHaveValue(periodoAplicado.desde);
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(periodoAplicado.hasta);
        expect(navegar).toHaveBeenCalledOnce();
    });

    it("guarda el período aplicado localmente para restaurarlo al recargar sin nuevas consultas", () => {
        window.history.replaceState(
            estadoInicial,
            "",
            "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Cavendish&pais=ECUADOR&calibre=M&categoria=I&extra=anterior#tabla",
        );
        const registro = historico.series[0];
        const datos: HistoricoProducto = {
            ...historico,
            series: ["2025-11-02", "2025-11-07"].map((date) => ({ ...registro, date })),
        };
        const { unmount } = render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);
        const urlAplicada = window.location.href;
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-05" } });
        expect(window.location.href).toBe(urlAplicada);
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "02/11/2025" })).toBeInTheDocument();
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            variedad: "Cavendish", pais: "ECUADOR", calibre: "M", categoria: "I",
            from: "2025-11-05", to: fechas.hasta, extra: "anterior",
        });
        expect(window.location.hash).toBe("#tabla");
        expect(within(screen.getByRole("table")).queryByRole("cell", { name: "02/11/2025" })).not.toBeInTheDocument();
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "07/11/2025" })).toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
        unmount();

        render(
            <PreciosHistoricos
                producto={producto}
                historico={{ ...datos, from: parametros.get("from")!, series: datos.series.slice(1) }}
                desde={parametros.get("from")!}
                hasta={parametros.get("to")!}
            />,
        );
        expect(screen.getByLabelText(/^Desde/)).toHaveValue("2025-11-05");
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(fechas.hasta);
        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "07/11/2025" })).toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
    });

    it("restaura atributos y período de la URL al volver con las propiedades anteriores en caché", () => {
        window.history.replaceState(estadoInicial, "", "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08");
        const registro = historicoConFiltros.series[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: ["2025-11-02", "2025-11-07"].map((date) => ({ ...registro, date })),
        };
        const { unmount } = render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro("Variedad", "Orgánica");
        seleccionarFiltro("País", "URUGUAY");
        seleccionarFiltro("Calibre", "P");
        seleccionarFiltro("Categoría", "III");
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-05" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(firmasFilasVisibles()).toEqual(["Orgánica|URUGUAY|P|III"]);
        unmount();

        render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);

        abrirFiltrosAdicionales();
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Orgánica");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("URUGUAY");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("P");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("III");
        expect(screen.getByLabelText(/^Desde/)).toHaveValue("2025-11-05");
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(fechas.hasta);
        expect(firmasFilasVisibles()).toEqual(["Orgánica|URUGUAY|P|III"]);
        expect(propsGrafica()).toMatchObject({ desde: "2025-11-05", hasta: fechas.hasta });
        expect(propsGrafica().registros).toHaveLength(1);
        expect(propsGrafica().registros[0].dia.date).toBe("2025-11-07");
        expect(navegar).not.toHaveBeenCalled();
    });

    it("restaura la selección de la URL al volver antes de que termine el cambio de especie", () => {
        const urlBanana = "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Orgánica&pais=URUGUAY&calibre=P&categoria=III";
        window.history.replaceState(estadoInicial, "", urlBanana);
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} especies={[{ id: "61", especie: "Manzana" }]} {...fechas} />);
        expect(firmasFilasVisibles()).toEqual(["Orgánica|URUGUAY|P|III"]);
        seleccionarFiltro("Especie", "Manzana");
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "true");

        window.history.replaceState(estadoInicial, "", urlBanana);
        fireEvent(window, new PopStateEvent("popstate"));

        expect(screen.getByRole("combobox", { name: "Especie" })).toHaveTextContent("Banana");
        expect(screen.getByRole("table")).toHaveAttribute("aria-busy", "false");
        expect(firmasFilasVisibles()).toEqual(["Orgánica|URUGUAY|P|III"]);
        expect(propsGrafica().cargando).toBe(false);
        expect(propsGrafica().registros).toHaveLength(1);
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
        expect(navegar).toHaveBeenCalledOnce();
    });

    it("reintenta un período totalmente anterior que quedó vacío cuando no se pudo ampliar el histórico", () => {
        const periodoSolicitado = { desde: "2010-01-01", hasta: "2011-12-31" };
        const datos: HistoricoProducto = {
            ...historico, from: periodoSolicitado.desde, to: periodoSolicitado.hasta, series: [],
        };
        render(<PreciosHistoricos producto={producto} historico={datos} {...periodoSolicitado} />);

        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", from: periodoSolicitado.desde, to: periodoSolicitado.hasta,
        });
    });

    it.each([
        { from: "2025-11-03", to: "2025-11-08", desde: "2025-11-02", hasta: "2025-11-08" },
        { from: "2025-11-01", to: "2025-11-05", desde: "2025-11-01", hasta: "2025-11-07" },
    ])("reintenta en el backend un período solicitado dentro de las fechas originales pero fuera de la cobertura $from a $to", ({ from, to, desde, hasta }) => {
        render(<PreciosHistoricos producto={producto} historico={{ ...historico, from, to }} {...fechas} />);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: desde } });
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: hasta } });

        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({ species_id: "60", from: desde, to: hasta });
    });

    it("reutiliza localmente un período cubierto aunque la respuesta no abarque todas las fechas originales", () => {
        const datos: HistoricoProducto = { ...historico, from: "2025-11-03", to: "2025-11-06" };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: datos.from } });
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: datos.to } });

        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).not.toHaveBeenCalled();
        expect(propsGrafica()).toMatchObject({ desde: datos.from, hasta: datos.to });
        expect(propsGrafica().registros).toHaveLength(1);
        expect(propsGrafica().registros[0].dia.date).toBe("2025-11-03");
        const parametros = new URLSearchParams(window.location.search);
        expect(Object.fromEntries(parametros)).toMatchObject({ from: datos.from, to: datos.to });
    });

    it("aplica un período dentro del histórico cargado al consultar y sólo navega si se amplía más allá", () => {
        const registro = historicoConFiltros.series[0];
        const presentacion = registro.presentations[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: ["2025-11-02", "2025-11-07"].map((date) => ({
                ...registro,
                date,
                presentations: [{ ...presentacion, prices: [presentacion.prices[0]] }],
            })),
        };
        render(<PreciosHistoricos producto={producto} historico={datos} {...fechas} />);
        const tabla = within(screen.getByRole("table"));
        expect(propsGrafica().registros).toHaveLength(2);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-05" } });

        expect(tabla.getAllByRole("row")).toHaveLength(3);
        expect(propsGrafica()).toMatchObject(fechas);
        expect(propsGrafica().registros).toHaveLength(2);
        expect(tabla.getByRole("cell", { name: "02/11/2025" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Consultar" }));

        expect(tabla.getAllByRole("row")).toHaveLength(2);
        expect(propsGrafica()).toMatchObject({ desde: "2025-11-05", hasta: fechas.hasta });
        expect(propsGrafica().registros).toHaveLength(1);
        expect(propsGrafica().registros[0].dia.date).toBe("2025-11-07");
        expect(tabla.queryByRole("cell", { name: "02/11/2025" })).not.toBeInTheDocument();
        expect(tabla.getByRole("cell", { name: "07/11/2025" })).toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();

        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-10-01" } });
        expect(tabla.getAllByRole("row")).toHaveLength(2);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(parametros.get("from")).toBe("2025-10-01");
        expect(parametros.get("to")).toBe(fechas.hasta);
    });

    it.each(["60", "060", JSON.stringify(["2", "60"]), JSON.stringify(["999", 60])])(
        "identifica la especie del catálogo sin duplicarla cuando el producto usa el ID %s", (id) => {
        render(
            <PreciosHistoricos
                producto={{ ...producto, id }}
                historico={historicoConFiltros}
                {...fechas}
                especies={[
                    { id: "60", especie: "Banana" },
                    { id: "61", especie: "Manzana" },
                ]}
            />,
        );
        fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));

        expect(screen.getAllByRole("option", { name: "Banana" })).toHaveLength(1);
        fireEvent.click(screen.getByRole("option", { name: "Banana" }));
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Cavendish");
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I"]);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));
        expect(navegar).not.toHaveBeenCalled();
    });

    it("envía el período y conserva los identificadores y filtros al consultar", () => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);
        const formulario = screen.getByRole("form", { name: "Consultar período histórico" });

        expect(formulario).toHaveAttribute("method", "get");
        expect(formulario).toHaveAttribute("action", "/precios-historicos");
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        const consulta = new FormData(formulario as HTMLFormElement);

        expect(Object.fromEntries(consulta)).toMatchObject({
            species_id: "60", producto: "Banana", variedad: "Cavendish",
            pais: "ECUADOR", calibre: "M", categoria: "I", from: "2024-11-01", to: "2025-11-08",
        });
        expect(consulta.has("classification_id")).toBe(false);
        expect(screen.getByRole("button", { name: "Consultar" })).toHaveAttribute("type", "submit");
        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
    });

    it("requiere consultar para aplicar otro período y no vacía los resultados mientras se edita", () => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-05" } });

        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("consulta el período mediante navegación cliente y conserva los filtros", () => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const [destino, opciones] = navegar.mock.calls[0];
        const parametros = new URL(destino, "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana", variedad: "Cavendish",
            pais: "ECUADOR", calibre: "M", categoria: "I", from: "2024-11-01", to: "2025-11-08",
        });
        expect(parametros.has("classification_id")).toBe(false);
        expect(opciones).toEqual({ scroll: false });
    });

    it("explica un intervalo invertido y evita enviarlo", () => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} />);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-09" } });

        expect(screen.getByRole("alert")).toHaveTextContent("La fecha de inicio debe ser anterior o igual a la fecha de fin.");
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
    });

    it("distingue el fallo de consulta de un período sin registros", async () => {
        render(<PreciosHistoricos producto={producto} historico={null} opcionesFiltros={opcionesEspecie} {...fechas} error="No pudimos cargar los precios históricos." />);

        const aviso = await screen.findByRole("alert");
        expect(aviso).toHaveTextContent("No pudimos cargar los precios históricos.");
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getByRole("region", { name: "Notificaciones" })).toContainElement(aviso);
        expect(screen.queryByText(/No hay registros históricos/)).not.toBeInTheDocument();
    });

    it("ignora los avisos de calidad guardados por versiones anteriores y muestra los registros", () => {
        const erroresValidacion = [
            '03/11/2025, Banana Cavendish: series[0].presentations[0].prices[1].min_kg tiene el valor "Ñ"; se esperaba un número finito.',
            "03/11/2025, Banana Cavendish: el precio mínimo por kg ($70) es mayor que el máximo ($60).",
        ];
        const datosGuardados = { ...historico, erroresValidacion };
        render(<PreciosHistoricos producto={producto} historico={datosGuardados} {...fechas} />);

        expect(document.querySelector("details")).toBeNull();
        for (const mensaje of erroresValidacion) expect(screen.queryByText(mensaje)).not.toBeInTheDocument();
        expect(screen.queryByText(/Ver errores del histórico/)).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        const tabla = screen.getByRole("table");
        expect(within(tabla).getAllByRole("row")).toHaveLength(2);
        expect(within(tabla).getByRole("cell", { name: "$50 - $60" })).toBeInTheDocument();
        expect(document.querySelector("article")).toHaveTextContent("$50 - $60 / kg");
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
    });

    it.each([
        "No pudimos cargar los precios históricos.",
        "SyntaxError: Unexpected token al leer el JSON del histórico.",
    ])("muestra un único toast y conserva la consulta cuando falla la carga: %s", (error) => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} error={error} />);

        const tabla = screen.getByRole("table");
        expect(tabla).toHaveAttribute("aria-busy", "false");
        expect(within(tabla).getAllByRole("columnheader")).toHaveLength(8);
        expect(within(tabla).queryByRole("alert")).not.toBeInTheDocument();
        expect(within(tabla).getByText("Consultá nuevamente para ver los precios.").closest("td")).toHaveAttribute("colspan", "8");
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(within(screen.getByRole("region", { name: "Notificaciones" })).getByRole("alert")).toHaveTextContent(error);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(within(tabla).queryByRole("cell", { name: "ECUADOR" })).not.toBeInTheDocument();
        expect(document.querySelectorAll("article")).toHaveLength(0);
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
    });

    it("mantiene el indicador durante un reintento y muestra el aviso sólo cuando termina la carga", () => {
        const error = "No pudimos cargar los precios históricos.";
        const { rerender } = render(
            <PreciosHistoricos producto={producto} historico={null} opcionesFiltros={opcionesEspecie} {...fechas} error={error} cargando />,
        );
        expect(propsGrafica()).toMatchObject({ cargando: true, error: true, registros: [] });
        expect(screen.getAllByRole("progressbar", { name: "Cargando precios históricos" })).toHaveLength(2);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByTestId("WarningAmberIcon")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();
        abrirFiltrosAdicionales();
        for (const [nombre, valor] of [["Variedad", producto.variedad], ["País", producto.pais], ["Calibre", producto.calibre], ["Categoría", producto.categoria]]) {
            expect(screen.getByRole("combobox", { name: nombre })).toHaveTextContent(valor);
        }

        rerender(<PreciosHistoricos producto={producto} historico={null} opcionesFiltros={opcionesEspecie} {...fechas} error={error} />);
        expect(propsGrafica()).toMatchObject({ cargando: false, error: true, registros: [] });
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(screen.getAllByRole("alert")).toHaveLength(1);
        expect(screen.getByRole("alert")).toHaveTextContent(error);
        expect(within(screen.getByRole("region", { name: "Notificaciones" })).getByRole("alert")).toHaveTextContent(error);
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
        expect(Object.fromEntries(new FormData(screen.getByRole("form") as HTMLFormElement))).toMatchObject({ variedad: producto.variedad, pais: producto.pais, calibre: producto.calibre, categoria: producto.categoria });
    });

    it("muestra un estado vacío para una respuesta exitosa sin registros", () => {
        render(<PreciosHistoricos producto={producto} historico={{ ...historico, series: [] }} {...fechas} />);

        expect(screen.getByRole("status")).toHaveTextContent("No hay registros históricos");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra los datos recibidos aunque sus identificadores y nombre difieran de la selección", () => {
        const respuesta = {
            ...historico, classification_id: 9, species_id: 999, species: "Nombre del webservice",
        };
        render(<PreciosHistoricos producto={{ ...producto, especie: "Nombre del enlace" }} historico={respuesta} {...fechas} />);

        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "ECUADOR" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Cavendish");
        expect(document.querySelectorAll("article")).toHaveLength(1);
    });
});
