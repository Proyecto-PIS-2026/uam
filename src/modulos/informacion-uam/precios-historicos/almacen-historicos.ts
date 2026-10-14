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

export function conBloqueoActualizacion<T>(
    speciesId: number,
    trabajo: (almacen: AlmacenActualizacion) => Promise<T>,
): Promise<T> {
    return db.transaction(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1725, ${speciesId})`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const especie = await tx.orm.public.Especie.where({ uamId: speciesId }).select("id").first();
        if (!especie) throw new Error("La especie no está registrada en la base de datos.");
        return trabajo({
            leer: () => leerDesde(tx, speciesId),
            guardar: async (estado) => {
                if (estado.historico.species_id !== speciesId) {
                    throw new Error("El histórico no corresponde a la especie bloqueada para la actualización.");
                }
                await guardarEnTransaccion(tx, estado);
            },
        });
    });
}
