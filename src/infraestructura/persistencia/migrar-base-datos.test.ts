// @vitest-environment node
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ejecutarMigraciones } from "./migrar-base-datos";

const mocks = vi.hoisted(() => ({
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
    unlinkSync: vi.fn(),
    spawnSync: vi.fn(),
    randomUUID: vi.fn(),
}));

vi.mock("node:fs", () => {
    const fs = {
        readFileSync: mocks.readFileSync,
        writeFileSync: mocks.writeFileSync,
        renameSync: mocks.renameSync,
        unlinkSync: mocks.unlinkSync,
    };
    return { ...fs, default: fs };
});
vi.mock("node:child_process", () => {
    const childProcess = { spawnSync: mocks.spawnSync };
    return { ...childProcess, default: childProcess };
});
vi.mock("node:crypto", () => {
    const crypto = { randomUUID: mocks.randomUUID };
    return { ...crypto, default: crypto };
});

const raiz = join("proyecto", "uam");
const paquetePrisma = join(raiz, "node_modules", "prisma", "package.json");
const ejecutablePrisma = join(raiz, "node_modules", "prisma", "dist", "prisma.js");
const directorioPrisma = join(raiz, "src", "infraestructura", "persistencia", "prisma");
const contrato = join(directorioPrisma, "contract.json");
const referencias = join(directorioPrisma, "migrations", "app", "refs");
const referenciaAging = join(referencias, "aging-fotos-por-rol.json");
const referenciaVigencia = join(referencias, "vigencia-publicaciones-operador.json");
const referenciaCatalogos = join(referencias, "catalogos-publicacion-globales.json");
const hashActual = "a".repeat(64);
const hashAnterior = "b".repeat(64);
const invariante = "uam:aging-fotos-productor-separado";
const invarianteVigencia = "uam:vigencia-publicaciones-operador";
const invarianteCatalogos = "uam:catalogos-publicacion-globales";
const destino = "destino-00000000-0000-4000-8000-000000000001";
const temporal = join(referencias, `${destino}.tmp`);
const publicada = join(referencias, `${destino}.json`);
let archivos: Map<string, unknown>;

beforeEach(() => {
    vi.resetAllMocks();
    archivos = new Map<string, unknown>([
        [paquetePrisma, { bin: { prisma: "./dist/prisma.js" } }],
        [contrato, { storage: { storageHash: hashActual } }],
        [referenciaAging, { hash: hashAnterior, invariants: [invariante] }],
        [referenciaVigencia, { hash: hashAnterior, invariants: [invarianteVigencia] }],
        [referenciaCatalogos, { hash: hashAnterior, invariants: [invarianteCatalogos] }],
    ]);
    mocks.readFileSync.mockImplementation((ruta: string) => {
        if (!archivos.has(ruta)) throw new Error(`Lectura inesperada: ${ruta}`);
        return JSON.stringify(archivos.get(ruta));
    });
    mocks.randomUUID.mockReturnValue("00000000-0000-4000-8000-000000000001");
    mocks.spawnSync.mockReturnValue({ status: 0 });
});

