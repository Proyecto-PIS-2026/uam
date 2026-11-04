export async function iniciarTareasEnServidor() {
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
