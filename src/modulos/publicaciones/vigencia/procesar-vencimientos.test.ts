import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ContextoTareaDiaria } from "@/infraestructura/tareas-programadas/tipos";
import { procesarVencimientosPublicaciones } from "./procesar-vencimientos";

const mocks = vi.hoisted(() => ({
    query: vi.fn(), execute: vi.fn(), configuracion: vi.fn(), enviar: vi.fn(), operador: vi.fn(), productor: vi.fn(),
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { raw: {
    sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
        returnsRow: () => ({ build: () => ({ sql: partes.join("?"), valores }) }),
    }),
} } }));
vi.mock("./estado-vigencia-propias", () => ({ obtenerConfiguracionAvisosVigencia: mocks.configuracion }));
vi.mock("@/modulos/notificaciones/notificaciones", () => ({ enviarNotificacion: mocks.enviar }));
vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({
    notificarCambioCatalogoOperador: mocks.operador, notificarCambioCatalogoProductor: mocks.productor,
}));

const contexto: ContextoTareaDiaria = {
    tx: { query: mocks.query, execute: mocks.execute } as unknown as ContextoTareaDiaria["tx"],
    fecha: "2026-11-04", limite: "2026-11-04T03:00:00Z",
};
const base = {
    id: 10, publicacionDisponible: true, usuarioId: 20, nombreEspecie: "Tomate", vencimiento: "2026-11-03",
    vencida: true, avisoProximoEnviado: false, avisoVencidoEnviado: false,
};
function preparar(publicaciones: Partial<typeof base>[] = [{}]) {
    mocks.query.mockResolvedValueOnce([{ propietarioId: 7 }])
        .mockResolvedValueOnce(publicaciones.map((p) => ({ ...base, ...p })));
}
function escrituras() {
    return mocks.execute.mock.calls.map(([consulta]) => consulta as { sql: string; valores: unknown[] });
}

beforeEach(() => {
    vi.resetAllMocks();
    mocks.query.mockResolvedValue([]);
    mocks.execute.mockResolvedValue([]);
    mocks.configuracion.mockResolvedValue({ avisosHabilitados: true, diasAnticipacion: 7 });
    mocks.enviar.mockResolvedValue({ enviadas: 1 });
});

