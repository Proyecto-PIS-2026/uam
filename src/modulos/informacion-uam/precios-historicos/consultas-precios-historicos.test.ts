import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerHistoricoPreciosConFiltros } from "./consultas-precios-historicos";
import type { EstadoHistorico } from "./almacen-historicos";
import type { ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto, PresentacionHistorica } from "./tipos";

const { leer, actualizarEspecie } = vi.hoisted(() => ({ leer: vi.fn(), actualizarEspecie: vi.fn() }));
vi.mock("./almacen-historicos", () => ({ leerHistorico: leer }));
vi.mock("./sincronizar-historicos", () => ({ actualizarHistoricoEspecie: actualizarEspecie }));

const consulta: ConsultaHistorica = { speciesId: 60, desde: "2026-10-01", hasta: "2026-10-08" };

function presentacion(variety = "Cavendish", country = "ECUADOR", caliber = "G"): PresentacionHistorica {
    return {
        variety, country, caliber, measure_unit: "KG",
        prices: ["I", "II"].map((category) => ({ category, min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: category === "I" })),
    };
}

function estado(speciesId = 60): EstadoHistorico {
    const historico: HistoricoProducto = {
        classification_id: 2, classification: "Exóticos/Importados", species_id: speciesId, species: speciesId === 60 ? "Banana" : "Manzana",
        from: "2021-10-09", to: "2026-10-09",
        series: [
            { date: "2021-10-09", presentations: [presentacion("Fuera del período")] },
            { date: "2026-10-01", volume_kg: 1000, presentations: [presentacion(), presentacion("Otra", "URUGUAY", "M")] },
            { date: "2026-10-08", volume_kg: null, presentations: [presentacion()] },
            { date: "2026-10-09", presentations: [presentacion()] },
        ],
    };
    return { fechaUltimaActualizacion: "2026-10-09", historico };
}

beforeEach(() => {
    leer.mockReset().mockResolvedValue(estado());
    actualizarEspecie.mockReset().mockResolvedValue(undefined);
});

