import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerHistoricoPrecios } from "./consultas-precios-historicos";
import type { ConsultaHistorica } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";

const {
    base, consultar, lecturas, transacciones, bloqueos, creaciones, actualizaciones,
    sembrar, leer, reiniciar,
} = vi.hoisted(() => {
    type Registro = { id: number; nombreConfiguracion: string; valorConfiguracion: string };
    type Filtro = { nombreConfiguracion?: string; id?: number };
    const registros = new Map<string, Registro>();
    let siguienteId = 1;
    let cola: Promise<void> = Promise.resolve();

    const consultar = vi.fn<(
        opciones: { baseUrl: string; token: string }, consulta: ConsultaHistorica,
    ) => Promise<HistoricoProducto>>();
    const lecturas = vi.fn(async (filtro: Filtro): Promise<Registro | null> => {
        const registro = filtro.nombreConfiguracion
            ? registros.get(filtro.nombreConfiguracion)
            : [...registros.values()].find((valor) => valor.id === filtro.id);
        return registro ? { ...registro } : null;
    });
    const creaciones = vi.fn(async (valores: Omit<Registro, "id">) => {
        if (registros.has(valores.nombreConfiguracion)) throw new Error("Registro duplicado en el mock");
        registros.set(valores.nombreConfiguracion, { id: siguienteId++, ...valores });
    });
    const actualizaciones = vi.fn(async (filtro: Filtro, valores: Pick<Registro, "valorConfiguracion">) => {
        const registro = [...registros.values()].find((valor) => valor.id === filtro.id);
        if (!registro) throw new Error("Registro inexistente en el mock");
        registro.valorConfiguracion = valores.valorConfiguracion;
    });
    const tabla = {
        where: (filtro: Filtro) => ({
            first: () => lecturas(filtro),
            update: (valores: Pick<Registro, "valorConfiguracion">) => actualizaciones(filtro, valores),
        }),
        create: creaciones,
    };
    const bloqueos = vi.fn(async () => undefined);
    const tx = { orm: { public: { Configuracion: tabla } }, execute: bloqueos };

    const transacciones = vi.fn(async (trabajo: (transaccion: typeof tx) => Promise<unknown>) => {
        const anterior = cola;
        let liberar!: () => void;
        cola = new Promise<void>((resolve) => { liberar = resolve; });
        await anterior;
        try {
            return await trabajo(tx);
        } finally {
            liberar();
        }
    });

    return {
        base: {
            orm: { public: { Configuracion: tabla } },
            transaction: transacciones,
            raw: { sql: () => ({ returnsRow: () => ({ build: () => ({}) }) }) },
        },
        consultar, lecturas, transacciones, bloqueos, creaciones, actualizaciones,
        sembrar: (nombreConfiguracion: string, valorConfiguracion: string) => {
            registros.set(nombreConfiguracion, { id: siguienteId++, nombreConfiguracion, valorConfiguracion });
        },
        leer: (nombreConfiguracion: string) => registros.get(nombreConfiguracion)?.valorConfiguracion ?? null,
        reiniciar: () => {
            registros.clear();
            siguienteId = 1;
            cola = Promise.resolve();
            consultar.mockReset();
            lecturas.mockClear();
            transacciones.mockClear();
            bloqueos.mockClear();
            creaciones.mockClear();
            actualizaciones.mockClear();
        },
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: base }));
vi.mock("./cliente-webservice", () => ({ consultarHistorico: consultar }));

const baseUrl = "https://precios.example.test/servicio";
const endpoint = "/historicos/{classification_id}/{species_id}?inicio={from}&fin={to}";
const consulta: ConsultaHistorica = {
    classificationId: 2, speciesId: 60, desde: "2025-10-01", hasta: "2025-10-31",
};

function clave(parametros = consulta, fuente = baseUrl): string {
    return "precios-historicos:v1:" + createHash("sha256").update(JSON.stringify([
        fuente, process.env.PRECIOS_HISTORICOS_ENDPOINT?.trim() ?? "", parametros.classificationId, parametros.speciesId, parametros.desde, parametros.hasta,
    ])).digest("hex");
}

function dato(parametros = consulta): HistoricoProducto {
    return {
        classification_id: parametros.classificationId,
        classification: "Exóticos/Importados",
        species_id: parametros.speciesId,
        species: "Banana",
        from: parametros.desde,
        to: parametros.hasta,
        series: [{
            date: parametros.desde,
            volume_kg: 1000,
            presentations: [{
                variety: "Cavendish", caliber: "G", country: "ECUADOR", measure_unit: "KG",
                prices: [{ category: "I", min_kg: 70, max_kg: 75, min_un: 70, max_un: 75, is_reference: true }],
            }],
        }],
    };
}

function serializar(historico: HistoricoProducto): string {
    return JSON.stringify({ version: 1, historico });
}

beforeEach(() => {
    reiniciar();
    vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", baseUrl);
    vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", "token-de-prueba");
    vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", endpoint);
});

