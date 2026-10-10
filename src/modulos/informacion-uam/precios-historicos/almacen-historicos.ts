import { db } from "@/infraestructura/persistencia/prisma/db";
import { esFechaISO } from "./parametros-consulta";
import type { HistoricoProducto } from "./tipos";
import { fusionarHistoricos } from "./transformar-historico";
import { validarHistoricoProducto } from "./validar-historico";

const PREFIJO_HISTORICOS = "precios-historicos:v2:especie:";
const CLAVE_SINCRONIZACION = "precios-historicos:v2:sincronizacion";

export type EstadoHistorico = {
    version: 2;
    fuente: string;
    fechaUltimaActualizacion: string;
    historico: HistoricoProducto;
};

export function nombreHistorico(speciesId: number): string {
    return `${PREFIJO_HISTORICOS}${speciesId}`;
}

function deserializar(valor: string, speciesId: number): EstadoHistorico {
    const estado: unknown = JSON.parse(valor);
    if (!estado || typeof estado !== "object" || !("version" in estado) || estado.version !== 2
        || !("fuente" in estado) || typeof estado.fuente !== "string"
        || !("fechaUltimaActualizacion" in estado) || !esFechaISO(estado.fechaUltimaActualizacion)
        || !("historico" in estado)) {
        throw new Error(`El histórico guardado de la especie ${speciesId} no es válido.`);
    }
    const historico = validarHistoricoProducto(estado.historico);
    if (historico.species_id !== speciesId) {
        throw new Error(`El histórico guardado no corresponde a la especie ${speciesId}.`);
    }
    return { version: 2, fuente: estado.fuente, fechaUltimaActualizacion: estado.fechaUltimaActualizacion, historico };
}

export async function leerHistorico(speciesId: number): Promise<EstadoHistorico | null> {
    const registro = await db.orm.public.Configuracion.where({ nombreConfiguracion: nombreHistorico(speciesId) }).first();
    return registro ? deserializar(registro.valorConfiguracion, speciesId) : null;
}

export async function listarEspeciesGuardadas(): Promise<number[]> {
    const registros = await db.orm.public.Configuracion
        .where((configuracion) => configuracion.nombreConfiguracion.like(`${PREFIJO_HISTORICOS}%`))
        .select("nombreConfiguracion")
        .all();
    return registros.map(({ nombreConfiguracion }) => Number(nombreConfiguracion.slice(PREFIJO_HISTORICOS.length)))
        .filter((id) => Number.isSafeInteger(id) && id > 0);
}

export async function sincronizacionCompletada(hoy: string, fuente: string): Promise<boolean> {
    const registro = await db.orm.public.Configuracion.where({ nombreConfiguracion: CLAVE_SINCRONIZACION }).first();
    if (!registro) return false;
    try {
        const estado = JSON.parse(registro.valorConfiguracion);
        return estado.version === 2 && estado.fuente === fuente && estado.fechaUltimaActualizacion === hoy;
    } catch { return false; }
}

export async function registrarSincronizacion(hoy: string, fuente: string): Promise<void> {
    await db.transaction(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1724, 0)`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion: CLAVE_SINCRONIZACION }).first();
        const valorConfiguracion = JSON.stringify({ version: 2, fuente, fechaUltimaActualizacion: hoy });
        if (registro) await tx.orm.public.Configuracion.where({ id: registro.id }).update({ valorConfiguracion });
        else await tx.orm.public.Configuracion.create({ nombreConfiguracion: CLAVE_SINCRONIZACION, valorConfiguracion });
    });
}

export async function guardarHistorico(estado: EstadoHistorico): Promise<void> {
    const speciesId = estado.historico.species_id;
    const nombreConfiguracion = nombreHistorico(speciesId);
    await db.transaction(async (tx) => {
        await tx.execute(db.raw.sql`SELECT 1::int AS locked FROM pg_advisory_xact_lock(1724, ${speciesId})`
            .returnsRow({ locked: "pg/int4@1" }).build());
        const registro = await tx.orm.public.Configuracion.where({ nombreConfiguracion }).first();
        let siguiente = {
            ...estado,
            historico: fusionarHistoricos({ ...estado.historico, series: [] }, estado.historico),
        };
        if (registro) {
            const actual = deserializar(registro.valorConfiguracion, speciesId);
            if (actual.fuente !== estado.fuente) throw new Error("La fuente del histórico cambió. Revisá la configuración antes de importar.");
            siguiente = {
                ...estado,
                historico: fusionarHistoricos(actual.historico, estado.historico),
                fechaUltimaActualizacion: actual.fechaUltimaActualizacion > estado.fechaUltimaActualizacion
                    ? actual.fechaUltimaActualizacion : estado.fechaUltimaActualizacion,
            };
        }
        const valorConfiguracion = JSON.stringify(siguiente);
        if (registro) {
            if (valorConfiguracion !== registro.valorConfiguracion) {
                await tx.orm.public.Configuracion.where({ id: registro.id }).update({ valorConfiguracion });
            }
        } else {
            await tx.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
        }
    });
}

export async function limpiarCacheAnterior(): Promise<void> {
    await db.orm.public.Configuracion
        .where((configuracion) => configuracion.nombreConfiguracion.like("precios-historicos:v1:%"))
        .deleteAll();
}
