import { obtenerVigenciaFotosDias } from "../../modulos/publicaciones/vigencia-fotos";

export async function iniciarTareasEnServidor() {
    try {
        obtenerVigenciaFotosDias();
    } catch {
        console.warn("Tareas diarias desactivadas: configurá VIGENCIA_FOTOS_DIAS con un entero entre 1 y 36500 y reiniciá la aplicación.");
        return;
    }
    if (!process.env.DATABASE_URL?.trim()) {
        console.warn("Tareas diarias desactivadas: configurá DATABASE_URL y reiniciá la aplicación.");
        return;
    }

    const [{ iniciarPlanificadorTareas }, { obtenerTareasDiarias }] = await Promise.all([
        import("./planificador"),
        import("./registro"),
    ]);
    iniciarPlanificadorTareas(obtenerTareasDiarias());
}
