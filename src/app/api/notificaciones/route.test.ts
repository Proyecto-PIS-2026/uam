import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    obtenerSesion: vi.fn(),
    consultar: vi.fn(),
    contar: vi.fn(),
    marcar: vi.fn(),
    eliminar: vi.fn(),
    marcarTodas: vi.fn(),
    eliminarTodas: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: {} }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/modulos/notificaciones/notificaciones", async (importOriginal) => ({
    ...await importOriginal<typeof import("@/modulos/notificaciones/notificaciones")>(),
    consultarNotificaciones: mocks.consultar,
    contarNotificacionesNoLeidas: mocks.contar,
    marcarNotificacionLeida: mocks.marcar,
    eliminarNotificacion: mocks.eliminar,
    marcarTodasNotificacionesLeidas: mocks.marcarTodas,
    eliminarTodasNotificaciones: mocks.eliminarTodas,
}));

import { DELETE, GET, PATCH } from "./route";
import { GET as GETResumen } from "./resumen/route";
import { DELETE as DELETEIndividual, PATCH as PATCHIndividual } from "./[id]/route";
import { ErrorNotificaciones } from "@/modulos/notificaciones/notificaciones";

const sesion = { usuarioId: 12, rol: "PRODUCTOR", expiraEn: 2147483647 } as const;
const contexto = (id: string) => ({ params: Promise.resolve({ id }) });
const solicitud = (metodo: string) => new Request("http://localhost/api/notificaciones/31", { method: metodo });

describe("API de notificaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerSesion.mockResolvedValue(sesion);
        mocks.consultar.mockResolvedValue({ notificaciones: [], noLeidas: 0 });
        mocks.contar.mockResolvedValue(2);
        mocks.marcar.mockResolvedValue(1);
        mocks.eliminar.mockResolvedValue(1);
        mocks.marcarTodas.mockResolvedValue(0);
        mocks.eliminarTodas.mockResolvedValue(0);
    });

    it("lista los avisos de la sesión y evita almacenarlos en cachés compartidas", async () => {
        const datos = { notificaciones: [{ id: 31, texto: "Aviso", url: "/inicio", leida: false, fecha: "2026-10-27T00:00:00Z" }], noLeidas: 1 };
        mocks.consultar.mockResolvedValue(datos);
        const respuesta = await GET();
        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual(datos);
        expect(mocks.consultar).toHaveBeenCalledWith(sesion);
        expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        expect(respuesta.headers.get("Vary")).toBe("Cookie");
    });

    it("obtiene sólo el contador mediante la consulta de resumen", async () => {
        const respuesta = await GETResumen();
        expect(await respuesta.json()).toEqual({ noLeidas: 2 });
        expect(mocks.contar).toHaveBeenCalledWith(sesion);
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("las acciones masivas usan exclusivamente el dueño de la sesión", async () => {
        expect(await (await PATCH()).json()).toEqual({ noLeidas: 0 });
        expect(await (await DELETE()).json()).toEqual({ noLeidas: 0 });
        expect(mocks.marcarTodas).toHaveBeenCalledWith(sesion);
        expect(mocks.eliminarTodas).toHaveBeenCalledWith(sesion);
    });

    it("las acciones individuales usan el id de la ruta y la sesión, sin aceptar otro destinatario", async () => {
        const request = new Request("http://localhost/api/notificaciones/31?usuarioId=99", {
            method: "PATCH", body: JSON.stringify({ usuarioId: 99 }), headers: { "Content-Type": "application/json" },
        });
        expect(await (await PATCHIndividual(request, contexto("31"))).json()).toEqual({ noLeidas: 1 });
        expect(await (await DELETEIndividual(solicitud("DELETE"), contexto("31"))).json()).toEqual({ noLeidas: 1 });
        expect(mocks.marcar).toHaveBeenCalledWith(sesion, 31);
        expect(mocks.eliminar).toHaveBeenCalledWith(sesion, 31);
    });

    it.each(["0", "-1", "1.5", "1e2", "NaN", "2147483648", "01", "", " 1"])("rechaza el id %s sin llamar a la mutación", async (id) => {
        expect((await PATCHIndividual(solicitud("PATCH"), contexto(id))).status).toBe(400);
        expect((await DELETEIndividual(solicitud("DELETE"), contexto(id))).status).toBe(400);
        expect(mocks.marcar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it("devuelve 401 sin sesión antes de procesar un id individual", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);
        expect((await PATCHIndividual(solicitud("PATCH"), contexto("31"))).status).toBe(401);
        expect((await DELETEIndividual(solicitud("DELETE"), contexto("no-valido"))).status).toBe(401);
        expect(mocks.marcar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
    });

    it("conserva el 401 del servicio en consultas y acciones masivas", async () => {
        mocks.obtenerSesion.mockResolvedValue(null);
        const error = new ErrorNotificaciones(401, "Iniciá sesión.");
        for (const mock of [mocks.consultar, mocks.contar, mocks.marcarTodas, mocks.eliminarTodas]) mock.mockRejectedValue(error);
        for (const accion of [GET, GETResumen, PATCH, DELETE]) expect((await accion()).status).toBe(401);
    });

    it("no distingue ante el cliente entre un aviso ajeno y uno inexistente", async () => {
        const error = new ErrorNotificaciones(404, "La notificación no existe.");
        mocks.marcar.mockRejectedValue(error);
        mocks.eliminar.mockRejectedValue(error);
        const marcada = await PATCHIndividual(solicitud("PATCH"), contexto("31"));
        const eliminada = await DELETEIndividual(solicitud("DELETE"), contexto("31"));
        expect(marcada.status).toBe(404);
        expect(eliminada.status).toBe(404);
        expect(await marcada.json()).toEqual(await eliminada.json());
    });

    it("responde con un mensaje genérico cuando falla la persistencia", async () => {
        const consola = vi.spyOn(console, "error").mockImplementation(() => {});
        try {
            mocks.consultar.mockRejectedValue(new Error("Detalle privado de la base"));
            const respuesta = await GET();
            expect(respuesta.status).toBe(500);
            expect(await respuesta.text()).not.toContain("Detalle privado");
            expect(respuesta.headers.get("Cache-Control")).toBe("private, no-store");
        } finally {
            consola.mockRestore();
        }
    });
});
