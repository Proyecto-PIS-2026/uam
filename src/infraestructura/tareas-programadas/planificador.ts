import { Temporal } from "@js-temporal/polyfill";
import { ejecutarTareasDiarias } from "./ejecutar-tareas";
import { ZONA_HORARIA_TAREAS, type TareaDiaria } from "./tipos";

const REINTENTO_MS = 5 * 60 * 1000;

export type ControlPlanificador = {
    detener: () => Promise<void>;
};

type PlanificadorActivo = ControlPlanificador & {
    actualizarTareas: (tareas: readonly TareaDiaria[], ejecutarTareas: typeof ejecutarTareasDiarias) => void;
};

const globalTareas = globalThis as typeof globalThis & {
    uamPlanificadorTareas?: PlanificadorActivo;
};

function demoraHastaMedianoche(): number {
    const ahora = Temporal.Now.zonedDateTimeISO(ZONA_HORARIA_TAREAS);
    return Math.max(1, ahora.add({ days: 1 }).startOfDay().epochMilliseconds - ahora.epochMilliseconds);
}

export function iniciarPlanificadorTareas(tareasIniciales: readonly TareaDiaria[]): ControlPlanificador {
    if (globalTareas.uamPlanificadorTareas) {
        globalTareas.uamPlanificadorTareas.actualizarTareas(tareasIniciales, ejecutarTareasDiarias);
        return globalTareas.uamPlanificadorTareas;
    }

    let tareas = [...tareasIniciales];
    let ejecutor = ejecutarTareasDiarias;
    let activo = true;
    let temporizador: ReturnType<typeof setTimeout> | undefined;
    let enCurso: Promise<void> | undefined;

    function ejecutar() {
        if (!activo || enCurso) return;
        let reintentar = false;
        enCurso = ejecutor(tareas)
            .then((resultados) => {
                const fechaActual = Temporal.Now.plainDateISO(ZONA_HORARIA_TAREAS).toString();
                reintentar = resultados.some((resultado) => resultado.estado === "error" || resultado.estado === "ocupada"
                    || "fecha" in resultado && resultado.fecha < fechaActual);
            })
            .catch((error: unknown) => {
                reintentar = true;
                console.error("No se pudieron iniciar las tareas diarias. Se reintentará automáticamente.", error);
            })
            .finally(() => {
                enCurso = undefined;
                if (!activo) return;
                const demora = demoraHastaMedianoche();
                temporizador = setTimeout(ejecutar, reintentar ? Math.min(REINTENTO_MS, demora) : demora);
                temporizador.unref();
            });
    }

    const control: PlanificadorActivo = {
        actualizarTareas(nuevas, ejecutarTareas) {
            tareas = [...nuevas];
            ejecutor = ejecutarTareas;
        },
        async detener() {
            activo = false;
            if (temporizador) clearTimeout(temporizador);
            await enCurso;
            if (globalTareas.uamPlanificadorTareas === control) delete globalTareas.uamPlanificadorTareas;
        },
    };
    globalTareas.uamPlanificadorTareas = control;
    ejecutar();
    return control;
}
