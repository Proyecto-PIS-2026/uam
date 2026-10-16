import { createHash, randomUUID } from "node:crypto";
import { db } from "./prisma/db";

type Transaccion = Parameters<Parameters<typeof db.transaction>[0]>[0];
type GuardarConsulta = <T>(guardar: (tx: Transaccion) => Promise<T>) => Promise<T>;

const DURACION_RESERVA_SEGUNDOS = 180;
const INTERVALO_ESPERA_MS = 500;
const ESPERA_MAXIMA_MS = 240_000;
const pendientes = new Map<string, Promise<unknown>>();

class ReservaVencidaError extends Error {
    constructor() {
        super("La reserva de la consulta venció. Volvé a intentar.");
    }
}

async function reservar(nombre: string, propietario: string): Promise<boolean> {
    const plan = db.raw.sql`
        INSERT INTO configuracion ("nombreConfiguracion", "valorConfiguracion")
        VALUES (${nombre}, jsonb_build_object(
            'propietario', ${propietario}::text,
            'vence', extract(epoch FROM clock_timestamp()) + ${DURACION_RESERVA_SEGUNDOS}::int
        )::text)
        ON CONFLICT ("nombreConfiguracion") DO UPDATE
        SET "valorConfiguracion" = EXCLUDED."valorConfiguracion"
        WHERE (configuracion."valorConfiguracion"::jsonb->>'vence')::numeric < extract(epoch FROM clock_timestamp())
        RETURNING id
    `.returnsRow({ id: "pg/int4@1" }).build();
    return (await db.runtime().query(plan)).length > 0;
}

async function liberar(nombre: string, propietario: string): Promise<void> {
    const plan = db.raw.sql`
        DELETE FROM configuracion
        WHERE "nombreConfiguracion" = ${nombre}
          AND "valorConfiguracion"::jsonb->>'propietario' = ${propietario}
        RETURNING id
    `.returnsRow({ id: "pg/int4@1" }).build();
    await db.runtime().query(plan);
}

async function ejecutarConReserva<T>(clave: string, consultar: (guardar: GuardarConsulta) => Promise<T>): Promise<T> {
    const nombre = `consulta-en-curso:${createHash("sha256").update(clave).digest("hex")}`;
    const propietario = randomUUID();
    const limiteEspera = Date.now() + ESPERA_MAXIMA_MS;
    while (true) {
        while (!await reservar(nombre, propietario)) {
            if (Date.now() >= limiteEspera) throw new Error("La consulta sigue en curso. Volvé a intentar en unos instantes.");
            await new Promise<void>((resolve) => setTimeout(resolve, INTERVALO_ESPERA_MS));
        }

        try {
            return await consultar(async (guardar) => db.transaction(async (tx) => {
                await tx.execute(db.raw.sql`
                    SELECT id FROM configuracion WHERE "nombreConfiguracion" = ${nombre} FOR UPDATE
                `.returnsRow({ id: "pg/int4@1" }).build());
                const reserva = await tx.orm.public.Configuracion.where({ nombreConfiguracion: nombre }).first();
                if (!reserva || JSON.parse(reserva.valorConfiguracion).propietario !== propietario) {
                    throw new ReservaVencidaError();
                }
                return guardar(tx);
            }));
        } catch (error) {
            if (!(error instanceof ReservaVencidaError) || Date.now() >= limiteEspera) throw error;
        } finally {
            await liberar(nombre, propietario);
        }
    }
}

export function ejecutarConsultaExclusiva<T>(clave: string, consultar: (guardar: GuardarConsulta) => Promise<T>): Promise<T> {
    const anterior = pendientes.get(clave) ?? Promise.resolve();
    const resultado = anterior.catch(() => undefined).then(() => ejecutarConReserva(clave, consultar));
    const final = resultado.finally(() => {
        if (pendientes.get(clave) === final) pendientes.delete(clave);
    });
    pendientes.set(clave, final);
    return final;
}
