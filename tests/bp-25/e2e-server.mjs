import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: [".env.local", ".env"], quiet: true });

const directorioTests = fileURLToPath(new URL(".", import.meta.url));
const raiz = path.resolve(directorioTests, "../..");
const temporal = path.resolve(raiz, ".playwright");
const app = path.resolve(temporal, "bp-25");
if (!app.startsWith(temporal + path.sep)) throw new Error("La copia E2E debe estar dentro de .playwright.");

const databaseUrl = process.env.DATABASE_URL_TEST;
if (!databaseUrl) throw new Error("Definí DATABASE_URL_TEST para ejecutar BP-25.1 con datos aislados.");

const archivosContrato = [
    "src/infraestructura/persistencia/prisma/contract.json",
    "src/infraestructura/persistencia/prisma/contract.d.ts",
];
const respaldoContrato = new Map(archivosContrato.map((archivo) => [
    archivo,
    readFileSync(path.join(raiz, archivo)),
]));

try {
    const npm = process.platform === "win32" ? "npm.cmd" : "npm";
    const setup = spawnSync(npm, ["run", "db:setup:test"], {
        cwd: raiz,
        stdio: "inherit",
        shell: process.platform === "win32",
        env: { ...process.env, DATABASE_URL: databaseUrl },
    });
    if (setup.error) throw setup.error;
    if (setup.status !== 0) throw new Error("No se pudo preparar la base aislada uam_test para BP-25.1.");

    rmSync(app, { recursive: true, force: true });
    mkdirSync(app, { recursive: true });
    for (const archivo of ["src", "public", "storage", "postcss.config.mjs", "tsconfig.json", "package.json"]) {
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
} finally {
    for (const [archivo, contenido] of respaldoContrato) {
        writeFileSync(path.join(raiz, archivo), contenido);
    }
}

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

next.on("error", (error) => { console.error(error); process.exit(1); });
next.on("exit", (code) => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => next.kill(signal));