afterEach(() => vi.unstubAllEnvs());

describe("obtenerHistoricoPrecios", () => {
    it("devuelve la caché con una sola lectura y sin transacción aunque falte el JWT", async () => {
        const guardado = dato();
        sembrar(clave(), serializar(guardado));
        vi.stubEnv("PRECIOS_REFERENCIA_JWT_TOKEN", undefined);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(guardado);

        expect(lecturas).toHaveBeenCalledOnce();
        expect(transacciones).not.toHaveBeenCalled();
        expect(bloqueos).not.toHaveBeenCalled();
        expect(consultar).not.toHaveBeenCalled();
        expect(creaciones).not.toHaveBeenCalled();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it("guarda la primera respuesta y obtiene la segunda desde la base de datos", async () => {
        const historico = dato();
        consultar.mockResolvedValue(historico);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(historico);
        expect(JSON.parse(leer(clave())!)).toEqual({ version: 1, historico });
        expect(consultar).toHaveBeenCalledWith({ baseUrl, token: "token-de-prueba" }, consulta);
        expect(creaciones).toHaveBeenCalledOnce();
        expect(bloqueos).toHaveBeenCalledOnce();

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(historico);

        expect(lecturas).toHaveBeenCalledTimes(3);
        expect(transacciones).toHaveBeenCalledOnce();
        expect(consultar).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it("guarda y reutiliza los precios de registros sin volumen informado", async () => {
        const sinVolumen = dato();
        delete sinVolumen.series[0].volume_kg;
        consultar.mockResolvedValue(sinVolumen);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(sinVolumen);
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(sinVolumen);

        expect(consultar).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
        const guardado = JSON.parse(leer(clave())!).historico;
        expect(guardado.series[0]).not.toHaveProperty("volume_kg");
        expect(guardado.series[0].presentations).toEqual(sinVolumen.series[0].presentations);
    });

    it.each([
        ["clasificación", { ...consulta, classificationId: 3 }],
        ["producto", { ...consulta, speciesId: 61 }],
        ["fecha desde", { ...consulta, desde: "2025-10-02" }],
        ["fecha hasta", { ...consulta, hasta: "2025-11-01" }],
    ])("mantiene una caché independiente cuando cambia %s", async (_campo, segunda) => {
        consultar.mockImplementation(async (_opciones, parametros) => dato(parametros));

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(dato());
        await expect(obtenerHistoricoPrecios(segunda)).resolves.toEqual(dato(segunda));
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(dato());
        await expect(obtenerHistoricoPrecios(segunda)).resolves.toEqual(dato(segunda));

        expect(consultar).toHaveBeenCalledTimes(2);
        expect(creaciones).toHaveBeenCalledTimes(2);
        expect(JSON.parse(leer(clave())!)).toEqual({ version: 1, historico: dato() });
        expect(JSON.parse(leer(clave(segunda))!)).toEqual({ version: 1, historico: dato(segunda) });
    });

    it("separa los registros de distintas fuentes del webservice", async () => {
        const segundaFuente = "https://otra-fuente.example.test";
        const primero = dato();
        const segundo = dato();
        segundo.series[0].volume_kg = 2000;
        consultar.mockResolvedValueOnce(primero).mockResolvedValueOnce(segundo);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(primero);
        vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", segundaFuente);
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(segundo);

        expect(consultar).toHaveBeenCalledTimes(2);
        expect(JSON.parse(leer(clave())!)).toEqual({ version: 1, historico: primero });
        expect(JSON.parse(leer(clave(consulta, segundaFuente))!)).toEqual({ version: 1, historico: segundo });
    });

    it("reutiliza la misma caché al agregar barras finales a la URL base", async () => {
        const historico = dato();
        consultar.mockResolvedValue(historico);
        vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", baseUrl + "/");
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(historico);

        vi.stubEnv("PRECIOS_REFERENCIA_WEBSERVICE_BASE_URL", baseUrl + "///");
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(historico);

        expect(consultar).toHaveBeenCalledOnce();
        expect(consultar).toHaveBeenCalledWith({ baseUrl, token: "token-de-prueba" }, consulta);
        expect(transacciones).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
    });

    it("consulta nuevamente cuando cambia el endpoint configurado", async () => {
        consultar.mockResolvedValue(dato());
        await obtenerHistoricoPrecios(consulta);
        vi.stubEnv("PRECIOS_HISTORICOS_ENDPOINT", endpoint + "&version=2");
        await obtenerHistoricoPrecios(consulta);
        expect(consultar).toHaveBeenCalledTimes(2);
        expect(creaciones).toHaveBeenCalledTimes(2);
    });

    it.each([
        ["JSON malformado", "{"],
        ["versión desconocida", JSON.stringify({ version: 2, historico: dato() })],
        ["histórico ausente", JSON.stringify({ version: 1 })],
    ])("reemplaza una caché con %s por la respuesta del servicio", async (_motivo, guardado) => {
        sembrar(clave(), guardado);
        const historico = dato();
        consultar.mockResolvedValue(historico);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(historico);
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(historico);

        expect(consultar).toHaveBeenCalledOnce();
        expect(actualizaciones).toHaveBeenCalledOnce();
        expect(creaciones).not.toHaveBeenCalled();
        expect(JSON.parse(leer(clave())!)).toEqual({ version: 1, historico });
    });

    it.each([
        ["producto", { ...consulta, speciesId: 61 }],
        ["clasificación", { ...consulta, classificationId: 3 }],
        ["fecha desde", { ...consulta, desde: "2025-09-30" }],
        ["fecha hasta", { ...consulta, hasta: "2025-11-01" }],
    ])("guarda y reutiliza los datos recibidos aunque difiera %s de la consulta", async (_campo, parametros) => {
        const recibido = dato(parametros);
        consultar.mockResolvedValue(recibido);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toBe(recibido);
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toStrictEqual(recibido);

        expect(JSON.parse(leer(clave())!)).toStrictEqual({ version: 1, historico: recibido });
        expect(leer(clave(parametros))).toBeNull();
        expect(consultar).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it("guarda sin modificar y reutiliza los precios cuyo mínimo supera al máximo por kg y unidad", async () => {
        const recibido = dato();
        Object.assign(recibido.series[0].presentations[0].prices[0], {
            min_kg: 100, max_kg: 75, min_un: 200, max_un: 75,
        });
        const original = JSON.parse(JSON.stringify(recibido)) as HistoricoProducto;
        consultar.mockResolvedValue(recibido);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toBe(recibido);
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toStrictEqual(original);

        expect(recibido).toStrictEqual(original);
        expect(JSON.parse(leer(clave())!)).toStrictEqual({ version: 1, historico: original });
        expect(consultar).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it("permite reintentar un fallo remoto sin guardar una caché del error", async () => {
        consultar.mockRejectedValueOnce(new Error("Servicio no disponible")).mockResolvedValueOnce(dato());

        await expect(obtenerHistoricoPrecios(consulta)).rejects.toThrow("Servicio no disponible");
        expect(leer(clave())).toBeNull();
        expect(creaciones).not.toHaveBeenCalled();

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(dato());
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(dato());

        expect(consultar).toHaveBeenCalledTimes(2);
        expect(transacciones).toHaveBeenCalledTimes(2);
        expect(creaciones).toHaveBeenCalledOnce();
    });

    it.each(["sin días", "sin presentaciones"])("guarda y reutiliza un histórico válido %s", async (caso) => {
        const vacio = dato();
        vacio.series = caso === "sin días" ? [] : [{ date: consulta.desde, volume_kg: 0, presentations: [] }];
        consultar.mockResolvedValue(vacio);

        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(vacio);
        await expect(obtenerHistoricoPrecios(consulta)).resolves.toEqual(vacio);

        expect(consultar).toHaveBeenCalledOnce();
        expect(transacciones).toHaveBeenCalledOnce();
        expect(JSON.parse(leer(clave())!)).toEqual({ version: 1, historico: vacio });
    });

    it("relee bajo el bloqueo y consulta una sola vez ante dos solicitudes simultáneas", async () => {
        let entregar!: (historico: HistoricoProducto) => void;
        let avisarInicio!: () => void;
        const inicio = new Promise<void>((resolve) => { avisarInicio = resolve; });
        consultar.mockImplementationOnce(() => new Promise<HistoricoProducto>((resolve) => {
            entregar = resolve;
            avisarInicio();
        }));

        const primera = obtenerHistoricoPrecios(consulta);
        await inicio;
        const segunda = obtenerHistoricoPrecios(consulta);
        await vi.waitFor(() => expect(transacciones).toHaveBeenCalledTimes(2));
        entregar(dato());

        await expect(Promise.all([primera, segunda])).resolves.toEqual([dato(), dato()]);

        expect(lecturas).toHaveBeenCalledTimes(4);
        expect(bloqueos).toHaveBeenCalledTimes(2);
        expect(consultar).toHaveBeenCalledOnce();
        expect(creaciones).toHaveBeenCalledOnce();
        expect(actualizaciones).not.toHaveBeenCalled();
    });

    it.each([
        ["clasificación inválida", { ...consulta, classificationId: 0 }],
        ["producto no entero", { ...consulta, speciesId: 1.5 }],
        ["fecha inexistente", { ...consulta, desde: "2025-02-30" }],
        ["fecha sin formato ISO", { ...consulta, hasta: "31/10/2025" }],
        ["rango invertido", { ...consulta, desde: "2025-11-01" }],
    ])("rechaza %s antes de leer la base de datos", async (_motivo, parametros) => {
        await expect(obtenerHistoricoPrecios(parametros)).rejects.toThrow();

        expect(lecturas).not.toHaveBeenCalled();
        expect(transacciones).not.toHaveBeenCalled();
        expect(consultar).not.toHaveBeenCalled();
    });
});
