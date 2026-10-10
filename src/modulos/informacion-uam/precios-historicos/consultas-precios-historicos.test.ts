import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerHistoricoPrecios, obtenerHistoricoPreciosConFiltros } from "./consultas-precios-historicos";
import type { EstadoHistorico } from "./almacen-historicos";
import type { ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto, PresentacionHistorica } from "./tipos";

const { leer, sincronizar } = vi.hoisted(() => ({ leer: vi.fn(), sincronizar: vi.fn() }));
vi.mock("./almacen-historicos", () => ({ leerHistorico: leer }));
vi.mock("./sincronizar-historicos", () => ({ actualizarHistoricosPrecios: sincronizar, inicializarHistoricosPrecios: vi.fn() }));

const consulta: ConsultaHistorica = { speciesId: 60, desde: "2026-10-01", hasta: "2026-10-08" };

function presentacion(variety = "Cavendish", country = "ECUADOR", caliber = "G"): PresentacionHistorica {
    return {
        variety, country, caliber, measure_unit: "KG",
        prices: ["I", "II"].map((category) => ({ category, min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: category === "I" })),
    };
}

function estado(): EstadoHistorico {
    const historico: HistoricoProducto = {
        classification_id: 2, classification: "Exóticos/Importados", species_id: 60, species: "Banana",
        from: "2021-10-09", to: "2026-10-09",
        series: [
            { date: "2021-10-09", presentations: [presentacion("Fuera del período")] },
            { date: "2026-10-01", volume_kg: 1000, presentations: [presentacion(), presentacion("Otra", "URUGUAY", "M")] },
            { date: "2026-10-08", volume_kg: null, presentations: [presentacion()] },
            { date: "2026-10-09", presentations: [presentacion()] },
        ],
    };
    return { version: 2, fuente: "fuente", fechaUltimaActualizacion: "2026-10-09", historico };
}

beforeEach(() => {
    leer.mockReset().mockResolvedValue(estado());
    sincronizar.mockReset().mockResolvedValue({ total: 2, actualizadas: 0, omitidas: 2, errores: [] });
});

describe("consultas del histórico persistido", () => {
    it("comprueba la actualización global antes de leer únicamente la especie solicitada", async () => {
        const orden: string[] = [];
        sincronizar.mockImplementation(async () => { orden.push("sincronizar"); return { errores: [] }; });
        leer.mockImplementation(async () => { orden.push("leer"); return estado(); });
        const recibido = await obtenerHistoricoPrecios(consulta);
        expect(orden).toEqual(["sincronizar", "leer"]);
        expect(leer).toHaveBeenCalledExactlyOnceWith(60);
        expect(recibido.series.map((dia) => dia.date)).toEqual(["2026-10-01", "2026-10-08"]);
        expect(recibido.from).toBe(consulta.desde);
        expect(recibido.to).toBe(consulta.hasta);
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
        await obtenerHistoricoPrecios(consulta, { variedad: "Otra" });
        const siguiente = await obtenerHistoricoPrecios({ ...consulta, desde: "2021-10-09", hasta: "2021-10-09" });
        expect(siguiente.series[0].presentations[0].variety).toBe("Fuera del período");
        expect(guardado).toEqual(original);
        expect(leer.mock.calls).toEqual([[60], [60]]);
    });

    it("conserva datos disponibles si una actualización falla, sin falsear su fecha", async () => {
        const guardado = estado();
        guardado.fechaUltimaActualizacion = "2026-10-08";
        leer.mockResolvedValue(guardado);
        sincronizar.mockResolvedValue({ total: 2, actualizadas: 1, omitidas: 0, errores: [{ speciesId: 60, mensaje: "No se pudo actualizar" }] });
        const recibido = await obtenerHistoricoPrecios(consulta);
        expect(recibido.series).toHaveLength(2);
        expect(guardado.fechaUltimaActualizacion).toBe("2026-10-08");
    });

    it("no mezcla una fuente distinta con los datos guardados", async () => {
        sincronizar.mockResolvedValue({ errores: [{ speciesId: 60, mensaje: "La fuente del histórico cambió." }] });
        await expect(obtenerHistoricoPrecios(consulta)).rejects.toThrow("La fuente");
        expect(leer).not.toHaveBeenCalled();
    });

    it("un error de otra especie no impide consultar la seleccionada", async () => {
        sincronizar.mockResolvedValue({ errores: [{ speciesId: 61, mensaje: "La fuente del histórico cambió." }] });
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toMatchObject({ species_id: 60 });
    });

    it("una especie sin importar requiere la carga administrativa y no se crea desde la consulta pública", async () => {
        leer.mockResolvedValue(null);
        await expect(obtenerHistoricoPrecios(consulta)).rejects.toThrow("administrador todavía no cargó");
    });

    it("rechaza una consulta inválida antes de sincronizar o acceder a la base", async () => {
        await expect(obtenerHistoricoPrecios({ ...consulta, speciesId: 0 })).rejects.toThrow("identificador entero positivo");
        await expect(obtenerHistoricoPrecios({ ...consulta, desde: "2026-02-30" })).rejects.toThrow("fecha real");
        await expect(obtenerHistoricoPrecios({ ...consulta, desde: "2026-10-09" })).rejects.toThrow("posterior");
        expect(sincronizar).not.toHaveBeenCalled();
        expect(leer).not.toHaveBeenCalled();
    });
});
