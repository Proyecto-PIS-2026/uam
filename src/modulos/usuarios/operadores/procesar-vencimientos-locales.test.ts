import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextoTareaDiaria } from "@/infraestructura/tareas-programadas/tipos";
import { procesarVencimientosLocales } from "./procesar-vencimientos-locales";

const mocks = vi.hoisted(() => ({
    query: vi.fn(), execute: vi.fn(), enviarNotificacion: vi.fn(), borrarMarca: vi.fn(), seleccionarMarca: vi.fn(),
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { raw: {
        sql: (fragmentos: TemplateStringsArray, ...valores: unknown[]) => ({
            returnsRow: () => ({ build: () => ({ sql: fragmentos.join("?"), valores }) }),
        }),
    } },
}));
vi.mock("@/modulos/notificaciones/notificaciones", () => ({ enviarNotificacion: mocks.enviarNotificacion }));

const tx = {
    query: mocks.query, execute: mocks.execute,
    orm: { public: { AvisoVencimientoLocal: { where: mocks.seleccionarMarca } } },
} as unknown as ContextoTareaDiaria["tx"];
const contexto = { tx, fecha: "2026-11-06", limite: "2026-11-06T15:00:00Z" };
const configuracion = { habilitado: true, diasAnticipacionAviso: 3 };
const local = {
    id: 41, naveId: 2, numeroLocal: "12", nombreNave: "Nave A", nombreFantasia: "Jorge Ferias",
    finContrato: { toString: () => "2026-11-10T02:59:59Z" }, vencimiento: "09/11/2026", vencido: false,
};

function prepararLocal(vencido = false, reservado = true) {
    mocks.query.mockResolvedValueOnce([{ operadorId: 7 }])
        .mockResolvedValueOnce([{ ...local, vencido }])
        .mockResolvedValueOnce(reservado ? [{ id: 25 }] : []);
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.execute.mockResolvedValue(undefined);
    mocks.enviarNotificacion.mockResolvedValue({ enviadas: 2 });
    mocks.seleccionarMarca.mockReturnValue({ delete: mocks.borrarMarca });
    mocks.borrarMarca.mockResolvedValue(undefined);
});

describe("avisos de contratos de locales", () => {
    it("deshabilitado no consulta ni modifica la base ni envía avisos", async () => {
        expect(await procesarVencimientosLocales(contexto, { ...configuracion, habilitado: false })).toBe(0);
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.execute).not.toHaveBeenCalled();
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
    });

    it.each([-1, 1.5, 366, NaN, Infinity])("rechaza la anticipación inválida %s sin acceder a la base", async (diasAnticipacionAviso) => {
        await expect(procesarVencimientosLocales(contexto, { ...configuracion, diasAnticipacionAviso })).rejects.toThrow("anticipación");
        expect(mocks.query).not.toHaveBeenCalled();
        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
    });

    it.each([
        { vencido: false, verbo: "vence" },
        { vencido: true, verbo: "venció" },
    ])("envía el aviso '$verbo' a administradores con el perfil administrativo del operador", async ({ vencido, verbo }) => {
        prepararLocal(vencido);

        expect(await procesarVencimientosLocales(contexto, configuracion)).toBe(1);

        expect(mocks.enviarNotificacion).toHaveBeenCalledExactlyOnceWith({
            texto: `El contrato del local 12 de la nave Nave A, del operador Jorge Ferias ${verbo} el 09/11/2026.`,
            url: "/gestion-operadores/7",
            roles: ["ADMINISTRADOR"],
        }, tx);
    });

    it("no reenvía el aviso si el contrato ya tiene registrado ese evento", async () => {
        prepararLocal(false, false);

        expect(await procesarVencimientosLocales(contexto, configuracion)).toBe(0);

        expect(mocks.enviarNotificacion).not.toHaveBeenCalled();
        expect(mocks.borrarMarca).not.toHaveBeenCalled();
    });

    it("si no hay destinatarios libera la marca para volver a intentar el envío", async () => {
        prepararLocal();
        mocks.enviarNotificacion.mockResolvedValue({ enviadas: 0 });

        expect(await procesarVencimientosLocales(contexto, configuracion)).toBe(0);

        expect(mocks.seleccionarMarca).toHaveBeenCalledExactlyOnceWith({ id: 25 });
        expect(mocks.borrarMarca).toHaveBeenCalledOnce();
    });

    it("propaga errores de envío para que el planificador revierta la transacción y reintente", async () => {
        prepararLocal();
        const error = new Error("No se pudo crear la notificación");
        mocks.enviarNotificacion.mockRejectedValue(error);

        await expect(procesarVencimientosLocales(contexto, configuracion)).rejects.toBe(error);

        expect(mocks.borrarMarca).not.toHaveBeenCalled();
    });
});
