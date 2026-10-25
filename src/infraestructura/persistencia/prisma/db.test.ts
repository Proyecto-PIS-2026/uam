import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import contractJson from "./contract.json" with { type: "json" };

const mocks = vi.hoisted(() => ({ postgres: vi.fn() }));

vi.mock("@prisma/orm-postgres/runtime", () => ({ default: mocks.postgres }));
vi.mock("dotenv/config", () => ({}));

const cache = globalThis as typeof globalThis & { db?: unknown; dbFirma?: string };
const cacheOriginal = { db: cache.db, dbFirma: cache.dbFirma };
const url = "postgresql://unit:unit@127.0.0.1:1/uam_unit";

function crearCliente(conImagen = true) {
    return {
        orm: { public: conImagen ? { Imagen: {} } : {} },
        close: vi.fn().mockResolvedValue(undefined),
    };
}

async function importarDb() {
    return (await vi.importActual<typeof import("./db")>("./db")).db;
}

beforeEach(() => {
    vi.resetModules();
    mocks.postgres.mockReset();
    delete cache.db;
    delete cache.dbFirma;
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("DATABASE_URL", url);
});

afterEach(() => {
    vi.doUnmock("./contract.json");
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    if (cacheOriginal.db === undefined) delete cache.db;
    else cache.db = cacheOriginal.db;
    if (cacheOriginal.dbFirma === undefined) delete cache.dbFirma;
    else cache.dbFirma = cacheOriginal.dbFirma;
});

describe("cliente PostgreSQL durante la recarga de módulos", () => {
    it("reemplaza el cliente anterior sin firma que todavía no tiene el modelo Imagen", async () => {
        const anterior = crearCliente(false);
        const actual = crearCliente();
        cache.db = anterior;
        mocks.postgres.mockReturnValue(actual);

        const db = await importarDb();

        expect(db).toBe(actual);
        expect(db.orm.public.Imagen).toBeDefined();
        expect(cache.db).toBe(actual);
        expect(cache.dbFirma).toMatch(/^[a-f0-9]{64}$/);
        expect(mocks.postgres).toHaveBeenCalledExactlyOnceWith({ contractJson, url });
        expect(anterior.close).toHaveBeenCalledOnce();
    });

    it("reutiliza el cliente al recargar el mismo contrato y la misma base", async () => {
        const actual = crearCliente();
        mocks.postgres.mockReturnValue(actual);
        await importarDb();
        const firma = cache.dbFirma;
        vi.resetModules();

        expect(await importarDb()).toBe(actual);
        expect(cache.dbFirma).toBe(firma);
        expect(mocks.postgres).toHaveBeenCalledOnce();
        expect(actual.close).not.toHaveBeenCalled();
    });

    it("reemplaza el cliente cuando cambia el contrato aunque se conserve la base", async () => {
        const anterior = crearCliente();
        const actual = crearCliente();
        mocks.postgres.mockReturnValueOnce(anterior).mockReturnValueOnce(actual);
        await importarDb();
        const firmaAnterior = cache.dbFirma;
        const otroContrato = { ...contractJson, meta: { revisionPrueba: "contrato-actualizado" } };
        vi.doMock("./contract.json", () => ({ default: otroContrato }));
        vi.resetModules();

        expect(await importarDb()).toBe(actual);
        expect(cache.db).toBe(actual);
        expect(cache.dbFirma).not.toBe(firmaAnterior);
        expect(mocks.postgres).toHaveBeenLastCalledWith({ contractJson: otroContrato, url });
        expect(anterior.close).toHaveBeenCalledOnce();
    });

    it("reemplaza el cliente cuando cambia la base aunque se conserve el contrato", async () => {
        const anterior = crearCliente();
        const actual = crearCliente();
        mocks.postgres.mockReturnValueOnce(anterior).mockReturnValueOnce(actual);
        await importarDb();
        const firmaAnterior = cache.dbFirma;
        const otraUrl = `${url}_otra`;
        vi.stubEnv("DATABASE_URL", otraUrl);
        vi.resetModules();

        expect(await importarDb()).toBe(actual);
        expect(cache.db).toBe(actual);
        expect(cache.dbFirma).not.toBe(firmaAnterior);
        expect(mocks.postgres).toHaveBeenLastCalledWith({ contractJson, url: otraUrl });
        expect(anterior.close).toHaveBeenCalledOnce();
    });

    it("en producción crea un cliente sin reutilizar ni sobrescribir la caché global", async () => {
        const anterior = crearCliente();
        const actual = crearCliente();
        mocks.postgres.mockReturnValueOnce(anterior).mockReturnValueOnce(actual);
        await importarDb();
        const firmaAnterior = cache.dbFirma;
        vi.stubEnv("NODE_ENV", "production");
        vi.resetModules();

        expect(await importarDb()).toBe(actual);
        expect(cache.db).toBe(anterior);
        expect(cache.dbFirma).toBe(firmaAnterior);
        expect(mocks.postgres).toHaveBeenCalledTimes(2);
        expect(anterior.close).not.toHaveBeenCalled();
    });

    it("conserva el cliente nuevo si falla el cierre del anterior", async () => {
        const anterior = crearCliente(false);
        anterior.close.mockRejectedValue(new Error("No se pudo cerrar"));
        const actual = crearCliente();
        cache.db = anterior;
        mocks.postgres.mockReturnValue(actual);
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);

        expect(await importarDb()).toBe(actual);
        await Promise.resolve();

        expect(cache.db).toBe(actual);
        expect(cache.dbFirma).toMatch(/^[a-f0-9]{64}$/);
        expect(registrar).toHaveBeenCalledExactlyOnceWith("No se pudo cerrar el cliente anterior de PostgreSQL.");
        vi.resetModules();
        expect(await importarDb()).toBe(actual);
        expect(mocks.postgres).toHaveBeenCalledOnce();
    });

    it("conserva la caché anterior si no se puede construir el cliente nuevo", async () => {
        const anterior = crearCliente(false);
        cache.db = anterior;
        cache.dbFirma = "firma-anterior";
        const error = new Error("No se pudo crear el cliente");
        mocks.postgres.mockImplementation(() => { throw error; });

        await expect(importarDb()).rejects.toBe(error);

        expect(cache.db).toBe(anterior);
        expect(cache.dbFirma).toBe("firma-anterior");
        expect(anterior.close).not.toHaveBeenCalled();
    });
});
