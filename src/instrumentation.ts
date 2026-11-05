export function register() {
    if (process.env.NEXT_RUNTIME !== "nodejs"
        || process.env.NEXT_PHASE === "phase-production-build"
        || process.env.NEXT_PHASE === "phase-export"
        || process.env.NEXT_PRIVATE_BUILD_WORKER === "1"
        || process.env.NODE_ENV === "test") return;

    void import("./infraestructura/tareas-programadas/iniciar-en-servidor")
        .then(({ iniciarTareasEnServidor }) => iniciarTareasEnServidor())
        .catch((error: unknown) => {
            console.error("No se pudieron iniciar las tareas diarias. La aplicación continuará funcionando.", error);
        });
}
