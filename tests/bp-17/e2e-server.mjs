import { createServer, request } from "node:http";
import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import nextEnv from "@next/env";

const carpeta = fileURLToPath(new URL(".", import.meta.url));
const raiz = path.resolve(carpeta, "../..");
nextEnv.loadEnvConfig(raiz, true);
const app = path.join(carpeta, ".app");
mkdirSync(app, { recursive: true });
// Next escribe y compila en esta copia, nunca en los archivos originales.
for (const archivo of ["src", "public", "storage", "postcss.config.mjs", "tsconfig.json", "package.json"]) {
  const origen = path.join(raiz, archivo);
  if (existsSync(origen)) cpSync(origen, path.join(app, archivo), { recursive: true });
}
const cssCopia = path.join(app, "src/estilos/globals.css");
writeFileSync(cssCopia, readFileSync(cssCopia, "utf8").replace(
  '@import "tailwindcss";', '@import "tailwindcss" source("../");',
));
writeFileSync(path.join(app, "next.config.mjs"), `export default {
  agentRules: false,
  turbopack: {
    root: ${JSON.stringify(raiz)},
    resolveAlias: {
      "@/modulos/informacion-uam/precios-historicos/consultas-precios-historicos": "../consultas-precios-historicos.mock.ts"
    }
  }
};\n`);

const referencia = JSON.parse(readFileSync(path.join(raiz, "src/modulos/informacion-uam/precios-referencia/consulta-referencia.json"), "utf8"));
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

const destino = "http://127.0.0.1:3102";
const proxy = createServer((req, res) => {
  const upstream = request(`${destino}${req.url}`, { method: req.method, headers: req.headers }, (respuesta) => {
    res.writeHead(respuesta.statusCode, respuesta.headers);
    respuesta.pipe(res);
  });
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502);
    res.end("El servidor de pruebas no está disponible.");
  });
  req.on("aborted", () => upstream.destroy());
  req.pipe(upstream);
});
proxy.on("upgrade", (req, socket, head) => {
  const upstream = request(`${destino}${req.url}`, { headers: req.headers });
  upstream.on("upgrade", (respuesta, conexion, datos) => {
    socket.write(`HTTP/1.1 ${respuesta.statusCode} ${respuesta.statusMessage}\r\n`);
    for (let i = 0; i < respuesta.rawHeaders.length; i += 2) {
      socket.write(`${respuesta.rawHeaders[i]}: ${respuesta.rawHeaders[i + 1]}\r\n`);
    }
    socket.write("\r\n");
    if (datos.length) socket.write(datos);
    if (head.length) conexion.write(head);
    conexion.on("error", () => socket.destroy());
    socket.on("error", () => conexion.destroy());
    socket.pipe(conexion).pipe(socket);
  });
  upstream.on("error", () => socket.destroy());
  upstream.end();
});

async function prepararRutas() {
  const limite = Date.now() + 90_000;
  while (true) {
    try {
      const respuesta = await fetch(`${destino}/precios-referencia`, { signal: AbortSignal.timeout(30_000) });
      await respuesta.text();
      if (!respuesta.ok) throw new Error(`Precios de referencia: HTTP ${respuesta.status}`);
      break;
    } catch (error) {
      if (Date.now() >= limite) throw error;
      await new Promise((resolver) => setTimeout(resolver, 250));
    }
  }
  // Compilar antes de admitir los workers evita demoras en aserciones de 5 s.
  // Las rutas de otras BP se preparan solo en la suite general, que requiere BD.
  const suiteGeneral = ["test:e2e", "test:e2e:ui"].includes(process.env.npm_lifecycle_event);
  const rutas = suiteGeneral && process.env.DATABASE_URL
    ? ["/inicio", "/mi-mercado", "/publicaciones", "/operadores", "/api/publicaciones"] : [];
  rutas.push("/precios-historicos?species_id=1&producto=Acelga");
  for (const ruta of rutas) {
    const respuesta = await fetch(`${destino}${ruta}`, { signal: AbortSignal.timeout(30_000) });
    const html = await respuesta.text();
    if (!respuesta.ok) throw new Error(`No se pudo preparar ${ruta}: HTTP ${respuesta.status}`);
    if (ruta === "/operadores") {
      const perfil = html.match(/href="(\/operadores\/[^"?]+)"/);
      if (perfil) {
        const detalle = await fetch(`${destino}${perfil[1]}`, { signal: AbortSignal.timeout(30_000) });
        await detalle.text();
        if (!detalle.ok) throw new Error(`No se pudo preparar el perfil: HTTP ${detalle.status}`);
      }
    }
  }
}

mock.listen(3101, "127.0.0.1", () => {
  const next = spawn(process.execPath, [path.join(raiz, "node_modules/next/dist/bin/next"), "dev", app, "--hostname", "127.0.0.1", "--port", "3102"], {
    cwd: app, stdio: "inherit",
    env: { ...process.env, PRECIOS_REFERENCIA_FUENTE: "local" },
  });
  next.on("exit", (codigo) => { proxy.close(); mock.close(() => process.exit(codigo ?? 1)); });
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => { next.kill(); proxy.close(); mock.close(); });
  prepararRutas().then(() => {
    proxy.listen(3100, "127.0.0.1", () => console.log("Servidor E2E preparado para ejecutar en paralelo."));
  }).catch((error) => { console.error(error); next.kill(); process.exitCode = 1; });
});
for (const servidor of [mock, proxy]) servidor.on("error", (error) => { console.error(error); process.exit(1); });
