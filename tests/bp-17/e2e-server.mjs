import { createServer } from "node:http";
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { relevamiento as referencia } from "../fixtures/precios-referencia.mjs";

const carpeta = fileURLToPath(new URL(".", import.meta.url));
const raiz = path.resolve(carpeta, "../..");
const carpetaTemporal = path.resolve(raiz, ".playwright");
const app = path.resolve(carpetaTemporal, "bp-17");
if (!app.startsWith(carpetaTemporal + path.sep)) throw new Error("La copia E2E debe estar dentro de .playwright.");
rmSync(app, { recursive: true, force: true });
mkdirSync(app, { recursive: true });

// Una copia nueva evita modificar la aplicación y conservar archivos de ejecuciones anteriores.
for (const archivo of ["src", "public", "postcss.config.mjs", "tsconfig.json", "package.json"]) {
    const origen = path.join(raiz, archivo);
    if (existsSync(origen)) cpSync(origen, path.join(app, archivo), { recursive: true });
}
const cssCopia = path.join(app, "src/estilos/globals.css");
// Reemplazar el módulo en la copia asegura el mismo proveedor en SSR y RSC,
// también cuando la consulta cambia mediante navegación del cliente (BP-26).
const consultasCopia = path.join(app, "src/modulos/informacion-uam/precios-historicos/consultas-precios-historicos.ts");
const mockConsultas = path.relative(path.dirname(consultasCopia), path.join(carpeta, "consultas-precios-historicos.mock.ts")).replaceAll(path.sep, "/");
writeFileSync(consultasCopia, `export { obtenerHistoricoPrecios, obtenerHistoricoPreciosConFiltros } from ${JSON.stringify(mockConsultas)};\n`);
writeFileSync(cssCopia, readFileSync(cssCopia, "utf8").replace(
    '@import "tailwindcss";', '@import "tailwindcss" source("../");',
));
writeFileSync(path.join(app, "next.config.mjs"), `export default {
    agentRules: false,
    turbopack: { root: ${JSON.stringify(raiz)} }
};\n`);

writeFileSync(path.join(app, "src/modulos/informacion-uam/precios-referencia/cache-diario.ts"), `
const referencia = ${JSON.stringify(referencia)};
export async function obtenerConsultaDiariaWebservice() { return referencia; }
export async function obtenerUltimoRelevamientoGuardado() { return referencia; }
`);
const mock = createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1:3101");
    const id = Number(url.searchParams.get("species_id"));
    const tipo = referencia.types.find((tipo) => tipo.products.some((producto) => producto.species_id === id));
    const producto = tipo?.products.find((producto) => producto.species_id === id);
    res.setHeader("Content-Type", "application/json");
    const desde = url.searchParams.get("from");
    const hasta = url.searchParams.get("to");
    if (url.pathname !== "/historicos" || !producto || !desde || !hasta || Number.isNaN(Date.parse(hasta))) {
        res.writeHead(400).end(JSON.stringify({ error: "Consulta inválida" }));
        return;
    }
    const anterior = new Date(`${hasta}T00:00:00Z`);
    anterior.setUTCDate(anterior.getUTCDate() - 1);
    const fechas = [hasta, anterior.toISOString().slice(0, 10)].filter((fecha) => fecha >= desde);
    const presentaciones = producto.varieties.flatMap(({ variety, presentations }) =>
        presentations.map((presentacion) => ({ ...presentacion, variety })));
    res.end(JSON.stringify({
        classification_id: tipo.classification_id, classification: tipo.classification,
        species_id: id, species: producto.species, from: desde, to: hasta,
        series: hasta < "2020-01-01" ? [] : fechas.map((date) => ({
            date, volume_kg: 1200,
            presentations: [...presentaciones, {
                ...presentaciones[0], variety: "Variedad E2E", prices: presentaciones[0].prices.slice(0, 1),
            }],
        })),
    }));
});

mock.on("error", (error) => { console.error(error); process.exit(1); });
mock.listen(3101, "127.0.0.1", () => {
    const next = spawn(process.execPath, [path.join(raiz, "node_modules/next/dist/bin/next"), "dev", app, "--hostname", "127.0.0.1", "--port", "3100"], {
        cwd: app, stdio: "inherit",
        env: {
            ...process.env,
            DATABASE_URL: "postgresql://bp17:bp17@127.0.0.1:65534/bp17",
            SESSION_SECRET: randomBytes(32).toString("hex"),
        },
    });
    next.on("error", (error) => { console.error(error); mock.close(() => process.exit(1)); });
    next.on("exit", (codigo) => { mock.close(() => process.exit(codigo ?? 1)); });
    for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { next.kill(); mock.close(); });
});
