import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bajaOperador } from "./bajaOperador";

const mocks = vi.hoisted(() => ({
    exigirAdministrador: vi.fn(),
    transaction: vi.fn(),
    bloquear: vi.fn(),
    revalidatePath: vi.fn(),
    eliminarImagen: vi.fn(),
    eliminarPerfil: vi.fn(),
    operador: { where: vi.fn().mockReturnThis(), first: vi.fn(), delete: vi.fn() },
    usuario: { where: vi.fn().mockReturnThis(), delete: vi.fn() },
    local: { where: vi.fn().mockReturnThis(), delete: vi.fn(), deleteAll: vi.fn() },
    relacion: { where: vi.fn().mockReturnThis(), all: vi.fn(), delete: vi.fn(), deleteAll: vi.fn() },
    publicacion: { where: vi.fn().mockReturnThis(), first: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", async (importOriginal) => ({
    ...(await importOriginal<typeof import("@/modulos/identidad-acceso/autorizacion/controles")>()),
    exigirAdministrador: mocks.exigirAdministrador,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/infraestructura/imagenes/imagenes", () => ({ imagenes: { eliminar: mocks.eliminarPerfil } }));
vi.mock("@/modulos/publicaciones/operadores/imagenes-publicacion", () => ({
    eliminarImagenPublicacionGestionada: mocks.eliminarImagen,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: {
        transaction: mocks.transaction,
        raw: { sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
            returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
        }) },
    },
}));

describe("baja de operador con autorización y múltiples dependencias", () => {
    let locales: number[];
    let relaciones: { publicacionId: number }[];
    let publicaciones: number[];
    let operadorExiste: boolean;
    let usuarioExiste: boolean;

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.exigirAdministrador.mockResolvedValue(undefined);
        mocks.bloquear.mockReset().mockResolvedValue(undefined);
        mocks.eliminarImagen.mockResolvedValue(undefined);
        mocks.eliminarPerfil.mockResolvedValue(undefined);
        mocks.publicacion.first.mockResolvedValue({ foto: null });
        locales = [10, 11, 12];
        relaciones = [{ publicacionId: 20 }, { publicacionId: 21 }];
        publicaciones = [20, 21];
        operadorExiste = true;
        usuarioExiste = true;

        mocks.operador.first.mockImplementation(async () => operadorExiste ? { id: 14, usuarioId: 90 } : null);
        mocks.relacion.all.mockImplementation(async () => [...relaciones]);
        mocks.local.delete.mockImplementation(async () => { locales.shift(); });
        mocks.local.deleteAll.mockImplementation(async () => { locales = []; });
        mocks.relacion.delete.mockImplementation(async () => { relaciones.shift(); });
        mocks.relacion.deleteAll.mockImplementation(async () => { relaciones = []; });
        mocks.publicacion.delete.mockImplementation(async () => {
            const seleccion = mocks.publicacion.where.mock.lastCall?.[0] as { id: number };
            publicaciones = publicaciones.filter((id) => id !== seleccion.id);
            relaciones = relaciones.filter((relacion) => relacion.publicacionId !== seleccion.id);
        });
        mocks.operador.delete.mockImplementation(async () => {
            if (locales.length || relaciones.length) throw new Error("Dependencias pendientes");
            operadorExiste = false;
        });
        mocks.usuario.delete.mockImplementation(async () => { usuarioExiste = false; });

        mocks.transaction.mockImplementation(async (operaciones: (tx: unknown) => Promise<unknown>) => {
            const copia = { locales: [...locales], relaciones: [...relaciones], publicaciones: [...publicaciones], operadorExiste, usuarioExiste };
            try {
                return await operaciones({ execute: mocks.bloquear, orm: { public: {
                    Operador: mocks.operador,
                    Usuario: mocks.usuario,
                    Local: mocks.local,
                    PublicacionOperador: mocks.relacion,
                    Publicacion: mocks.publicacion,
                } } });
            } catch (error) {
                ({ locales, relaciones, publicaciones, operadorExiste, usuarioExiste } = copia);
                throw error;
            }
        });
    });

    afterEach(() => vi.restoreAllMocks());

    it("impide comenzar la baja cuando falta el permiso administrativo", async () => {
        mocks.exigirAdministrador.mockRejectedValueOnce(new Error("No autorizado"));

        await expect(bajaOperador({ operadorId: 14 })).rejects.toThrow("No autorizado");
        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(mocks.operador.first).not.toHaveBeenCalled();
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
    });

    it("elimina todos los locales, publicaciones y la cuenta del operador", async () => {
        const resultado = await bajaOperador({ operadorId: 14 });

        expect(resultado.esValido).toBe(true);
        expect(locales).toEqual([]);
        expect(relaciones).toEqual([]);
        expect(publicaciones).toEqual([]);
        expect(operadorExiste).toBe(false);
        expect(usuarioExiste).toBe(false);
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/administracion");
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/publicaciones");
        expect(mocks.bloquear).toHaveBeenLastCalledWith({
            texto: "SELECT pg_notify('uam_publicaciones', ?)::text AS notificado",
            valores: [JSON.stringify({ operadorId: 14 })],
        });
        expect(mocks.bloquear.mock.invocationCallOrder.at(-1)).toBeGreaterThan(mocks.usuario.delete.mock.invocationCallOrder.at(-1)!);
    });

    it("incluye las publicaciones confirmadas mientras esperaba el bloqueo del operador", async () => {
        let liberar!: () => void;
        let avisarEspera!: () => void;
        const bloqueo = new Promise<void>((resolve) => { liberar = resolve; });
        const esperando = new Promise<void>((resolve) => { avisarEspera = resolve; });
        mocks.bloquear.mockImplementation(async () => {
            avisarEspera();
            await bloqueo;
        });

        const baja = bajaOperador({ operadorId: 14 });
        await esperando;
        expect(mocks.operador.first).not.toHaveBeenCalled();
        expect(mocks.relacion.all).not.toHaveBeenCalled();
        relaciones.push({ publicacionId: 22 });
        publicaciones.push(22);
        liberar();

        expect((await baja).esValido).toBe(true);
        expect(mocks.bloquear).toHaveBeenCalledWith({
            texto: "SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ?)", valores: [14],
        });
        expect(publicaciones).toEqual([]);
        expect(relaciones).toEqual([]);
        expect(operadorExiste).toBe(false);
        expect(usuarioExiste).toBe(false);
    });

    it("revierte la operación completa si falla la eliminación de la cuenta", async () => {
        mocks.publicacion.first.mockResolvedValue({ foto: "/api/publicaciones/imagenes/20/12345678-1234-4234-8234-123456789abc.png" });
        mocks.usuario.delete.mockRejectedValueOnce(new Error("Fallo de base"));

        await expect(bajaOperador({ operadorId: 14 })).rejects.toThrow("Fallo de base");
        expect(locales).toEqual([10, 11, 12]);
        expect(publicaciones).toEqual([20, 21]);
        expect(operadorExiste).toBe(true);
        expect(usuarioExiste).toBe(true);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
        expect(mocks.bloquear.mock.calls.some(([plan]) => plan.texto.includes("pg_notify"))).toBe(false);
    });

    it("revierte la baja si no se puede notificar el cambio de catálogo", async () => {
        mocks.bloquear.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Fallo al notificar el catálogo"));

        await expect(bajaOperador({ operadorId: 14 })).rejects.toThrow("Fallo al notificar el catálogo");
        expect(locales).toEqual([10, 11, 12]);
        expect(publicaciones).toEqual([20, 21]);
        expect(operadorExiste).toBe(true);
        expect(usuarioExiste).toBe(true);
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(mocks.eliminarImagen).not.toHaveBeenCalled();
    });

    it("limpia las fotos de todas las publicaciones después de confirmar la baja", async () => {
        const foto20 = "/api/publicaciones/imagenes/20/12345678-1234-4234-8234-123456789abc.png";
        const foto21 = "/api/publicaciones/imagenes/21/12345678-1234-4234-8234-123456789abc.png";
        mocks.publicacion.first.mockResolvedValueOnce({ foto: foto20 }).mockResolvedValueOnce({ foto: foto21 });
        let commitTerminado = false;
        const transaccion = mocks.transaction.getMockImplementation()!;
        mocks.transaction.mockImplementation(async (...argumentos) => {
            const resultado = await transaccion(...argumentos);
            commitTerminado = true;
            return resultado;
        });
        mocks.eliminarImagen.mockImplementation(async () => expect(commitTerminado).toBe(true));

        expect((await bajaOperador({ operadorId: 14 })).esValido).toBe(true);
        expect(mocks.eliminarImagen.mock.calls).toEqual([[foto20, 20], [foto21, 21]]);
    });

    it("continúa limpiando las demás fotos cuando un archivo no se puede eliminar", async () => {
        mocks.publicacion.first
            .mockResolvedValueOnce({ foto: "/api/publicaciones/imagenes/20/12345678-1234-4234-8234-123456789abc.png" })
            .mockResolvedValueOnce({ foto: "/api/publicaciones/imagenes/21/12345678-1234-4234-8234-123456789abc.png" });
        mocks.eliminarImagen.mockRejectedValueOnce(new Error("Archivo bloqueado"));
        const registrar = vi.spyOn(console, "error").mockImplementation(() => undefined);

        expect((await bajaOperador({ operadorId: 14 })).esValido).toBe(true);
        expect(mocks.eliminarImagen).toHaveBeenCalledTimes(2);
        expect(operadorExiste).toBe(false);
        expect(registrar).toHaveBeenCalledOnce();
        expect(mocks.revalidatePath).toHaveBeenCalledWith("/publicaciones");
    });

    it("elimina la foto de perfil gestionada después del commit", async () => {
        const fotoPerfil = "/api/imagenes/operadores/14/12345678-1234-4234-8234-123456789abc.webp";
        mocks.operador.first.mockResolvedValue({ id: 14, usuarioId: 90, fotoPerfil });
        mocks.eliminarPerfil.mockImplementation(async () => expect(operadorExiste).toBe(false));
        expect((await bajaOperador({ operadorId: 14 })).esValido).toBe(true);
        expect(mocks.eliminarPerfil).toHaveBeenCalledWith(fotoPerfil, "operadores", 14);
    });

    it("conserva los mensajes de validación y de operador inexistente", async () => {
        expect(await bajaOperador(null)).toEqual({ esValido: false, errores: ["Los datos de la baja no son válidos."] });
        expect(mocks.transaction).not.toHaveBeenCalled();

        operadorExiste = false;
        expect(await bajaOperador({ operadorId: 14 })).toEqual({ esValido: false, errores: ["El operador seleccionado ya no existe."] });
        expect(mocks.revalidatePath).not.toHaveBeenCalled();
        expect(mocks.bloquear.mock.calls.some(([plan]) => plan.texto.includes("pg_notify"))).toBe(false);
    });
});
