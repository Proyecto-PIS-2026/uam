// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Suspense } from "react";
import type { HistoricoProducto } from "@/modulos/informacion-uam/precios-historicos/tipos";
import Page, { dynamic } from "./page";

const { obtenerHistoricoPreciosMock, preciosHistoricosMock, obtenerCatalogoMock } = vi.hoisted(() => ({
    obtenerHistoricoPreciosMock: vi.fn(),
    preciosHistoricosMock: vi.fn(() => null),
    obtenerCatalogoMock: vi.fn(),
}));

vi.mock("@/modulos/informacion-uam/precios-historicos/catalogo-especies", () => ({
    obtenerCatalogoEspeciesHistoricas: obtenerCatalogoMock,
}));

vi.mock("@/modulos/informacion-uam/precios-historicos/consultas-precios-historicos", () => ({
    obtenerHistoricoPrecios: obtenerHistoricoPreciosMock,
}));

vi.mock("@/modulos/informacion-uam/precios-historicos/PreciosHistoricos", () => ({
    default: preciosHistoricosMock,
}));

const historico: HistoricoProducto = {
    classification_id: 2,
    classification: "Frutas",
    species_id: 60,
    species: "Banana",
    from: "2023-10-05",
    to: "2026-10-05",
    series: [],
};

type Parametros = Awaited<Parameters<typeof Page>[0]["searchParams"]>;

async function cargarPagina(parametros: Parametros) {
    const contenido = await Page({ searchParams: Promise.resolve(parametros) });
    return contenido.props.children.props.children;
}

async function resolverHistorico(parametros: Parametros) {
    const suspense = await cargarPagina(parametros);
    const contenido = suspense.props.children;
    const componente = await contenido.type(contenido.props);
    return { suspense, componente };
}

