import { fireEvent, render, screen, within } from "@testing-library/react";
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
    afterEach(() => window.history.replaceState(estadoInicial, "", urlInicial));

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
        expect(within(filtros).getByRole("button", { name: "Consultar", exact: true })).toHaveAttribute("type", "submit");
        expect(propsGrafica()).toMatchObject({ ...fechas, producto: "Banana", cargando: false, error: false });
    });

    it.each([
        ["País", "BRASIL", 1, "pais"],
        ["Calibre", "G", 2, "calibre"],
        ["Categoría", "II", 2, "categoria"],
        ["Variedad", "Orgánica", 2, "variedad"],
        ["Especie", "Manzana", 5, null],
        ["Desde", "2025-11-04", 5, null],
        ["Hasta", "2025-11-02", 5, null],
        ["Limpiar", "", 5, null],
    ] as const)("conserva la consulta aplicada y los parámetros ajenos al cambiar %s", (campo, valor, cantidad, parametro) => {
        const estadoRuta = { __NA: true, arbol: { producto: "Banana", datosCargados: true } };
        window.history.replaceState(
            estadoRuta,
            "",
            "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=&pais=&calibre=&categoria=&extra=anterior#tabla",
        );
        render(
            <PreciosHistoricos
                producto={productoSinFiltros}
                historico={historicoConFiltros}
                {...fechas}
                especies={[
                    { id: "60", especie: "Banana" },
                    { id: "61", especie: "Manzana" },
                ]}
            />,
        );
        abrirFiltrosAdicionales();
        if (campo === "Desde" || campo === "Hasta") {
            fireEvent.change(screen.getByLabelText(new RegExp(`^${campo}`)), { target: { value: valor } });
        } else if (campo === "Limpiar") {
            fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
        } else {
            seleccionarFiltro(campo, valor);
        }

        expect(window.location.pathname).toBe("/precios-historicos");
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            from: fechas.desde, to: fechas.hasta, extra: "anterior",
        });
        expect(parametros.has("classification_id")).toBe(false);
        if (parametro) expect(parametros.get(parametro)).toBe(valor);
        expect(window.location.hash).toBe("#tabla");
        expect(firmasFilasVisibles()).toHaveLength(cantidad);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(navegar).toHaveBeenCalledTimes(parametro ? 1 : 0);
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
        const filasAntesDeRecargar = firmasFilasVisibles();
        expect(filasAntesDeRecargar).toEqual(["Orgánica|ECUADOR|G|II"]);
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", producto: "Banana",
            variedad: "Orgánica", pais: "ECUADOR", calibre: "G", categoria: "II",
            from: fechas.desde, to: fechas.hasta,
        });
        expect(parametros.getAll("extra")).toEqual(["anterior", "segundo"]);
        expect(window.location.hash).toBe("#tabla");
        expect(navegar).toHaveBeenCalledTimes(4);
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
        expect(firmasFilasVisibles()).toEqual(filasAntesDeRecargar);
        expect(document.querySelectorAll("article")).toHaveLength(filasAntesDeRecargar.length);
        expect(navegar).toHaveBeenCalledTimes(4);
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
        expect(navegar).toHaveBeenCalledTimes(4);
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
        expect(paginacion.getByText("1-40 de 83")).toBeInTheDocument();
        expect(paginacion.getByText("Página 1 de 3")).toBeInTheDocument();
        expect(paginacion.getByRole("button", { name: "Anterior" })).toBeDisabled();

        fireEvent.click(paginacion.getByRole("button", { name: "Siguiente" }));
        expect(propsGrafica().registros).toBe(registrosGrafica);
        expect(paginacion.getByText("41-80 de 83")).toBeInTheDocument();
        expect(within(tabla).getByRole("cell", { name: "Variedad 41" })).toBeInTheDocument();
        expect(within(tabla).getAllByRole("row")).toHaveLength(41);
        expect(document.querySelectorAll("article")).toHaveLength(40);

        fireEvent.click(paginacion.getByRole("button", { name: "Siguiente" }));
        expect(propsGrafica().registros).toBe(registrosGrafica);
        expect(paginacion.getByText("81-83 de 83")).toBeInTheDocument();
        expect(paginacion.getByText("Página 3 de 3")).toBeInTheDocument();
        expect(within(tabla).getAllByRole("row")).toHaveLength(4);
        expect(document.querySelectorAll("article")).toHaveLength(3);
        expect(paginacion.getByRole("button", { name: "Siguiente" })).toBeDisabled();

        fireEvent.click(paginacion.getByRole("button", { name: "Anterior" }));
        expect(paginacion.getByText("Página 2 de 3")).toBeInTheDocument();
        expect(navegar).not.toHaveBeenCalled();
    });

    it("oculta los controles cuando los resultados no superan los 40 registros", () => {
        render(<PreciosHistoricos producto={{ ...producto, variedad: "" }} historico={historicoConRegistros(40)} {...fechas} />);
        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(41);
        expect(screen.queryByRole("navigation", { name: "Páginas de precios históricos" })).not.toBeInTheDocument();
    });

    it("solicita el filtro al backend y vuelve al inicio cuando los resultados se reducen", () => {
        const datos = historicoConRegistros(83);
        render(<PreciosHistoricos producto={{ ...producto, variedad: "" }} historico={datos} {...fechas} />);
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
        fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));

        seleccionarFiltro("Variedad", "Variedad 83");
        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(2);
        expect(within(screen.getByRole("table")).getByRole("cell", { name: "Variedad 83" })).toBeInTheDocument();
        expect(screen.queryByRole("navigation", { name: "Páginas de precios históricos" })).not.toBeInTheDocument();
        expect(navegar).toHaveBeenCalledOnce();
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

        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(3);
        expect(hasta).toHaveValue("2025-11-02");
        expect(masFiltros).toHaveAttribute("aria-expanded", "false");
        expect(navegar).toHaveBeenCalledTimes(2);
        expect(new URL(navegar.mock.calls[1][0], "https://app.example.test").searchParams.get("to")).toBe("2025-11-02");
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    });

    it.each([
        ["Calibre", "G", ["Cavendish|BRASIL|G|I", "Orgánica|ECUADOR|G|II"]],
        ["País", "BRASIL", ["Cavendish|BRASIL|G|I"]],
        ["Categoría", "II", ["Cavendish|ECUADOR|M|II", "Orgánica|ECUADOR|G|II"]],
        ["Variedad", "Orgánica", ["Orgánica|URUGUAY|P|III", "Orgánica|ECUADOR|G|II"]],
    ] as const)("solicita el filtro por %s al backend y actualiza los registros visibles", (nombre, opcion, esperadas) => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro(nombre, opcion);

        expect(firmasFilasVisibles()).toEqual(esperadas);
        expect(document.querySelectorAll("article")).toHaveLength(esperadas.length);
        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        const parametro = { Calibre: "calibre", País: "pais", Categoría: "categoria", Variedad: "variedad" }[nombre];
        expect(parametros.get(parametro)).toBe(opcion);
    });

    it("permite ampliar un filtro usando las opciones del backend aunque el JSON recibido esté filtrado", () => {
        const registro = historicoConFiltros.series[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: [
                { ...registro, date: "2025-11-02", presentations: registro.presentations.slice(0, 1) },
                { ...registro, date: "2025-11-07", presentations: registro.presentations.slice(1) },
            ],
        };
        const datosFiltrados: HistoricoProducto = {
            ...datos,
            series: [{ ...datos.series[1], presentations: datos.series[1].presentations.filter((presentacion) => presentacion.caliber === "G") }],
        };
        const opcionesFiltros = {
            variedades: ["Cavendish", "Orgánica"], paises: ["BRASIL", "ECUADOR", "URUGUAY"],
            calibres: ["G", "M", "P"], categorias: ["I", "II", "III"],
        };
        const { unmount } = render(
            <PreciosHistoricos producto={{ ...productoSinFiltros, calibre: "G" }} historico={datosFiltrados} opcionesFiltros={opcionesFiltros} {...fechas} />,
        );
        abrirFiltrosAdicionales();
        const opcionesEsperadas = {
            Variedad: ["Cavendish", "Orgánica"],
            País: ["BRASIL", "ECUADOR", "URUGUAY"],
            Calibre: ["G", "M", "P"],
            Categoría: ["I", "II", "III"],
        };
        const comprobarOpciones = () => {
            for (const [nombre, esperadas] of Object.entries(opcionesEsperadas)) {
                expect(leerOpcionesFiltro(nombre)).toEqual(esperadas);
            }
        };
        comprobarOpciones();
        expect(firmasFilasVisibles()).toHaveLength(2);

        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2025-11-03" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(within(screen.getByRole("table")).getAllByRole("row")).toHaveLength(1);
        comprobarOpciones();
        seleccionarFiltro("Calibre", "M");
        expect(firmasFilasVisibles()).toHaveLength(0);
        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({ calibre: "M", from: fechas.desde, to: "2025-11-03" });
        unmount();

        render(
            <PreciosHistoricos
                producto={{ ...productoSinFiltros, calibre: "M" }}
                historico={{ ...datos, to: "2025-11-03", series: datos.series.slice(0, 1) }}
                opcionesFiltros={opcionesFiltros}
                desde={fechas.desde} hasta="2025-11-03"
            />,
        );
        expect(firmasFilasVisibles()).toEqual(["Cavendish|ECUADOR|M|I", "Cavendish|ECUADOR|M|II"]);
    }, 10_000);

    it("conserva filtros iniciales ausentes en la respuesta y muestra cero resultados", () => {
        render(
            <PreciosHistoricos
                producto={{ ...producto, variedad: "Inexistente", pais: "ARGENTINA", calibre: "XXL", categoria: "Premium" }}
                historico={historicoConFiltros}
                {...fechas}
            />,
        );
        abrirFiltrosAdicionales();

        expect(firmasFilasVisibles()).toHaveLength(0);
        expect(screen.getByRole("combobox", { name: "Variedad" })).toHaveTextContent("Inexistente");
        expect(screen.getByRole("combobox", { name: "País" })).toHaveTextContent("ARGENTINA");
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("XXL");
        expect(screen.getByRole("combobox", { name: "Categoría" })).toHaveTextContent("Premium");
        expect(leerOpcionesFiltro("Variedad")).toEqual(expect.arrayContaining(["Cavendish", "Orgánica", "Inexistente"]));
        expect(leerOpcionesFiltro("País")).toEqual(expect.arrayContaining(["BRASIL", "ECUADOR", "URUGUAY", "ARGENTINA"]));
        expect(leerOpcionesFiltro("Calibre")).toEqual(expect.arrayContaining(["G", "M", "P", "XXL"]));
        expect(leerOpcionesFiltro("Categoría")).toEqual(expect.arrayContaining(["I", "II", "III", "Premium"]));
        const formulario = screen.getByRole("form", { name: "Consultar período histórico" });
        expect(Object.fromEntries(new FormData(formulario as HTMLFormElement))).toMatchObject({
            variedad: "Inexistente", pais: "ARGENTINA", calibre: "XXL", categoria: "Premium",
        });
        expect(screen.getByRole("status")).toHaveTextContent("No hay registros históricos");
        expect(navegar).not.toHaveBeenCalled();
    });

    it("mantiene el filtro seleccionado cuando el backend devuelve un período sin coincidencias", () => {
        window.history.replaceState(
            estadoInicial,
            "",
            "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&extra=anterior#tabla",
        );
        const registro = historicoConFiltros.series[0];
        const datos: HistoricoProducto = {
            ...historicoConFiltros,
            series: [
                { ...registro, date: "2025-11-02", presentations: registro.presentations.slice(0, 1) },
                { ...registro, date: "2025-11-07", presentations: registro.presentations.slice(1, 2) },
            ],
        };
        const { unmount } = render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro("Calibre", "G");
        expect(firmasFilasVisibles()).toEqual(["Cavendish|BRASIL|G|I"]);
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2025-11-03" } });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(firmasFilasVisibles()).toHaveLength(1);
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", calibre: "G",
            from: fechas.desde, to: "2025-11-03", extra: "anterior",
        });
        expect(navegar).toHaveBeenCalledTimes(2);
        unmount();

        render(
            <PreciosHistoricos
                producto={{ ...productoSinFiltros, calibre: parametros.get("calibre")! }}
                historico={{ ...datos, to: parametros.get("to")!, series: [] }}
                opcionesFiltros={{ variedades: ["Cavendish"], paises: ["ECUADOR"], calibres: ["M"], categorias: ["I", "II"] }}
                desde={parametros.get("from")!}
                hasta={parametros.get("to")!}
            />,
        );
        abrirFiltrosAdicionales();
        expect(screen.getByRole("combobox", { name: "Calibre" })).toHaveTextContent("G");
        expect(leerOpcionesFiltro("Calibre")).toEqual(expect.arrayContaining(["G", "M"]));
        expect(firmasFilasVisibles()).toHaveLength(0);
        expect(document.querySelectorAll("article")).toHaveLength(0);
        expect(screen.getByRole("status")).toHaveTextContent("No hay registros históricos");
        expect(navegar).toHaveBeenCalledTimes(2);
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

    it("consulta el backend al limpiar filtros y recupera las presentaciones del histórico", () => {
        window.history.replaceState(
            estadoInicial,
            "",
            "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&variedad=Cavendish&pais=ECUADOR&calibre=M&categoria=I&extra=anterior#tabla",
        );
        render(<PreciosHistoricos producto={producto} historico={historicoConFiltros} {...fechas} />);
        expect(firmasFilasVisibles()).toHaveLength(1);
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2025-11-04" } });
        fireEvent.change(screen.getByLabelText(/^Hasta/), { target: { value: "2025-11-07" } });
        fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));

        expect(firmasFilasVisibles()).toHaveLength(5);
        expect(screen.getByLabelText(/^Desde/)).toHaveValue(fechas.desde);
        expect(screen.getByLabelText(/^Hasta/)).toHaveValue(fechas.hasta);
        const parametros = new URL(window.location.href).searchParams;
        expect(Object.fromEntries(parametros)).toEqual({
            species_id: "60", producto: "Banana",
            from: fechas.desde, to: fechas.hasta, extra: "anterior",
        });
        expect(window.location.hash).toBe("#tabla");
        expect(navegar).toHaveBeenCalledOnce();
    });

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
        render(<PreciosHistoricos producto={productoSinFiltros} historico={datos} {...fechas} />);
        expect(firmasFilasVisibles()).toEqual(['{"nombre":"Ñ"}|["UY",null]|false|{"codigo":["I",false]}', '—|true|["M"]|—']);
        const tarjeta = document.querySelector("article")!;
        expect(tarjeta).toHaveTextContent('Banana · {"nombre":"Ñ"}');
        expect(tarjeta).toHaveTextContent('["UY",null] · Cal. false · Cat. {"codigo":["I",false]}');
        abrirFiltrosAdicionales();
        seleccionarFiltro("Variedad", JSON.stringify(variedad));
        seleccionarFiltro("País", JSON.stringify(pais));
        seleccionarFiltro("Calibre", "false");
        seleccionarFiltro("Categoría", JSON.stringify(categoria));

        expect(firmasFilasVisibles()).toEqual(['{"nombre":"Ñ"}|["UY",null]|false|{"codigo":["I",false]}']);
        expect(navegar).toHaveBeenCalledTimes(4);
        const parametros = new URL(navegar.mock.calls[3][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            variedad: JSON.stringify(variedad), pais: JSON.stringify(pais), calibre: "false", categoria: JSON.stringify(categoria),
        });
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

    it("consulta los filtros al cambiarlos y aplica las fechas al presionar Consultar", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        expect(propsGrafica().registros).toHaveLength(5);
        seleccionarFiltro("Variedad", "Orgánica");
        expect(propsGrafica().registros).toHaveLength(2);
        expect(propsGrafica().registros.map(({ precio }) => precio)).toEqual([
            historicoConFiltros.series[0].presentations[2].prices[0],
            historicoConFiltros.series[0].presentations[3].prices[0],
        ]);
        abrirFiltrosAdicionales();
        seleccionarFiltro("País", "URUGUAY");
        seleccionarFiltro("Calibre", "P");
        seleccionarFiltro("Categoría", "III");
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        expect(navegar).toHaveBeenCalledTimes(4);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledTimes(5);
        const [destino, opciones] = navegar.mock.calls[4];
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

    it("consulta el backend si un filtro cambió y todavía no recibió la respuesta", () => {
        render(<PreciosHistoricos producto={productoSinFiltros} historico={historicoConFiltros} {...fechas} />);
        abrirFiltrosAdicionales();
        seleccionarFiltro("Calibre", "G");
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(firmasFilasVisibles()).toEqual(["Cavendish|BRASIL|G|I", "Orgánica|ECUADOR|G|II"]);
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(navegar).toHaveBeenCalledTimes(2);
    });

    it("permite reintentar el mismo período cuando la carga anterior falló", () => {
        render(<PreciosHistoricos producto={producto} historico={null} {...fechas} error="No pudimos cargar el histórico." />);
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "60", from: fechas.desde, to: fechas.hasta,
        });
    });

    it("permite elegir otra especie y consulta sus identificadores sólo al confirmar el período", () => {
        window.history.replaceState(
            estadoInicial,
            "",
            "/precios-historicos?species_id=60&producto=Banana&from=2025-11-01&to=2025-11-08&extra=anterior#tabla",
        );
        render(
            <PreciosHistoricos
                producto={productoSinFiltros}
                historico={historicoConFiltros}
                {...fechas}
                especies={[
                    { id: "60", especie: "Banana" },
                    { id: "61", especie: "Manzana" },
                ]}
            />,
        );
        seleccionarFiltro("Especie", "Manzana");

        expect(firmasFilasVisibles()).toHaveLength(5);
        expect(navegar).not.toHaveBeenCalled();
        expect(Object.fromEntries(new URL(window.location.href).searchParams)).toMatchObject({
            species_id: "60", producto: "Banana",
            from: fechas.desde, to: fechas.hasta, extra: "anterior",
        });
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const destino = new URL(navegar.mock.calls[0][0], "https://app.example.test");
        const parametros = destino.searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "61", producto: "Manzana",
            from: fechas.desde, to: fechas.hasta, extra: "anterior",
        });
        expect(destino.hash).toBe("#tabla");
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

    it("limpia los filtros específicos de la especie anterior antes de consultar otro producto", () => {
        render(
            <PreciosHistoricos
                producto={producto}
                historico={historicoConFiltros}
                {...fechas}
                especies={[
                    { id: "60", especie: "Banana" },
                    { id: "61", especie: "Manzana" },
                ]}
            />,
        );
        fireEvent.change(screen.getByLabelText(/^Desde/), { target: { value: "2024-11-01" } });
        seleccionarFiltro("Especie", "Manzana");

        abrirFiltrosAdicionales();
        for (const nombre of ["Variedad", "País", "Calibre", "Categoría"]) {
            expect(screen.getByRole("combobox", { name: nombre })).toHaveAttribute("aria-disabled", "true");
        }
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
        expect(screen.getByLabelText(/^Desde/)).toHaveValue("2024-11-01");
        expect(navegar).not.toHaveBeenCalled();
        fireEvent.submit(screen.getByRole("form", { name: "Consultar período histórico" }));

        expect(navegar).toHaveBeenCalledOnce();
        const parametros = new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams;
        expect(Object.fromEntries(parametros)).toMatchObject({
            species_id: "61", producto: "Manzana",
            from: "2024-11-01", to: fechas.hasta,
        });
        for (const filtro of ["variedad", "pais", "calibre", "categoria"]) {
            expect(parametros.has(filtro)).toBe(false);
        }
    });

    it("vuelve a habilitar los filtros del histórico cargado al recuperar la especie consultada", () => {
        render(
            <PreciosHistoricos
                producto={producto}
                historico={historicoConFiltros}
                {...fechas}
                especies={[
                    { id: "60", especie: "Banana" },
                    { id: "61", especie: "Manzana" },
                ]}
            />,
        );
        seleccionarFiltro("Especie", "Manzana");
        seleccionarFiltro("Especie", "Banana");
        abrirFiltrosAdicionales();

        for (const nombre of ["Variedad", "País", "Calibre", "Categoría"]) {
            expect(screen.getByRole("combobox", { name: nombre })).not.toHaveAttribute("aria-disabled", "true");
        }
        expect(leerOpcionesFiltro("Variedad")).toEqual(["Cavendish", "Orgánica"]);
        seleccionarFiltro("Variedad", "Orgánica");
        expect(firmasFilasVisibles()).toHaveLength(2);
        expect(navegar).toHaveBeenCalledOnce();
        expect(new URL(navegar.mock.calls[0][0], "https://app.example.test").searchParams.get("variedad")).toBe("Orgánica");
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
        fireEvent.click(screen.getByRole("button", { name: "Consultar", exact: true }));

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

    it("distingue el fallo de consulta de un período sin registros", () => {
        render(<PreciosHistoricos producto={producto} historico={null} {...fechas} error="No pudimos cargar los precios históricos." />);

        expect(screen.getAllByRole("alert")).toHaveLength(2);
        for (const aviso of screen.getAllByRole("alert")) {
            expect(aviso).toHaveTextContent("No pudimos cargar los precios históricos.");
        }
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
    ])("muestra un aviso con icono en tabla y móvil cuando falla la carga: %s", (error) => {
        render(<PreciosHistoricos producto={producto} historico={historico} {...fechas} error={error} />);

        const tabla = screen.getByRole("table");
        expect(tabla).toHaveAttribute("aria-busy", "false");
        expect(within(tabla).getAllByRole("columnheader")).toHaveLength(8);
        const avisoTabla = within(tabla).getByRole("alert");
        expect(avisoTabla).toHaveTextContent(error);
        expect(within(avisoTabla).getByTestId("WarningAmberIcon")).toBeInTheDocument();
        expect(avisoTabla.closest("td")).toHaveAttribute("colspan", "8");
        const avisos = screen.getAllByRole("alert");
        expect(avisos).toHaveLength(2);
        const avisoMobile = avisos.find((aviso) => !tabla.contains(aviso));
        expect(avisoMobile).toBeDefined();
        expect(avisoMobile!).toHaveTextContent(error);
        expect(within(avisoMobile!).getByTestId("WarningAmberIcon")).toBeInTheDocument();
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(within(tabla).queryByRole("cell", { name: "ECUADOR" })).not.toBeInTheDocument();
        expect(document.querySelectorAll("article")).toHaveLength(0);
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
    });

    it("mantiene el indicador durante un reintento y muestra el aviso sólo cuando termina la carga", () => {
        const error = "No pudimos cargar los precios históricos.";
        const { rerender } = render(
            <PreciosHistoricos producto={producto} historico={null} {...fechas} error={error} cargando />,
        );
        expect(propsGrafica()).toMatchObject({ cargando: true, error: true, registros: [] });
        expect(screen.getAllByRole("progressbar", { name: "Cargando precios históricos" })).toHaveLength(2);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByTestId("WarningAmberIcon")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Consultar" })).toBeDisabled();

        rerender(<PreciosHistoricos producto={producto} historico={null} {...fechas} error={error} />);
        expect(propsGrafica()).toMatchObject({ cargando: false, error: true, registros: [] });
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(screen.getAllByRole("alert")).toHaveLength(2);
        expect(screen.getAllByTestId("WarningAmberIcon")).toHaveLength(2);
        expect(screen.getByRole("button", { name: "Consultar" })).toBeEnabled();
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
