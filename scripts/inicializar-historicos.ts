import "dotenv/config";
import { db } from "../src/infraestructura/persistencia/prisma/db";
import { inicializarHistoricosPrecios } from "../src/modulos/informacion-uam/precios-historicos/consultas-precios-historicos";

async function main() {
    console.log("Iniciando carga de históricos de precios...");
    const resultado = await inicializarHistoricosPrecios();

    console.log(`Especies: ${resultado.total}. Cargadas: ${resultado.actualizadas}. Ya inicializadas: ${resultado.omitidas}. Fallidas: ${resultado.errores.length}.`);
    if (resultado.pendientes !== undefined) {
        console.log(`Pendientes por el límite de especies: ${resultado.pendientes}.`);
    }
    for (const error of resultado.errores) {
        console.error(`Especie ${error.speciesId}: ${error.mensaje}`);
    }
    if (resultado.errores.length > 0) process.exitCode = 1;
}

main()
    .catch((causa: unknown) => {
        const detalle = causa instanceof Error && /^(PRECIOS_HISTORICOS_|Falta la URL|La URL del webservice)/.test(causa.message)
            ? causa.message : "Revisá la configuración del webservice y de la base de datos.";
        console.error(`No se pudo completar la carga inicial. ${detalle}`);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            await db.close();
        } catch {
            console.error("No se pudo cerrar la conexión a la base de datos.");
            process.exitCode = 1;
        }
    });