describe("Página de precios históricos", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-06T02:00:00Z"));
        obtenerHistoricoPreciosMock.mockReset();
        obtenerHistoricoPreciosMock.mockResolvedValue(historico);
        obtenerCatalogoMock.mockReset();
        obtenerCatalogoMock.mockResolvedValue([{ id: JSON.stringify([2, 60]), especie: "Banana" }]);
    });

    afterEach(() => vi.useRealTimers());

    it("consulta por identificadores con tres años por defecto hasta hoy según la fecha de Montevideo", async () => {
        const { suspense, componente } = await resolverHistorico({ classification_id: "2", species_id: "60", producto: "Otra fruta" });

        expect(dynamic).toBe("force-dynamic");
        expect(suspense.type).toBe(Suspense);
        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledExactlyOnceWith({
            classificationId: 2, speciesId: 60, desde: "2023-10-05", hasta: "2026-10-05",
        });
        expect(componente.type).toBe(preciosHistoricosMock);
        expect(componente.props.historico).toBe(historico);
        expect(componente.props.producto.especie).toBe("Banana");
        expect(componente.props.desde).toBe("2023-10-05");
        expect(componente.props.hasta).toBe("2026-10-05");
        expect(componente.props.error).toBeUndefined();
    });

    it("conserva los filtros vigentes e ignora los controles retirados de enlaces anteriores", async () => {
        const parametros = {
            classification_id: "2", species_id: "60", variedad: "Orgánica", pais: "ECUADOR",
            calibre: "G", categoria: "II", busqueda: "organica", unidad: "CAJÓN",
            precio_por: "unidad", solo_referencias: "1", from: "2024-11-01", to: "2025-11-08",
        };
        const { suspense, componente } = await resolverHistorico(parametros);
        expect(componente.props.filtros).toBeUndefined();
        expect(suspense.props.fallback.props.filtros).toBeUndefined();
        expect(componente.props.especies).toEqual([{ id: JSON.stringify([2, 60]), especie: "Banana" }]);
        expect(componente.props.producto).toMatchObject({ variedad: "Orgánica", pais: "ECUADOR", calibre: "G", categoria: "II" });
        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledExactlyOnceWith({
            classificationId: 2, speciesId: 60, desde: "2024-11-01", hasta: "2025-11-08",
        });
    });

    it("calcula el inicio desde hoy menos tres años aunque se solicite otra fecha de fin", async () => {
        const { componente } = await resolverHistorico({
            classification_id: "2", species_id: "60", to: "2025-11-08",
        });

        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledExactlyOnceWith({
            classificationId: 2, speciesId: 60, desde: "2023-10-05", hasta: "2025-11-08",
        });
        expect(componente.props.desde).toBe("2023-10-05");
        expect(componente.props.hasta).toBe("2025-11-08");
    });

    it("conserva un inicio explícito y usa hoy por defecto como fecha de fin", async () => {
        const { componente } = await resolverHistorico({
            classification_id: "2", species_id: "60", from: "2024-07-01",
        });

        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledExactlyOnceWith({
            classificationId: 2, speciesId: 60, desde: "2024-07-01", hasta: "2026-10-05",
        });
        expect(componente.props.desde).toBe("2024-07-01");
        expect(componente.props.hasta).toBe("2026-10-05");
    });

    it("ajusta el 29 de febrero al restar tres años a la fecha local de Montevideo", async () => {
        vi.setSystemTime(new Date("2024-03-01T01:00:00Z"));
        const { componente } = await resolverHistorico({ classification_id: "2", species_id: "60" });

        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledExactlyOnceWith({
            classificationId: 2, speciesId: 60, desde: "2021-02-28", hasta: "2024-02-29",
        });
        expect(componente.props.desde).toBe("2021-02-28");
        expect(componente.props.hasta).toBe("2024-02-29");
    });

    it("consulta el intervalo solicitado y conserva los filtros de presentación", async () => {
        const { suspense, componente } = await resolverHistorico({
            classification_id: "2", species_id: "60", from: "2025-11-01", to: "2025-11-08",
            variedad: "Cavendish", pais: "ECUADOR", calibre: "M", categoria: "I",
        });

        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledExactlyOnceWith({
            classificationId: 2, speciesId: 60, desde: "2025-11-01", hasta: "2025-11-08",
        });
        expect(componente.props.producto).toMatchObject({
            variedad: "Cavendish", pais: "ECUADOR", calibre: "M", categoria: "I",
        });
        expect(suspense.key).toContain("2025-11-01");
        expect(suspense.key).toContain("2025-11-08");
    });

    it("devuelve la página y sus filtros antes de resolver la consulta de precios", async () => {
        let resolverConsulta!: (datos: HistoricoProducto) => void;
        const consultaPendiente = new Promise<HistoricoProducto>((resolve) => { resolverConsulta = resolve; });
        obtenerHistoricoPreciosMock.mockReturnValue(consultaPendiente);
        const suspense = await cargarPagina({
            classification_id: "2", species_id: "60", from: "2025-11-01", to: "2025-11-08",
            producto: "Banana", variedad: "Cavendish", pais: "ECUADOR", calibre: "M", categoria: "I",
        });

        expect(obtenerHistoricoPreciosMock).not.toHaveBeenCalled();
        expect(suspense.type).toBe(Suspense);
        const fallback = suspense.props.fallback;
        expect(fallback.type).toBe(preciosHistoricosMock);
        expect(fallback.props).toMatchObject({
            historico: null,
            cargando: true,
            desde: "2025-11-01",
            hasta: "2025-11-08",
            producto: {
                id: JSON.stringify(["2", "60"]), especie: "Banana", variedad: "Cavendish",
                pais: "ECUADOR", calibre: "M", categoria: "I",
            },
        });
        expect(fallback.props.error).toBeUndefined();

        const contenido = suspense.props.children;
        const resultadoPendiente = contenido.type(contenido.props);
        expect(obtenerHistoricoPreciosMock).toHaveBeenCalledOnce();
        resolverConsulta(historico);
        const resultado = await resultadoPendiente;
        expect(resultado.props.historico).toBe(historico);
        expect(resultado.props.cargando).toBeUndefined();
    });

    it("reinicia la carga al cambiar el período o los filtros de la selección", async () => {
        const parametros = { classification_id: "2", species_id: "60", from: "2025-11-01", to: "2025-11-08", pais: "ECUADOR" };
        const inicial = await cargarPagina(parametros);
        const otroPeriodo = await cargarPagina({ ...parametros, from: "2025-10-01" });
        const otroFiltro = await cargarPagina({ ...parametros, pais: "BRASIL" });

        expect(otroPeriodo.key).not.toBe(inicial.key);
        expect(otroFiltro.key).not.toBe(inicial.key);
        expect(obtenerHistoricoPreciosMock).not.toHaveBeenCalled();
    });

    it.each([
        {},
        { classification_id: "2", species_id: "-60" },
        { classification_id: "0x2", species_id: "60" },
        { classification_id: ["2", "3"], species_id: "60" },
    ])("no consulta con una selección inválida: %j", async (parametros) => {
        const componente = await cargarPagina(parametros);

        expect(obtenerHistoricoPreciosMock).not.toHaveBeenCalled();
        expect(componente.props.historico).toBeNull();
        expect(componente.props.error).toMatch(/Seleccioná un producto válido/);
        expect(componente.props.cargando).toBeUndefined();
    });

    it.each([
        { from: "2025-02-30", to: "2025-11-08" },
        { from: "2025-11-09", to: "2025-11-08" },
        { from: "2026-10-05", to: "2026-10-06" },
        { from: ["2025-11-01", "2025-11-02"], to: "2025-11-08" },
        { to: "0000-01-01" },
    ])("no consulta con un período inválido: %j", async (fechas) => {
        const componente = await cargarPagina({ classification_id: "2", species_id: "60", ...fechas });

        expect(obtenerHistoricoPreciosMock).not.toHaveBeenCalled();
        expect(componente.props.historico).toBeNull();
        expect(componente.props.error).toMatch(/Revisá el período/);
        expect(componente.props.cargando).toBeUndefined();
    });

    it("muestra temporalmente el nombre y mensaje reales del fallo de carga", async () => {
        const error = new Error("El webservice respondió con HTTP 401.");
        error.name = "ErrorWebservice";
        obtenerHistoricoPreciosMock.mockRejectedValue(error);
        const { componente } = await resolverHistorico({ classification_id: "2", species_id: "60" });

        expect(componente.props.historico).toBeNull();
        expect(componente.props.error).toContain(error.name);
        expect(componente.props.error).toContain(error.message);
    });

    it.each([
        ["HTTP 500: no se pudo obtener el histórico", "HTTP 500: no se pudo obtener el histórico"],
        ["", "Error de carga sin detalle."],
    ])("muestra el rechazo de texto y usa un mensaje de respaldo cuando está vacío: %j", async (rechazo, mensaje) => {
        obtenerHistoricoPreciosMock.mockRejectedValue(rechazo);
        const { componente } = await resolverHistorico({ classification_id: "2", species_id: "60" });

        expect(componente.props.historico).toBeNull();
        expect(componente.props.error).toContain(mensaje);
    });
});
