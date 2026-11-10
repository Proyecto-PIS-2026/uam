import { randomUUID } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { Temporal } from "temporal-polyfill";
import { db } from "@/infraestructura/persistencia/prisma/db";
import type { HistoricoProducto } from "./tipos";
import { fusionarHistoricos } from "./transformar-historico";
import { validarHistoricoProducto } from "./validar-historico";

export type EstadoHistorico = {
    fechaUltimaActualizacion: string;
    historico: HistoricoProducto;
};

type JsonHistorico = Parameters<typeof db.orm.public.HistoricoPrecios.create>[0]["historico"];
type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];
type AlmacenActualizacion = {
    leer(): Promise<EstadoHistorico | null>;
    guardar(estado: EstadoHistorico): Promise<void>;
};
type RegistroGuardado = {
    historico: unknown;
    fechaDesde: Temporal.PlainDate;
    fechaHasta: Temporal.PlainDate;
    fechaUltimaActualizacion: Temporal.PlainDate;
};
type ReservaActualizacion = { token: string; venceEn: number };

const DURACION_RESERVA_MS = 6 * 60_000;
const ESPERA_MAXIMA_MS = DURACION_RESERVA_MS + 20_000;
const INTERVALO_ESPERA_MS = 1_000;

function claveReserva(speciesId: number): string {
    return `precios-historicos:actualizacion:${speciesId}`;
}

function leerReserva(valor: string | undefined): ReservaActualizacion | null {
    if (!valor) return null;
    try {
        const reserva: unknown = JSON.parse(valor);
        if (reserva === null || typeof reserva !== "object"
            || !("token" in reserva) || typeof reserva.token !== "string"
            || !("venceEn" in reserva) || typeof reserva.venceEn !== "number"
            || !Number.isFinite(reserva.venceEn)) return null;
        return { token: reserva.token, venceEn: reserva.venceEn };
    } catch {
        return null;
    }
}