describe("consultas del histórico persistido", () => {
    it("actualiza únicamente la especie solicitada antes de leer sus datos", async () => {
        const orden: string[] = [];
        actualizarEspecie.mockImplementation(async () => { orden.push("actualizar"); });
        leer.mockImplementation(async () => { orden.push("leer"); return estado(); });
        const { historico: recibido } = await obtenerHistoricoPreciosConFiltros(consulta);
        expect(orden).toEqual(["actualizar", "leer"]);
        expect(actualizarEspecie).toHaveBeenCalledExactlyOnceWith(60);
        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
        expect(recibido.series.map((dia) => dia.date)).toEqual(["2026-10-01", "2026-10-08"]);
        expect(recibido.from).toBe(consulta.desde);
        expect(recibido.to).toBe(consulta.hasta);
    });

    it("espera a que termine la actualización de la especie antes de leer el histórico", async () => {
        let completarActualizacion!: () => void;
        actualizarEspecie.mockReturnValue(new Promise<void>((resolve) => { completarActualizacion = resolve; }));

        const pendiente = obtenerHistoricoPreciosConFiltros(consulta);

        await vi.waitFor(() => expect(actualizarEspecie).toHaveBeenCalledExactlyOnceWith(60));
        expect(leer).not.toHaveBeenCalled();
        completarActualizacion();
        await expect(pendiente).resolves.toMatchObject({ historico: { species_id: 60 } });
        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
    });

    it("responde por una especie sin esperar una consulta pendiente de otra especie", async () => {
        let completarOtraEspecie!: () => void;
        const otraActualizacion = new Promise<void>((resolve) => { completarOtraEspecie = resolve; });
        actualizarEspecie.mockImplementation(async (speciesId: number) => {
            if (speciesId === 61) await otraActualizacion;
        });
        leer.mockImplementation(async (speciesId: number) => estado(speciesId));
        const otraConsulta = obtenerHistoricoPreciosConFiltros({ ...consulta, speciesId: 61 });

        await expect(obtenerHistoricoPreciosConFiltros(consulta)).resolves.toMatchObject({ historico: { species_id: 60 } });

        expect(actualizarEspecie.mock.calls).toEqual([[61], [60]]);
        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
        completarOtraEspecie();
        await expect(otraConsulta).resolves.toMatchObject({ historico: { species_id: 61 } });
    });

    it("filtra todos los atributos en backend y conserva las facetas del período completo", async () => {
        const recibido = await obtenerHistoricoPreciosConFiltros(consulta, { variedad: "Otra", pais: "URUGUAY", calibre: "M", categoria: "II" });
        expect(recibido.historico.series).toEqual([{
            date: "2026-10-01", volume_kg: 1000,
            presentations: [{ ...presentacion("Otra", "URUGUAY", "M"), prices: [presentacion().prices[1]] }],
        }]);
        expect(recibido.opcionesFiltros).toEqual({ variedades: ["Cavendish", "Otra"], paises: ["ECUADOR", "URUGUAY"], calibres: ["G", "M"], categorias: ["I", "II"] });
    });

    it("distintos rangos reutilizan el mismo registro sin modificar el histórico acumulado", async () => {
        const guardado = estado();
        const original = structuredClone(guardado);
        leer.mockResolvedValue(guardado);
        await obtenerHistoricoPreciosConFiltros(consulta, { variedad: "Otra" });
        const { historico: siguiente } = await obtenerHistoricoPreciosConFiltros({ ...consulta, desde: "2021-10-09", hasta: "2021-10-09" });
        expect(siguiente.series[0].presentations[0].variety).toBe("Fuera del período");
        expect(guardado).toEqual(original);
        expect(leer.mock.calls).toEqual([[60], [60]]);
    });

    it("devuelve solamente la intersección disponible cuando el rango solicitado empieza antes de la cobertura guardada", async () => {
        const guardado = estado();
        guardado.historico.from = "2023-01-01";
        guardado.historico.series = [
            { date: "2023-01-02", presentations: [presentacion("Anterior", "URUGUAY", "P")] },
            ...guardado.historico.series.slice(1),
        ];
        const original = structuredClone(guardado);
        leer.mockResolvedValue(guardado);
        const periodoSolicitado = { ...consulta, desde: "2022-01-01", hasta: "2026-10-14" };

        const recibido = await obtenerHistoricoPreciosConFiltros(periodoSolicitado);

        expect(recibido.historico.from).toBe("2023-01-01");
        expect(recibido.historico.to).toBe("2026-10-09");
        expect(recibido.historico.series).toStrictEqual(original.historico.series);
        expect(recibido.opcionesFiltros).toEqual({
            variedades: ["Anterior", "Cavendish", "Otra"], paises: ["ECUADOR", "URUGUAY"],
            calibres: ["G", "M", "P"], categorias: ["I", "II"],
        });
        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
        expect(actualizarEspecie).toHaveBeenCalledOnce();
        expect(guardado).toStrictEqual(original);
    });

    it("devuelve un resultado vacío sin fallar cuando todo el rango solicitado es anterior a la cobertura guardada", async () => {
        const guardado = estado();
        guardado.historico.from = "2023-01-01";
        guardado.historico.series = guardado.historico.series.slice(1);
        const original = structuredClone(guardado);
        leer.mockResolvedValue(guardado);
        const periodoSolicitado = { ...consulta, desde: "2019-01-01", hasta: "2022-12-31" };

        await expect(obtenerHistoricoPreciosConFiltros(periodoSolicitado)).resolves.toEqual({
            historico: {
                ...original.historico, from: periodoSolicitado.desde, to: periodoSolicitado.hasta, series: [],
            },
            opcionesFiltros: { variedades: [], paises: [], calibres: [], categorias: [] },
        });

        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
        expect(actualizarEspecie).toHaveBeenCalledOnce();
        expect(guardado).toStrictEqual(original);
    });

    it("conserva datos disponibles si una actualización falla, sin falsear su fecha", async () => {
        const guardado = estado();
        guardado.fechaUltimaActualizacion = "2026-10-08";
        leer.mockResolvedValue(guardado);
        const { historico: recibido } = await obtenerHistoricoPreciosConFiltros(consulta);
        expect(recibido.series).toHaveLength(2);
        expect(guardado.fechaUltimaActualizacion).toBe("2026-10-08");
    });

    it("dos consultas de especies diferentes actualizan solamente sus respectivos identificadores", async () => {
        leer.mockImplementation(async (speciesId: number) => estado(speciesId));

        const resultados = await Promise.all([
            obtenerHistoricoPreciosConFiltros(consulta),
            obtenerHistoricoPreciosConFiltros({ ...consulta, speciesId: 61 }),
        ]);

        expect(actualizarEspecie.mock.calls).toEqual([[60], [61]]);
        expect(leer.mock.calls).toEqual([[60], [61]]);
        expect(resultados.map((resultado) => resultado.historico.species_id)).toEqual([60, 61]);
    });

    it("informa que no hay un histórico disponible si la carga automática no pudo crear el registro", async () => {
        leer.mockResolvedValue(null);
        await expect(obtenerHistoricoPreciosConFiltros(consulta)).rejects.toThrow("No se pudo obtener el histórico de esta especie");
        expect(actualizarEspecie).toHaveBeenCalledExactlyOnceWith(60);
        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
    });

    it.each([
        { nombre: "Ñ", precios: { min_kg: "Ñ", max_kg: 75, min_un: "Ñ", max_un: 75 }, volumen: "Ñ" },
        { nombre: "nulos", precios: { min_kg: null, max_kg: null, min_un: null, max_un: null }, volumen: null },
        { nombre: "mínimos mayores al máximo", precios: { min_kg: 100, max_kg: 75, min_un: 200, max_un: 75 }, volumen: 1000 },
        { nombre: "negativos", precios: { min_kg: -10, max_kg: -5, min_un: -20, max_un: -15 }, volumen: -1 },
        { nombre: "texto numérico", precios: { min_kg: "0010.50", max_kg: "20.00", min_un: "10", max_un: "20" }, volumen: "001.25" },
    ])("conserva íntegros los datos de $nombre al consultar y filtrar el histórico en backend", async ({ precios, volumen }) => {
        const guardado = estado();
        const dia = guardado.historico.series[1];
        guardado.historico.series = [{ ...dia, presentations: [dia.presentations[0]] }];
        Object.assign(guardado.historico.series[0], { volume_kg: volumen });
        Object.assign(guardado.historico.series[0].presentations[0].prices[0], precios);
        const original = structuredClone(guardado);
        leer.mockResolvedValue(guardado);

        const { historico: primero } = await obtenerHistoricoPreciosConFiltros(consulta);
        const filtrado = await obtenerHistoricoPreciosConFiltros(consulta, {
            variedad: "Cavendish", pais: "ECUADOR", calibre: "G", categoria: "I",
        });

        expect(primero).toStrictEqual({ ...original.historico, from: consulta.desde, to: consulta.hasta });
        expect(filtrado.historico.series[0].presentations[0].prices)
            .toStrictEqual([original.historico.series[0].presentations[0].prices[0]]);
        expect(filtrado.historico.series[0].volume_kg).toBe(volumen);
        expect(filtrado.opcionesFiltros.categorias).toEqual(["I", "II"]);
        expect(leer.mock.calls).toEqual([[60], [60]]);
        expect(guardado).toStrictEqual(original);
    });

    it.each([null, false, { fecha: "2026-10-01" }, [2026, 10, 1]])
        ("conserva la fecha inesperada %j al filtrar el período, sin incluir otras fechas ISO fuera del rango", async (fecha) => {
            const guardado = estado();
            Object.assign(guardado.historico.series[1], { date: fecha });
            const original = structuredClone(guardado);
            leer.mockResolvedValue(guardado);

            const { historico: recibido } = await obtenerHistoricoPreciosConFiltros(consulta);

            expect(recibido.series).toStrictEqual([original.historico.series[1], original.historico.series[2]]);
            expect(guardado).toStrictEqual(original);
        });

    it("ofrece facetas de atributos JSON y permite filtrarlos por el mismo texto sin cambiar sus valores", async () => {
        const guardado = estado();
        const especial = presentacion();
        const variedad = { nombre: "Especial", detalles: ["Ñ", null] };
        const pais = ["URUGUAY", false];
        const categoria = { nombre: "Primera" };
        Object.assign(especial, { variety: variedad, country: pais, caliber: false, measure_unit: null });
        Object.assign(especial.prices[0], {
            category: categoria, min_kg: { precio: 10 }, max_kg: [75, "Ñ"],
            min_un: false, max_un: null, is_reference: { publicado: true },
        });
        Object.assign(especial.prices[1], { category: null, is_reference: [true] });
        guardado.historico.series = [{ ...guardado.historico.series[1], presentations: [especial] }];
        Object.assign(guardado.historico.series[0], { volume_kg: { cantidad: 1000 } });
        const original = structuredClone(guardado);
        leer.mockResolvedValue(guardado);
        const filtros = {
            variedad: JSON.stringify(variedad), pais: JSON.stringify(pais), calibre: "false",
        };

        const recibido = await obtenerHistoricoPreciosConFiltros(consulta, {
            ...filtros, categoria: JSON.stringify(categoria),
        });
        const { historico: sinCategoria } = await obtenerHistoricoPreciosConFiltros(consulta, { ...filtros, categoria: "—" });

        expect(recibido.opcionesFiltros.variedades).toEqual([JSON.stringify(variedad)]);
        expect(recibido.opcionesFiltros.paises).toEqual([JSON.stringify(pais)]);
        expect(recibido.opcionesFiltros.calibres).toEqual(["false"]);
        expect(recibido.opcionesFiltros.categorias).toEqual(expect.arrayContaining([JSON.stringify(categoria), "—"]));
        expect(recibido.opcionesFiltros.categorias).toHaveLength(2);
        expect(recibido.historico.series[0]).toStrictEqual({
            ...original.historico.series[0],
            presentations: [{ ...original.historico.series[0].presentations[0], prices: [original.historico.series[0].presentations[0].prices[0]] }],
        });
        expect(sinCategoria.series[0].presentations[0].prices)
            .toStrictEqual([original.historico.series[0].presentations[0].prices[1]]);
        expect(guardado).toStrictEqual(original);
    });

    it("rechaza una consulta inválida antes de actualizar la especie o acceder a la base", async () => {
        await expect(obtenerHistoricoPreciosConFiltros({ ...consulta, speciesId: 0 })).rejects.toThrow("identificador entero positivo");
        await expect(obtenerHistoricoPreciosConFiltros({ ...consulta, desde: "2026-02-30" })).rejects.toThrow("fecha real");
        await expect(obtenerHistoricoPreciosConFiltros({ ...consulta, desde: "2026-10-09" })).rejects.toThrow("posterior");
        expect(actualizarEspecie).not.toHaveBeenCalled();
        expect(leer).not.toHaveBeenCalled();
    });
});
