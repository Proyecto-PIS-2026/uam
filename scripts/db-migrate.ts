import { fileURLToPath } from "node:url";
import { ejecutarMigraciones } from "../src/infraestructura/persistencia/migrar-base-datos";

try {
    process.exitCode = ejecutarMigraciones(process.argv.slice(2), fileURLToPath(new URL("../", import.meta.url)));
} catch (error) {
    console.error(error instanceof Error ? error.message : "No se pudieron ejecutar las migraciones.");
    process.exitCode = 1;
}