async function bloquearEspecie(tx: Transaccion, speciesId: number): Promise<void> {
    await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1725, ${speciesId})`
        .returnsRow({ locked: "pg/int4@1" }).build());
}

async function ahoraEnBase(tx: Transaccion): Promise<number> {
    const [fila] = await tx.query(db.raw.sql`SELECT (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::float8 AS ahora`
        .returnsRow({ ahora: "pg/float8@1" }).build());
    if (!fila || !Number.isFinite(fila.ahora)) throw new Error("No se pudo obtener la fecha de la base de datos.");
    return fila.ahora;
}

function intentarReservar(speciesId: number, token: string): Promise<boolean> {
    return db.transaction(async (tx) => {
        await bloquearEspecie(tx, speciesId);
        const especie = await tx.orm.public.Especie.where({ uamId: speciesId }).select("id").first();
        if (!especie) throw new Error("La especie no está registrada en la base de datos.");
        const nombreConfiguracion = claveReserva(speciesId);
        const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion }).first();
        const ahora = await ahoraEnBase(tx);
        const reserva = leerReserva(registro?.valorConfiguracion);
        if (reserva && reserva.venceEn > ahora) return false;
        const valorConfiguracion = JSON.stringify({ token, venceEn: ahora + DURACION_RESERVA_MS });
        if (registro) {
            await tx.orm.public.Configuracion.where({ nombreConfiguracion }).update({ valorConfiguracion });
        } else {
            await tx.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
        }
        return true;
    });
}

function liberarReserva(speciesId: number, token: string): Promise<void> {
    return db.transaction(async (tx) => {
        await bloquearEspecie(tx, speciesId);
        const nombreConfiguracion = claveReserva(speciesId);
        const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion }).first();
        if (leerReserva(registro?.valorConfiguracion)?.token === token) {
            await tx.orm.public.Configuracion.where({ nombreConfiguracion }).delete();
        }
    });
}

function leerEstado(registro: RegistroGuardado, speciesId: number): EstadoHistorico {
    const historico = validarHistoricoProducto(registro.historico);
    if (historico.species_id !== speciesId) {
        throw new Error(`El histórico guardado no corresponde a la especie ${speciesId}.`);
    }
    return {
        fechaUltimaActualizacion: registro.fechaUltimaActualizacion.toString(),
        historico: { ...historico, from: registro.fechaDesde.toString(), to: registro.fechaHasta.toString() },
    };
}

async function leerDesde(almacen: Pick<Transaccion, "orm">, speciesId: number): Promise<EstadoHistorico | null> {
    const especie = await almacen.orm.public.Especie.where({ uamId: speciesId }).select("id").first();
    if (!especie) return null;
    const registro = await almacen.orm.public.HistoricoPrecios.where({ especieId: especie.id }).first();
    return registro ? leerEstado(registro, speciesId) : null;
}

export function leerHistorico(speciesId: number): Promise<EstadoHistorico | null> {
    return leerDesde(db, speciesId);
}

async function guardarEnTransaccion(tx: Transaccion, estado: EstadoHistorico): Promise<void> {
    const speciesId = estado.historico.species_id;
    const especie = await tx.orm.public.Especie.where({ uamId: speciesId }).select("id").first();
    if (!especie) throw new Error("La especie no está registrada en la base de datos.");
    const especieId = especie.id;
    const registro = await tx.orm.public.HistoricoPrecios.where({ especieId }).first();
    const actual = registro ? leerEstado(registro, speciesId) : null;
    let siguiente = {
        ...estado,
        historico: fusionarHistoricos({ ...estado.historico, series: [] }, estado.historico),
    };
    if (actual) {
        siguiente = {
            historico: fusionarHistoricos(actual.historico, estado.historico),
            fechaUltimaActualizacion: actual.fechaUltimaActualizacion > estado.fechaUltimaActualizacion
                ? actual.fechaUltimaActualizacion : estado.fechaUltimaActualizacion,
        };
    }
    const valores = {
        historico: siguiente.historico as JsonHistorico,
        fechaDesde: Temporal.PlainDate.from(siguiente.historico.from),
        fechaHasta: Temporal.PlainDate.from(siguiente.historico.to),
        fechaUltimaActualizacion: Temporal.PlainDate.from(siguiente.fechaUltimaActualizacion),
    };
    if (registro) {
        if (!isDeepStrictEqual(siguiente, actual)) {
            await tx.orm.public.HistoricoPrecios.where({ especieId }).update(valores);
        }
    } else {
        await tx.orm.public.HistoricoPrecios.create({ especieId, ...valores });
    }
}

export async function conBloqueoActualizacion<T>(
    speciesId: number,
    trabajo: (almacen: AlmacenActualizacion) => Promise<T>,
): Promise<T> {
    const token = randomUUID();
    const limiteEspera = Date.now() + ESPERA_MAXIMA_MS;
    while (!await intentarReservar(speciesId, token)) {
        const restante = limiteEspera - Date.now();
        if (restante <= 0) throw new Error("Otra solicitud sigue actualizando el histórico. Podés volver a intentar.");
        await new Promise<void>((resolve) => setTimeout(resolve, Math.min(INTERVALO_ESPERA_MS, restante)));
    }
    try {
        return await trabajo({
            leer: () => leerDesde(db, speciesId),
            guardar: async (estado) => {
                if (estado.historico.species_id !== speciesId) {
                    throw new Error("El histórico no corresponde a la especie bloqueada para la actualización.");
                }
                await db.transaction(async (tx) => {
                    await bloquearEspecie(tx, speciesId);
                    const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion: claveReserva(speciesId) }).first();
                    const reserva = leerReserva(registro?.valorConfiguracion);
                    const ahora = await ahoraEnBase(tx);
                    if (reserva?.token !== token || reserva.venceEn <= ahora) {
                        throw new Error("La reserva para actualizar el histórico venció o fue reemplazada.");
                    }
                    await guardarEnTransaccion(tx, estado);
                });
            },
        });
    } finally {
        await liberarReserva(speciesId, token).catch(() => undefined);
    }
}
