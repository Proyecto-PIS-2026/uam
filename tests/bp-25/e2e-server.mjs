import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import { obtenerDatabaseUrlTest } from "../../src/infraestructura/persistencia/configuracion-db-test.ts";

const directorioTests = fileURLToPath(new URL(".", import.meta.url));
const raiz = path.resolve(directorioTests, "../..");
const temporal = path.resolve(raiz, ".playwright");
const app = path.resolve(temporal, "bp-25");
if (!app.startsWith(temporal + path.sep)) throw new Error("La copia E2E debe estar dentro de .playwright.");

dotenv.config({ path: [path.join(raiz, ".env.local"), path.join(raiz, ".env")], quiet: true });
const databaseUrl = obtenerDatabaseUrlTest();

// La suite usa una base de pruebas desechable. No emite ni modifica el contrato del repositorio.
for (const [archivo, argumentos] of [
    ["node_modules/prisma/dist/prisma.js", ["db", "migrate", "--yes"]],
    ["node_modules/tsx/dist/cli.mjs", ["src/infraestructura/persistencia/prisma/seed.ts"]],
]) {
    const setup = spawnSync(process.execPath, [path.join(raiz, archivo), ...argumentos], {
        cwd: raiz,
        stdio: "inherit",
        env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    if (setup.error) throw setup.error;
    if (setup.status !== 0) throw new Error("No se pudo preparar DATABASE_URL_TEST para BP-25.1.");
}

rmSync(app, { recursive: true, force: true });
mkdirSync(app, { recursive: true });
for (const archivo of ["src", "public", "postcss.config.mjs", "tsconfig.json", "package.json"]) {
    const origen = path.join(raiz, archivo);
    if (existsSync(origen)) cpSync(origen, path.join(app, archivo), { recursive: true });
}

const css = path.join(app, "src/estilos/globals.css");
writeFileSync(css, readFileSync(css, "utf8").replace(
    '@import "tailwindcss";', '@import "tailwindcss" source("../");',
));
writeFileSync(path.join(app, "next.config.mjs"), `export default {
        agentRules: false,
        turbopack: { root: ${JSON.stringify(raiz)} }
    };\n`);

const next = spawn(process.execPath, [
    path.join(raiz, "node_modules/next/dist/bin/next"), "dev", app,
    "--hostname", "127.0.0.1", "--port", "3200",
], {
    cwd: app,
    stdio: "inherit",
    env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SESSION_SECRET: randomBytes(32).toString("hex"),
    },
});

let cerrando = false;
function cerrar() {
    if (cerrando) return;
    cerrando = true;
    if (!next.pid || next.exitCode !== null || next.signalCode !== null) {
        process.exit(0);
    }
    if (process.platform === "win32") {
        // Sólo el árbol del Next creado por este proceso; nunca otro servidor del usuario.
        const resultado = spawnSync("taskkill", ["/PID", String(next.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
        if (resultado.status !== 0) next.kill();
    } else {
        next.kill("SIGTERM");
    }
}

next.on("error", (error) => { console.error(error); process.exit(1); });
next.on("exit", (code) => process.exit(cerrando ? 0 : code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, cerrar);
process.on("message", (mensaje) => { if (mensaje?.tipo === "cerrar") cerrar(); });
process.on("disconnect", cerrar);