describe.each(["OPERADOR", "PRODUCTOR"] as const)("tarea diaria de vigencia de %s", (tipo) => {
    const ruta = tipo === "OPERADOR" ? "/mi-mercado" : "/mi-mercado/productor";

    it("procesa al dueño sin consultar una sesión ni depender de que abra notificaciones", async () => {
        preparar();

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(1);

        expect(mocks.configuracion).toHaveBeenCalledExactlyOnceWith(tipo, contexto.tx);
        expect(mocks.enviar).toHaveBeenCalledExactlyOnceWith({
            texto: "Tu publicación de Tomate ha vencido el 2026-11-03 y ya no está disponible.",
            usuarios: [20], url: ruta + "?publicacion=10",
        }, contexto.tx);
        expect(escrituras()).toEqual(expect.arrayContaining([
            expect.objectContaining({ sql: expect.stringContaining('SET "publicacionDisponible" = false'), valores: [10] }),
            expect.objectContaining({ sql: expect.stringContaining('SET "avisoVencimientoEn"'), valores: [contexto.limite, 10] }),
        ]));
        expect(tipo === "OPERADOR" ? mocks.operador : mocks.productor).toHaveBeenCalledExactlyOnceWith(contexto.tx, 7);
        expect(tipo === "OPERADOR" ? mocks.productor : mocks.operador).not.toHaveBeenCalled();
    });

    it("sigue venciendo publicaciones aunque los avisos previos estén deshabilitados", async () => {
        mocks.configuracion.mockResolvedValue({ avisosHabilitados: false, diasAnticipacion: 7 });
        preparar();

        await procesarVencimientosPublicaciones(contexto, tipo);

        expect(mocks.enviar).toHaveBeenCalledOnce();
        expect(escrituras().some(c => c.sql.includes('SET "publicacionDisponible" = false'))).toBe(true);
        expect(mocks.query.mock.calls[0][0].valores).toContain(false);
    });

    it("notifica el vencimiento de una publicación ya no disponible sin emitir un cambio de catálogo", async () => {
        preparar([{ publicacionDisponible: false }]);

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(1);

        expect(mocks.enviar).toHaveBeenCalledOnce();
        expect(escrituras().some(c => c.sql.includes('SET "publicacionDisponible"'))).toBe(false);
        expect(mocks.operador).not.toHaveBeenCalled();
        expect(mocks.productor).not.toHaveBeenCalled();
    });

    it("un aviso de vencimiento anterior no impide corregir la disponibilidad ni se repite", async () => {
        preparar([{ avisoVencidoEnviado: true }]);

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(1);

        expect(mocks.enviar).not.toHaveBeenCalled();
        expect(escrituras().some(c => c.sql.includes('SET "publicacionDisponible" = false'))).toBe(true);
        expect(escrituras().some(c => c.sql.includes('SET "avisoVencimientoEn"'))).toBe(false);
    });

    it("avisa próximas a vencer sin cambiar disponibilidad, fecha, versión ni estadísticas", async () => {
        preparar([{ vencida: false, vencimiento: "2026-11-11" }]);

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(1);

        expect(mocks.enviar).toHaveBeenCalledExactlyOnceWith({
            texto: "Tu publicación de Tomate está próxima a vencer el 2026-11-11.", usuarios: [20], url: ruta + "?publicacion=10",
        }, contexto.tx);
        const actualizaciones = escrituras().filter(c => c.sql.includes("UPDATE"));
        expect(actualizaciones).toHaveLength(1);
        expect(actualizaciones[0].sql).toContain('SET "avisoProximoVencimientoEn"');
        expect(actualizaciones[0].sql).not.toMatch(/\bfecha\s*=|\bversion\s*=|estadistica|publicacionDisponible/i);
        expect(mocks.operador).not.toHaveBeenCalled();
        expect(mocks.productor).not.toHaveBeenCalled();
    });

    it("revisa los siete días calendario desde las 00 de Uruguay incluyendo todo el último día", async () => {
        await procesarVencimientosPublicaciones(contexto, tipo);

        const consulta = mocks.query.mock.calls[0][0];
        expect(consulta.valores).toContain("America/Montevideo");
        expect(consulta.valores).toContain("2026-11-11");
        expect(consulta.valores).toContain("2026-11-04T03:00:00Z");
        expect(consulta.sql).toContain('p."fechaVigencia" IS NOT NULL');
    });

    it("no repite marcas ya enviadas aunque se hayan borrado las notificaciones", async () => {
        preparar([
            { publicacionDisponible: false, avisoVencidoEnviado: true },
            { id: 11, vencida: false, avisoProximoEnviado: true },
        ]);

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(0);

        expect(mocks.enviar).not.toHaveBeenCalled();
        expect(escrituras().some(c => c.sql.includes("UPDATE"))).toBe(false);
    });

    it("notifica dos publicaciones de igual especie y fecha por separado y emite un solo evento por dueño", async () => {
        preparar([{}, { id: 11 }]);

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(2);

        expect(mocks.enviar.mock.calls.map(([entrada]) => entrada.url)).toEqual([ruta + "?publicacion=10", ruta + "?publicacion=11"]);
        expect(tipo === "OPERADOR" ? mocks.operador : mocks.productor).toHaveBeenCalledOnce();
    });

    it("relee publicaciones después del bloqueo y respeta las renovadas o eliminadas mientras esperaba", async () => {
        preparar([]);

        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(0);

        expect(escrituras()[0].sql).toContain("pg_advisory_xact_lock_shared(1722, 0)");
        expect(mocks.execute.mock.invocationCallOrder[0]).toBeLessThan(mocks.configuracion.mock.invocationCallOrder[0]);
        expect(escrituras()[1].valores).toEqual([tipo === "OPERADOR" ? 1719 : 1720, 7]);
        expect(mocks.execute.mock.invocationCallOrder[1]).toBeLessThan(mocks.query.mock.invocationCallOrder[1]);
        const consulta = mocks.query.mock.calls[1][0];
        expect(consulta.sql).toContain("FOR UPDATE OF p");
        expect(consulta.sql).toContain('p."avisoVencimientoEn" IS NULL');
        expect(mocks.enviar).not.toHaveBeenCalled();
    });

    it("si no hay candidatos solo coordina la política, sin bloquear dueños ni modificar datos", async () => {
        expect(await procesarVencimientosPublicaciones(contexto, tipo)).toBe(0);
        expect(mocks.execute).toHaveBeenCalledOnce();
        expect(escrituras()[0].sql).toContain("pg_advisory_xact_lock_shared(1722, 0)");
        expect(mocks.enviar).not.toHaveBeenCalled();
    });

    it("propaga fallos de envío para revertir la tarea y permitir el reintento del planificador", async () => {
        preparar([{ vencida: false }]);
        const error = new Error("Error de notificación");
        mocks.enviar.mockRejectedValue(error);

        await expect(procesarVencimientosPublicaciones(contexto, tipo)).rejects.toBe(error);

        expect(escrituras().some(c => c.sql.includes("UPDATE"))).toBe(false);
    });

    it("no marca la tarea como completada si no se pudo crear el aviso del destinatario", async () => {
        preparar([{ vencida: false }]);
        mocks.enviar.mockResolvedValue({ enviadas: 0 });

        await expect(procesarVencimientosPublicaciones(contexto, tipo)).rejects.toThrow("No se pudo guardar el aviso");

        expect(escrituras().some(c => c.sql.includes("UPDATE"))).toBe(false);
    });
});
