import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
import { agregarEstadoVigenciaPropias, obtenerConfiguracionAvisosVigencia } from "./estado-vigencia-propias";

const mocks = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: { Configuracion: {
        where: ({ nombreConfiguracion }: { nombreConfiguracion: string }) => ({
            select: () => ({ first: () => mocks.consultar(nombreConfiguracion) }),
        }),
    } } } },
}));

const ahora = Temporal.Instant.from("2026-11-04T15:00:00Z");
const valores = new Map<string, string>();

beforeEach(() => {
    vi.clearAllMocks();
    valores.clear();
    mocks.consultar.mockImplementation(async (nombre: string) => valores.has(nombre)
        ? { valorConfiguracion: valores.get(nombre) }
        : null);
    vi.spyOn(Temporal.Now, "instant").mockReturnValue(ahora);
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("estado de vigencia en publicaciones propias", () => {
    it.each(["OPERADOR", "PRODUCTOR"] as const)("usa valores predeterminados cuando faltan las configuraciones de %s", async (tipo) => {
        expect(await obtenerConfiguracionAvisosVigencia(tipo)).toEqual({ avisosHabilitados: true, diasAnticipacion: 7 });
    });

    it("usa los días de aviso propios de cada rol", async () => {
        valores.set("anticipacion_aviso_publicaciones_operador", "2");
        valores.set("anticipacion_aviso_publicaciones_productor", "10");
        const publicaciones = [{ id: 1, fechaVigencia: ahora.add({ hours: 5 * 24 }) }];

        const [operador] = await agregarEstadoVigenciaPropias(publicaciones, "OPERADOR");
        const [productor] = await agregarEstadoVigenciaPropias(publicaciones, "PRODUCTOR");

        expect(operador.estadoVigencia).toBeNull();
        expect(productor.estadoVigencia).toBe("por-vencer");
        expect(mocks.consultar.mock.calls.map(([nombre]) => nombre)).toEqual([
            "aviso_vencimiento_publicaciones_operador_habilitado", "anticipacion_aviso_publicaciones_operador",
            "aviso_vencimiento_publicaciones_productor_habilitado", "anticipacion_aviso_publicaciones_productor",
        ]);
    });

    it.each(["operador", "productor"] as const)("mantiene el aviso del %s aunque la vigencia administrativa esté deshabilitada", async (rol) => {
        valores.set(`vigencia_publicaciones_${rol}_habilitada`, "false");
        valores.set(`aviso_vencimiento_publicaciones_${rol}_habilitado`, "true");
        valores.set(`anticipacion_aviso_publicaciones_${rol}`, "3");

        const [publicacion] = await agregarEstadoVigenciaPropias([{ fechaVigencia: "2026-11-05" }], rol === "operador" ? "OPERADOR" : "PRODUCTOR");

        expect(publicacion.estadoVigencia).toBe("por-vencer");
        expect(mocks.consultar).not.toHaveBeenCalledWith(`vigencia_publicaciones_${rol}_habilitada`);
    });

    it("desactivar avisos de un rol no desactiva los del otro ni oculta publicaciones vencidas", async () => {
        valores.set("aviso_vencimiento_publicaciones_operador_habilitado", "false");
        valores.set("aviso_vencimiento_publicaciones_productor_habilitado", "true");
        const publicaciones = [{ fechaVigencia: "2026-11-05" }, { fechaVigencia: "2026-11-03" }];

        expect((await agregarEstadoVigenciaPropias(publicaciones, "OPERADOR")).map(({ estadoVigencia }) => estadoVigencia))
            .toEqual([null, "vencida"]);
        expect((await agregarEstadoVigenciaPropias(publicaciones, "PRODUCTOR")).map(({ estadoVigencia }) => estadoVigencia))
            .toEqual(["por-vencer", "vencida"]);
    });

    it("no consulta configuración si no hay publicaciones o ninguna tiene fecha de vigencia", async () => {
        expect(await agregarEstadoVigenciaPropias([], "OPERADOR")).toEqual([]);
        expect(await agregarEstadoVigenciaPropias([{ id: 1, fechaVigencia: null }, { id: 2, fechaVigencia: undefined }], "PRODUCTOR"))
            .toEqual([{ id: 1, fechaVigencia: null, estadoVigencia: null }, { id: 2, fechaVigencia: undefined, estadoVigencia: null }]);
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("no necesita configuración para identificar publicaciones ya vencidas", async () => {
        const [publicacion] = await agregarEstadoVigenciaPropias([{ fechaVigencia: "2026-11-03" }], "OPERADOR");

        expect(publicacion.estadoVigencia).toBe("vencida");
        expect(mocks.consultar).not.toHaveBeenCalled();
    });

    it("recalcula estados anteriores sin mutar las publicaciones ni perder datos", async () => {
        const publicaciones = [
            { id: 1, fechaVigencia: "2026-11-20", precio: "125", version: 4, estadoFoto: "por-vencer", estadoVigencia: "vencida" },
            { id: 2, fechaVigencia: "2026-11-05", precio: null, version: 2, estadoFoto: null, estadoVigencia: null },
        ];

        const resultado = await agregarEstadoVigenciaPropias(publicaciones, "OPERADOR");

        expect(resultado).toEqual([
            { ...publicaciones[0], estadoVigencia: null },
            { ...publicaciones[1], estadoVigencia: "por-vencer" },
        ]);
        expect(publicaciones[0].estadoVigencia).toBe("vencida");
        expect(publicaciones[1].estadoVigencia).toBeNull();
    });
});
