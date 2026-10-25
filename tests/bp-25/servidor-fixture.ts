import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import path from "node:path";
import { setTimeout as esperar } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { test as testBase } from "@playwright/test";

const raiz = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const url = "http://127.0.0.1:3200/iniciar-sesion";

async function comprobarPuertoLibre() {
  const puerto = createServer();
  await new Promise<void>((resolve, reject) => {
    puerto.once("error", () => reject(new Error("El puerto 3200 está ocupado. BP-25 no reutiliza servidores existentes.")));
    puerto.listen(3200, "127.0.0.1", () => puerto.close((error) => error ? reject(error) : resolve()));
  });
}

async function detener(servidor: ChildProcess) {
  if (!servidor.pid || servidor.exitCode !== null || servidor.signalCode !== null) return;
  const terminado = new Promise<void>((resolve) => servidor.once("exit", () => resolve()));
  if (servidor.connected) servidor.send({ tipo: "cerrar" }, () => undefined);
  await Promise.race([terminado, esperar(10_000)]);
  if (servidor.exitCode !== null || servidor.signalCode !== null) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(servidor.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  } else {
    servidor.kill("SIGTERM");
  }
  await Promise.race([terminado, esperar(5_000)]);
}

// Importado sólo por BP-25: seleccionar otro proyecto no inicia ni prepara esta base.
// DATABASE_URL_TEST debe identificar una base desechable, distinta de la principal.
export const test = testBase.extend<Record<never, never>, { servidorBp25: void }>({
  servidorBp25: [async ({}, usar) => {
    await comprobarPuertoLibre();
    const servidor = spawn(process.execPath, [path.join(raiz, "tests/bp-25/e2e-server.mjs")], {
      cwd: raiz,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe", "ipc"],
      windowsHide: true,
    });
    let salida = "";
    let errorArranque: Error | undefined;
    const registrar = (datos: Buffer) => {
      salida = (salida + datos.toString().replace(/postgres(?:ql)?:\/\/[^\s"']+/g, "[URL de base de datos]")).slice(-24_000);
    };
    servidor.stdout?.on("data", registrar);
    servidor.stderr?.on("data", registrar);
    servidor.once("error", (error) => { errorArranque = error; });
    try {
      const limite = Date.now() + 180_000;
      let listo = false;
      while (Date.now() < limite) {
        if (errorArranque || servidor.exitCode !== null || servidor.signalCode !== null) {
          throw new Error(`No se pudo iniciar el servidor aislado BP-25. ${errorArranque?.message ?? ""}\n${salida}`);
        }
        try {
          const respuesta = await fetch(url, { signal: AbortSignal.timeout(2_000) });
          listo = respuesta.ok;
          await respuesta.body?.cancel();
          if (listo) break;
        } catch {
          // Next puede tardar en compilar la primera página.
        }
        await esperar(250);
      }
      if (!listo) throw new Error(`El servidor aislado BP-25 no estuvo listo en 180 segundos.\n${salida}`);
      await usar();
    } finally {
      await detener(servidor);
    }
  }, { scope: "worker", auto: true, timeout: 200_000 }],
});
