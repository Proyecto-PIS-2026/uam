import { db } from "../persistencia/prisma/db";
import { ZONA_HORARIA_TAREAS, type ResultadoTareaDiaria, type TareaDiaria } from "./tipos";

async function ejecutarTarea(tarea: TareaDiaria): Promise<ResultadoTareaDiaria> {
    if (tarea.habilitada && !await tarea.habilitada()) return { nombre: tarea.nombre, estado: "deshabilitada" };
    return db.transaction(async (tx): Promise<ResultadoTareaDiaria> => {
        await tx.execute(db.raw.sql`
            SELECT set_config('lock_timeout', '5s', true) AS bloqueo,
                   set_config('statement_timeout', '60s', true) AS consulta
        `.returnsRow({ bloqueo: "pg/text@1", consulta: "pg/text@1" }).build());

        const [reserva] = await tx.query(db.raw.sql`
            SELECT pg_try_advisory_xact_lock(1730, hashtext(${tarea.nombre}::text)) AS adquirida
        `.returnsRow({ adquirida: "pg/bool@1" }).build());
        if (!reserva?.adquirida) return { nombre: tarea.nombre, estado: "ocupada" };

        const [dia] = await tx.query(db.raw.sql`
            SELECT to_char(ahora AT TIME ZONE ${ZONA_HORARIA_TAREAS}, 'YYYY-MM-DD') AS fecha,
                   ahora AS limite
            FROM (SELECT clock_timestamp() AS ahora) instante
        `.returnsRow({ fecha: "pg/text@1", limite: "pg/timestamptz-temporal@1" }).build());
        if (!dia) throw new Error("No se pudo determinar la fecha de ejecución.");

        const [anterior] = await tx.query(db.raw.sql`
            SELECT nombre FROM "ejecucionTareaProgramada"
            WHERE nombre = ${tarea.nombre} AND fecha >= ${dia.fecha}::date
        `.returnsRow({ nombre: "pg/text@1" }).build());
        if (anterior) return { nombre: tarea.nombre, estado: "ya-completada", fecha: dia.fecha };

        const elementosProcesados = await tarea.ejecutar({ tx, fecha: dia.fecha, limite: dia.limite.toString() });
        if (!Number.isSafeInteger(elementosProcesados) || elementosProcesados < 0 || elementosProcesados > 2147483647) {
            throw new Error("La tarea devolvió una cantidad de elementos inválida.");
        }

        await tx.execute(db.raw.sql`
            INSERT INTO "ejecucionTareaProgramada" (nombre, fecha, "completadaEn", "elementosProcesados")
            VALUES (${tarea.nombre}, ${dia.fecha}::date, clock_timestamp(), ${elementosProcesados}::int)
            ON CONFLICT (nombre) DO UPDATE
            SET fecha = EXCLUDED.fecha, "completadaEn" = EXCLUDED."completadaEn",
                "elementosProcesados" = EXCLUDED."elementosProcesados"
            RETURNING nombre
        `.returnsRow({ nombre: "pg/text@1" }).build());

        return { nombre: tarea.nombre, estado: "completada", fecha: dia.fecha, elementosProcesados };
    });
}

export async function ejecutarTareasDiarias(tareas: readonly TareaDiaria[]): Promise<ResultadoTareaDiaria[]> {
    const resultados: ResultadoTareaDiaria[] = [];
    const nombres = new Set<string>();
    for (const tarea of tareas) {
        if (!tarea.nombre.trim() || nombres.has(tarea.nombre)) {
            throw new Error("Las tareas deben tener nombres únicos y no vacíos.");
        }
        nombres.add(tarea.nombre);
    }
    for (const tarea of tareas) {
        try {
            const resultado = await ejecutarTarea(tarea);
            resultados.push(resultado);
            if (resultado.estado === "completada") {
                console.info("Tarea diaria completada.", {
                    tarea: resultado.nombre, fecha: resultado.fecha, elementosProcesados: resultado.elementosProcesados,
                });
            }
        } catch (error) {
            console.error("No se pudo completar una tarea diaria.", { tarea: tarea.nombre, error });
            resultados.push({ nombre: tarea.nombre, estado: "error" });
        }
    }
    return resultados;
}