describe("ejecutarMigraciones", () => {
    it("usa el contrato actual y los invariantes de aging, vigencia y catálogos, publicando la referencia antes de ejecutar Prisma", () => {
        archivos.set(referenciaAging, {
            hash: hashAnterior,
            invariants: ["uam:otro-requisito", invariante, "uam:otro-requisito"],
        });
        const argumentos = ["--show", "--from", "anterior", "--db", "local"];

        expect(ejecutarMigraciones(argumentos, raiz)).toBe(0);

        expect(mocks.writeFileSync).toHaveBeenCalledExactlyOnceWith(temporal, expect.any(String), {
            encoding: "utf8",
            flag: "wx",
        });
        const contenido = mocks.writeFileSync.mock.calls[0][1] as string;
        expect(JSON.parse(contenido)).toEqual({
            hash: hashActual,
            invariants: [invariante, invarianteCatalogos, "uam:otro-requisito", invarianteVigencia],
        });
        expect(contenido).not.toMatch(/(?<!\r)\n/);
        expect(mocks.renameSync).toHaveBeenCalledExactlyOnceWith(temporal, publicada);
        expect(mocks.spawnSync).toHaveBeenCalledExactlyOnceWith(
            process.execPath,
            [ejecutablePrisma, "db", "migrate", ...argumentos, "--to", destino],
            { cwd: raiz, stdio: "inherit", shell: false },
        );
        expect(mocks.unlinkSync).toHaveBeenCalledExactlyOnceWith(publicada);
        expect(mocks.writeFileSync.mock.invocationCallOrder[0]).toBeLessThan(mocks.renameSync.mock.invocationCallOrder[0]);
        expect(mocks.renameSync.mock.invocationCallOrder[0]).toBeLessThan(mocks.spawnSync.mock.invocationCallOrder[0]);
        expect(mocks.spawnSync.mock.invocationCallOrder[0]).toBeLessThan(mocks.unlinkSync.mock.invocationCallOrder[0]);
    });

    it.each([
        { argumentos: ["--to", "destino-elegido"] },
        { argumentos: ["--to=destino-elegido"] },
        { argumentos: ["--help"] },
        { argumentos: ["-h"] },
    ])("respeta los argumentos explícitos $argumentos sin generar referencias", ({ argumentos }) => {
        expect(ejecutarMigraciones(argumentos, raiz)).toBe(0);

        expect(mocks.spawnSync).toHaveBeenCalledExactlyOnceWith(
            process.execPath,
            [ejecutablePrisma, "db", "migrate", ...argumentos],
            { cwd: raiz, stdio: "inherit", shell: false },
        );
        expect(mocks.readFileSync).toHaveBeenCalledExactlyOnceWith(paquetePrisma, "utf8");
        expect(mocks.randomUUID).not.toHaveBeenCalled();
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
        expect(mocks.renameSync).not.toHaveBeenCalled();
        expect(mocks.unlinkSync).not.toHaveBeenCalled();
    });

    it.each([
        { estado: 5, esperado: 5 },
        { estado: null, esperado: 1 },
    ])("devuelve $esperado para una salida $estado y elimina la referencia", ({ estado, esperado }) => {
        mocks.spawnSync.mockReturnValue({ status: estado });

        expect(ejecutarMigraciones([], raiz)).toBe(esperado);
        expect(mocks.unlinkSync).toHaveBeenCalledExactlyOnceWith(publicada);
    });

    it.each(["devuelto", "lanzado"])("propaga el error %s al iniciar Prisma y elimina la referencia", (modo) => {
        const error = new Error("No se pudo iniciar Prisma");
        if (modo === "devuelto") {
            mocks.spawnSync.mockReturnValue({ status: null, error });
        } else {
            mocks.spawnSync.mockImplementation(() => { throw error; });
        }

        expect(() => ejecutarMigraciones([], raiz)).toThrow(error);
        expect(mocks.unlinkSync).toHaveBeenCalledExactlyOnceWith(publicada);
    });

    it("elimina solamente el temporal si falla la publicación y no ejecuta Prisma", () => {
        const error = new Error("No se pudo publicar la referencia");
        mocks.renameSync.mockImplementation(() => { throw error; });

        expect(() => ejecutarMigraciones([], raiz)).toThrow(error);
        expect(mocks.unlinkSync).toHaveBeenCalledExactlyOnceWith(temporal);
        expect(mocks.spawnSync).not.toHaveBeenCalled();
    });

    it.each([
        { descripcion: "ausente", valor: undefined },
        { descripcion: "de tipo incorrecto", valor: 123 },
        { descripcion: "de longitud incorrecta", valor: "abc" },
        { descripcion: "no hexadecimal", valor: "z".repeat(64) },
    ])("rechaza un hash $descripcion antes de escribir o ejecutar Prisma", ({ valor }) => {
        archivos.set(contrato, { storage: { storageHash: valor } });

        expect(() => ejecutarMigraciones([], raiz)).toThrow("El contrato emitido no contiene un identificador válido");
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
        expect(mocks.spawnSync).not.toHaveBeenCalled();
    });

    it.each([
        { descripcion: "ausentes", valor: undefined },
        { descripcion: "sin lista", valor: invariante },
        { descripcion: "vacíos", valor: [] },
        { descripcion: "con una cadena vacía", valor: [" "] },
        { descripcion: "con un elemento de otro tipo", valor: [invariante, 123] },
    ])("rechaza invariantes $descripcion antes de escribir o ejecutar Prisma", ({ valor }) => {
        archivos.set(referenciaAging, { hash: hashAnterior, invariants: valor });

        expect(() => ejecutarMigraciones([], raiz)).toThrow("La referencia aging-fotos-por-rol.json no declara sus migraciones de datos requeridas");
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
        expect(mocks.spawnSync).not.toHaveBeenCalled();
    });

    it("rechaza una referencia de vigencia sin invariantes aunque la de aging sea válida", () => {
        archivos.set(referenciaVigencia, { hash: hashAnterior, invariants: [] });

        expect(() => ejecutarMigraciones([], raiz)).toThrow("La referencia vigencia-publicaciones-operador.json no declara sus migraciones de datos requeridas");
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
        expect(mocks.spawnSync).not.toHaveBeenCalled();
    });

    it("rechaza una referencia de catálogos sin invariantes aunque las demás sean válidas", () => {
        archivos.set(referenciaCatalogos, { hash: hashAnterior, invariants: [] });

        expect(() => ejecutarMigraciones([], raiz)).toThrow("La referencia catalogos-publicacion-globales.json no declara sus migraciones de datos requeridas");
        expect(mocks.writeFileSync).not.toHaveBeenCalled();
        expect(mocks.spawnSync).not.toHaveBeenCalled();
    });
});
