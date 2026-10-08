import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerUltimoRelevamientoGuardado } from "../precios-referencia/cache-diario";
import type { ConsultaPreciosReferencia } from "../precios-referencia/consultas-precios-referencia";
import { obtenerCatalogoEspeciesHistoricas } from "./catalogo-especies";

const { listar, leerPorClave, transaccion, consultar } = vi.hoisted(() => ({
    listar: vi.fn<() => Promise<{ nombreConfiguracion: string; valorConfiguracion: string }[]>>(),
    leerPorClave: vi.fn(),
    transaccion: vi.fn(),
    consultar: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Configuracion: { all: listar, where: leerPorClave } } }, transaction: transaccion },
}));
vi.mock("../precios-referencia/cliente-webservice", () => ({ consultarUltimoRelevamiento: consultar }));

type ProductoReferencia = ConsultaPreciosReferencia["types"][number]["products"][number];

function producto(id: number, nombre: string): ProductoReferencia {
    return {
        species_id: id,
        species: nombre,
        varieties: [{
            variety: "-",
            presentations: [{
                caliber: "M", country: "URUGUAY", measure_unit: "KG",
                prices: [{ category: "I", min_kg: 10, max_kg: 20, min_un: 10, max_un: 20, is_reference: true }],
            }],
        }],
    };
}

function dato(fecha = "2026-10-03"): ConsultaPreciosReferencia {
    return {
        survey_date: fecha,
        types: [{
            classification_id: 2,
            classification: "Exóticos/Importados",
            products: [producto(60, "Banana")],
        }],
    };
}

function registro(nombre: string, consulta: ConsultaPreciosReferencia, ultimoExito = consulta.survey_date) {
    return {
        nombreConfiguracion: "precios-referencia:latest:" + nombre,
        valorConfiguracion: JSON.stringify({ version: 1, ultimoIntento: ultimoExito, ultimoExito, consulta }),
    };
}

function esperarSoloLectura() {
    expect(consultar).not.toHaveBeenCalled();
    expect(transaccion).not.toHaveBeenCalled();
    expect(leerPorClave).not.toHaveBeenCalled();
}

beforeEach(() => {
    listar.mockReset().mockResolvedValue([]);
    leerPorClave.mockReset();
    transaccion.mockReset();
    consultar.mockReset();
    vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", "webservice");
    // El catálogo guardado no necesita las credenciales ni la configuración del servicio.
    vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", undefined);
    vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", undefined);
});

afterEach(() => vi.unstubAllEnvs());

describe("obtenerUltimoRelevamientoGuardado", () => {
    it("devuelve el relevamiento válido más reciente sin renovarlo", async () => {
        const reciente = dato();
        listar.mockResolvedValue([
            registro("anterior", dato("2026-10-01")),
            { nombreConfiguracion: "otra-configuracion", valorConfiguracion: "valor" },
            { nombreConfiguracion: "precios-referencia:latest:corrupta", valorConfiguracion: "{" },
            registro("reciente", reciente),
        ]);

        await expect(obtenerUltimoRelevamientoGuardado()).resolves.toEqual(reciente);

        expect(listar).toHaveBeenCalledOnce();
        esperarSoloLectura();
    });

    it("desempata relevamientos del mismo día por la fecha de último éxito", async () => {
        const anterior = dato();
        const reciente = dato();
        reciente.types[0].products[0].species = "Banana actualizada";
        listar.mockResolvedValue([
            registro("primero", anterior, "2026-10-03"),
            registro("segundo", reciente, "2026-10-04"),
        ]);

        await expect(obtenerUltimoRelevamientoGuardado()).resolves.toEqual(reciente);
        esperarSoloLectura();
    });

    it("devuelve null sin llamar al servicio cuando no hay una caché válida", async () => {
        listar.mockResolvedValue([{
            nombreConfiguracion: "precios-referencia:latest:fallo",
            valorConfiguracion: JSON.stringify({ version: 1, ultimoIntento: "2026-10-03", ultimoExito: null, consulta: null }),
        }]);

        await expect(obtenerUltimoRelevamientoGuardado()).resolves.toBeNull();

        expect(listar).toHaveBeenCalledOnce();
        esperarSoloLectura();
    });
});

describe("obtenerCatalogoEspeciesHistoricas", () => {
    it("extrae y ordena especies de la caché y deduplica por especie aunque aparezca en distintas clasificaciones", async () => {
        const consulta = dato();
        consulta.types[0].products.push(producto(60, "Banana"));
        consulta.types.push({
            classification_id: 1, classification: "Hortalizas",
            products: [producto(1, "Zapallo"), producto(2, "Ácelga")],
        });
        consulta.types.push({
            classification_id: 3, classification: "Otra clasificación", products: [producto(60, "Banana")],
        });
        listar.mockResolvedValue([registro("guardada", consulta)]);

        await expect(obtenerCatalogoEspeciesHistoricas()).resolves.toEqual([
            { id: "2", especie: "Ácelga" },
            { id: "60", especie: "Banana" },
            { id: "1", especie: "Zapallo" },
        ]);

        expect(listar).toHaveBeenCalledOnce();
        esperarSoloLectura();
    });

    it.each(["local", undefined])("usa el catálogo local sin leer BD cuando la fuente es %s", async (fuente) => {
        vi.stubEnv("PRECIOS_REFERENCIA_FUENTE", fuente);

        const especies = await obtenerCatalogoEspeciesHistoricas();

        expect(especies.length).toBeGreaterThan(1);
        expect(especies).toContainEqual({ id: "60", especie: "Banana" });
        expect(listar).not.toHaveBeenCalled();
        esperarSoloLectura();
    });

    it("recurre al catálogo local si la caché está vacía sin intentar el webservice", async () => {
        const especies = await obtenerCatalogoEspeciesHistoricas();

        expect(especies.length).toBeGreaterThan(1);
        expect(especies).toContainEqual({ id: "60", especie: "Banana" });
        expect(listar).toHaveBeenCalledOnce();
        esperarSoloLectura();
    });

    it("recurre al catálogo local si falla la lectura de BD sin intentar el webservice", async () => {
        listar.mockRejectedValue(new Error("Base de datos no disponible"));

        const especies = await obtenerCatalogoEspeciesHistoricas();

        expect(especies.length).toBeGreaterThan(1);
        expect(especies).toContainEqual({ id: "60", especie: "Banana" });
        expect(listar).toHaveBeenCalledOnce();
        esperarSoloLectura();
    });
});
