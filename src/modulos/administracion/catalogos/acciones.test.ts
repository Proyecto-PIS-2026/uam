// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eliminarElementoCatalogo, guardarElementoCatalogo, listarCatalogo } from "./acciones";
import type { TipoCatalogo } from "./tipos";

const mocks = vi.hoisted(() => {
    const modelo = () => ({ select: vi.fn(), where: vi.fn(), all: vi.fn(), first: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() });
    return {
        autorizar: vi.fn(), revalidatePath: vi.fn(), transaction: vi.fn(), execute: vi.fn(), query: vi.fn(), rawSql: vi.fn(), registrarPublicacion: vi.fn(),
        modelos: { Envase: modelo(), KilosEmpaquetado: modelo(), Calibre: modelo(), Categoria: modelo(), Publicacion: modelo(), EstadisticaPublicacion: modelo() },
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: mocks.modelos }, transaction: mocks.transaction, raw: { sql: mocks.rawSql } },
}));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: mocks.autorizar }));
vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({ controlarSesionEnAccion: (control: () => Promise<unknown>) => control() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/modulos/administracion/estadisticas/registrar-estadisticas", () => ({ registrarPublicacion: mocks.registrarPublicacion }));

const casos = [
    { tipo: "empaquetados", modelo: "Envase", fila: { id: 10, nombreEnvase: "Cajón" }, datos: { nombre: "  CAJÓN  " }, escritura: { nombreEnvase: "CAJÓN" }, campo: "envaseId", tabla: "envase" },
    { tipo: "kilos", modelo: "KilosEmpaquetado", fila: { id: 10, valor: "2" }, datos: { nombre: " 02,00 " }, escritura: { valor: "2" }, campo: "kilosId", tabla: '"kilosEmpaquetado"' },
    { tipo: "calibres", modelo: "Calibre", fila: { id: 10, nombreCalibre: "Grande", codigoCalibre: "G" }, datos: { nombre: " GRANDE ", codigo: " g " }, escritura: { nombreCalibre: "GRANDE", codigoCalibre: "g" }, campo: "calibreId", tabla: "calibre" },
    { tipo: "categorias", modelo: "Categoria", fila: { id: 10, nombreCategoria: "Primera" }, datos: { nombre: " PRIMERA " }, escritura: { nombreCategoria: "PRIMERA", especieId: null }, campo: "categoriaId", tabla: "categoria" },
] as const;

beforeEach(() => {
    vi.resetAllMocks();
    for (const modelo of Object.values(mocks.modelos)) {
        modelo.select.mockReturnThis();
        modelo.where.mockReturnThis();
        modelo.all.mockResolvedValue([]);
        modelo.first.mockResolvedValue(null);
        modelo.create.mockResolvedValue({ id: 10 });
        modelo.update.mockResolvedValue({ id: 10 });
        modelo.delete.mockResolvedValue({ id: 10 });
    }
    mocks.autorizar.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR" });
    mocks.query.mockResolvedValue([{ id: 10 }]);
    mocks.execute.mockResolvedValue(undefined);
    mocks.rawSql.mockImplementation((partes: TemplateStringsArray, ...valores: unknown[]) => {
        const plan = { texto: partes.join("?").replace(/\s+/g, " "), valores };
        return { returnsRow: () => ({ build: () => plan }) };
    });
    const tx = { orm: { public: mocks.modelos }, query: mocks.query, execute: mocks.execute };
    mocks.transaction.mockImplementation((operacion: (cliente: typeof tx) => Promise<void>) => operacion(tx));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => vi.restoreAllMocks());

describe("autorización y validaciones del ABM", () => {
    it.each(["listar", "guardar", "eliminar"])("exige administrador antes de %s y conserva el error de sesión", async (accion) => {
        const error = new Error("Sesión no autorizada");
        mocks.autorizar.mockRejectedValue(error);
        const resultado = accion === "listar" ? listarCatalogo("categorias")
            : accion === "guardar" ? guardarElementoCatalogo("categorias", { nombre: "Nueva" })
            : eliminarElementoCatalogo("categorias", 10);
        await expect(resultado).rejects.toBe(error);
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.modelos.Categoria.all).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("rechaza un catálogo no reconocido sin consultar la base", async () => {
        const tipo = "usuarios" as TipoCatalogo;
        await expect(listarCatalogo(tipo)).rejects.toThrow("El catálogo no es válido.");
        expect(await guardarElementoCatalogo(tipo, { nombre: "Nuevo" })).toEqual({ ok: false, mensaje: "El catálogo no es válido." });
        expect(await eliminarElementoCatalogo(tipo, 10)).toEqual({ ok: false, mensaje: "El catálogo no es válido." });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, NaN, Infinity, 2147483648])("rechaza el identificador inválido %s", async (id) => {
        expect(await guardarElementoCatalogo("categorias", { nombre: "Nueva" }, id)).toMatchObject({ ok: false });
        expect(await eliminarElementoCatalogo("categorias", id)).toMatchObject({ ok: false });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("rechaza valores vacíos antes de abrir la transacción", async () => {
        expect(await guardarElementoCatalogo("categorias", { nombre: " \n " })).toEqual({ ok: false, mensaje: "El valor es obligatorio." });
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});

describe.each(casos)("catálogo de $tipo", ({ tipo, modelo, fila, datos, escritura, campo, tabla }) => {
    it("lista los valores existentes del catálogo elegido", async () => {
        mocks.modelos[modelo].all.mockResolvedValue([fila]);
        expect(await listarCatalogo(tipo)).toEqual([tipo === "calibres"
            ? { id: 10, nombre: "Grande", codigo: "G" }
            : { id: 10, nombre: tipo === "empaquetados" ? "Cajón" : tipo === "kilos" ? "2" : "Primera" }]);
        expect(mocks.autorizar).toHaveBeenCalledOnce();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("agrega el valor normalizado y actualiza las vistas", async () => {
        expect(await guardarElementoCatalogo(tipo, datos)).toEqual({ ok: true });
        expect(mocks.modelos[modelo].create).toHaveBeenCalledExactlyOnceWith(escritura);
        expect(mocks.execute.mock.calls[0][0].texto).toContain("pg_advisory_xact_lock");
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.modelos[modelo].all.mock.invocationCallOrder[0]);
        expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith("/", "layout");
    });

    it("rechaza duplicados en alta y edición aunque cambien mayúsculas o formato", async () => {
        mocks.modelos[modelo].all.mockResolvedValue([fila]);
        expect(await guardarElementoCatalogo(tipo, datos)).toMatchObject({ ok: false, mensaje: expect.stringContaining("Ya existe") });
        expect(await guardarElementoCatalogo(tipo, datos, 11)).toMatchObject({ ok: false, mensaje: expect.stringContaining("Ya existe") });
        expect(mocks.modelos[modelo].create).not.toHaveBeenCalled();
        expect(mocks.modelos[modelo].update).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("edita el catálogo sin escribir en publicaciones ni contabilizar modificaciones", async () => {
        mocks.modelos[modelo].all.mockResolvedValue([fila]);
        expect(await guardarElementoCatalogo(tipo, datos, 10)).toEqual({ ok: true });
        expect(mocks.modelos[modelo].where).toHaveBeenCalledExactlyOnceWith({ id: 10 });
        expect(mocks.modelos[modelo].update).toHaveBeenCalledExactlyOnceWith(escritura);
        expect(mocks.modelos[modelo].create).not.toHaveBeenCalled();
        expect(mocks.modelos.Publicacion.update).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.create).not.toHaveBeenCalled();
        expect(mocks.modelos.EstadisticaPublicacion.update).not.toHaveBeenCalled();
        expect(mocks.registrarPublicacion).not.toHaveBeenCalled();
        expect(mocks.query.mock.calls[0][0]).toEqual({ texto: `SELECT id FROM ${tabla} WHERE id = ? FOR UPDATE`, valores: [10] });
    });

    it("impide borrar valores asociados incluso a publicaciones inactivas de productores", async () => {
        mocks.modelos.Publicacion.first.mockResolvedValue({ id: 30, publicacionActiva: false, tipoPublicacion: "PRODUCTOR" });
        expect(await eliminarElementoCatalogo(tipo, 10)).toEqual({ ok: false, mensaje: "No se puede eliminar este valor porque tiene publicaciones asociadas." });
        expect(mocks.modelos.Publicacion.where).toHaveBeenCalledExactlyOnceWith({ [campo]: 10 });
        expect(mocks.query.mock.invocationCallOrder[0]).toBeLessThan(mocks.modelos.Publicacion.first.mock.invocationCallOrder[0]);
        expect(mocks.modelos[modelo].delete).not.toHaveBeenCalled();
        expect(mocks.modelos.Publicacion.update).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("elimina un valor sin publicaciones después de bloquearlo y comprobar su uso", async () => {
        expect(await eliminarElementoCatalogo(tipo, 10)).toEqual({ ok: true });
        expect(mocks.modelos[modelo].where).toHaveBeenCalledExactlyOnceWith({ id: 10 });
        expect(mocks.modelos[modelo].delete).toHaveBeenCalledOnce();
        expect(mocks.modelos.Publicacion.first.mock.invocationCallOrder[0]).toBeLessThan(mocks.modelos[modelo].delete.mock.invocationCallOrder[0]);
        expect(mocks.revalidatePath).toHaveBeenCalledExactlyOnceWith("/", "layout");
    });
});

describe("cambios concurrentes y errores", () => {
    it("informa cuando el registro desapareció antes de editar o eliminar", async () => {
        mocks.query.mockResolvedValue([]);
        expect(await guardarElementoCatalogo("categorias", { nombre: "Nueva" }, 10)).toMatchObject({ ok: false, mensaje: expect.stringContaining("ya no existe") });
        expect(await eliminarElementoCatalogo("categorias", 10)).toMatchObject({ ok: false, mensaje: expect.stringContaining("ya no existe") });
        expect(mocks.modelos.Categoria.update).not.toHaveBeenCalled();
        expect(mocks.modelos.Categoria.delete).not.toHaveBeenCalled();
    });

    it("traduce un conflicto de unicidad anidado sin exponer datos internos", async () => {
        mocks.modelos.Envase.create.mockRejectedValue(new Error("Detalle interno", { cause: { sqlState: "23505" } }));
        expect(await guardarElementoCatalogo("empaquetados", { nombre: "Nuevo" })).toEqual({ ok: false, mensaje: "Ya existe un valor con ese nombre o código en el catálogo." });
    });

    it("informa el uso asociado si la base rechaza el borrado por una referencia concurrente", async () => {
        mocks.modelos.Categoria.delete.mockRejectedValue({ cause: { code: "23503" } });
        expect(await eliminarElementoCatalogo("categorias", 10)).toEqual({ ok: false, mensaje: "No se puede eliminar este valor porque tiene publicaciones asociadas." });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("devuelve un mensaje genérico ante un error inesperado", async () => {
        mocks.modelos.Categoria.create.mockRejectedValue(new Error("Credenciales internas"));
        expect(await guardarElementoCatalogo("categorias", { nombre: "Nueva" })).toEqual({ ok: false, mensaje: "No se pudo guardar el cambio. Intentá nuevamente." });
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("confirma un cambio persistido aunque falle la invalidación de caché", async () => {
        mocks.revalidatePath.mockImplementation(() => { throw new Error("Sin caché"); });
        expect(await guardarElementoCatalogo("categorias", { nombre: "Nueva" })).toEqual({ ok: true });
        expect(mocks.modelos.Categoria.create).toHaveBeenCalledOnce();
        expect(console.error).toHaveBeenCalledOnce();
    });
});
