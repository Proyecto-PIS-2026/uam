import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function leerJson(ruta: string) {
    return JSON.parse(readFileSync(ruta, "utf8"));
}

export function ejecutarMigraciones(argumentos: string[], raiz: string): number {
    const paquetePrisma = join(raiz, "node_modules", "prisma", "package.json");
    const binario = leerJson(paquetePrisma).bin?.prisma;
    if (typeof binario !== "string" || !binario) throw new Error("No se encontró el ejecutable local de Prisma.");

    function ejecutar(opciones: string[]): number {
        const resultado = spawnSync(process.execPath, [join(dirname(paquetePrisma), binario), "db", "migrate", ...opciones], {
            cwd: raiz,
            stdio: "inherit",
            shell: false,
        });
        if (resultado.error) throw resultado.error;
        return resultado.status ?? 1;
    }

    // Los destinos explícitos y la ayuda conservan el comportamiento de la CLI.
    if (argumentos.some((arg) => arg === "--to" || arg.startsWith("--to=") || arg === "--help" || arg === "-h")) {
        return ejecutar(argumentos);
    }

    const directorioPrisma = join(raiz, "src", "infraestructura", "persistencia", "prisma");
    const contrato = leerJson(join(directorioPrisma, "contract.json"));
    const hash = contrato.storage?.storageHash;
    if (typeof hash !== "string" || !/^[a-f0-9]{64}$/.test(hash)) {
        throw new Error("El contrato emitido no contiene un identificador válido. Ejecutá npm run db:contract.");
    }
    const directorioRefs = join(directorioPrisma, "migrations", "app", "refs");
    const referenciasRequeridas = ["aging-fotos-por-rol.json", "vigencia-publicaciones-operador.json"];
    const requeridas = referenciasRequeridas.flatMap((referencia): string[] => {
        const invariantes = leerJson(join(directorioRefs, referencia)).invariants;
        if (!Array.isArray(invariantes) || invariantes.length === 0 || invariantes.some((valor) => typeof valor !== "string" || !valor.trim())) {
            throw new Error(`La referencia ${referencia} no declara sus migraciones de datos requeridas.`);
        }
        return invariantes;
    });

    // Usar el contrato actual permite avanzar también por futuras migraciones de esquema.
    // Prisma registra los invariantes aplicados: no vuelve a ejecutar una migración satisfecha.
    const nombre = `destino-${randomUUID()}`;
    const ruta = join(directorioRefs, `${nombre}.json`);
    const temporal = join(directorioRefs, `${nombre}.tmp`);
    const contenido = `${JSON.stringify({ hash, invariants: [...new Set(requeridas)].sort() }, null, 2)}\n`.replace(/\n/g, "\r\n");
    // Publicar la referencia completa evita que otra ejecución lea un JSON incompleto.
    writeFileSync(temporal, contenido, { encoding: "utf8", flag: "wx" });
    let publicada = false;
    try {
        renameSync(temporal, ruta);
        publicada = true;
        return ejecutar([...argumentos, "--to", nombre]);
    } finally {
        unlinkSync(publicada ? ruta : temporal);
    }
}
