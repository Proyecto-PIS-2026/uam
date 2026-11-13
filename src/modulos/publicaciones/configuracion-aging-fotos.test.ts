import { beforeEach, describe, expect, it, vi } from "vitest";
import { obtenerConfiguracionAgingFotos } from "./configuracion-aging-fotos";

const mocks = vi.hoisted(() => ({ consultar: vi.fn() }));
vi.mock("../administracion/acciones/consultas-configuracion", () => ({ default: mocks.consultar }));

function guardarValores(valores: Record<string, string | null>) {
    mocks.consultar.mockResolvedValue(Object.entries(valores).map(([nombreConfiguracion, valorConfiguracion]) => ({
        nombreConfiguracion,
        valorConfiguracion,
    })));
}

const activa = {
    aging_fotos_habilitado: "true",
    vigencia_fotos: "30",
    aviso_vencimiento_fotos_habilitado: "true",
    anticipacion_aviso_fotos: "7",
};

beforeEach(() => {
    vi.resetAllMocks();
    guardarValores(activa);
});

describe("configuración administrativa del aging de fotos", () => {
    it("consulta los plazos de productores sin reutilizar los de operadores", async () => {
        guardarValores({
            ...activa,
            aging_fotos_productor_habilitado: "true",
            vigencia_fotos_productor: "15",
            aviso_vencimiento_fotos_productor_habilitado: "true",
            anticipacion_aviso_fotos_productor: "3",
        });

        await expect(obtenerConfiguracionAgingFotos("PRODUCTOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 15, avisosHabilitados: true, diasAnticipacionAviso: 3,
        });
        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith([
            "aging_fotos_productor_habilitado", "vigencia_fotos_productor",
            "aviso_vencimiento_fotos_productor_habilitado", "anticipacion_aviso_fotos_productor",
        ]);
        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 30, avisosHabilitados: true, diasAnticipacionAviso: 7,
        });
    });

    it.each([undefined, "false"])("no activa productores por la política de operadores si la propia está %s", async (habilitado) => {
        guardarValores({ ...activa, ...(habilitado === undefined ? {} : { aging_fotos_productor_habilitado: habilitado }) });

        await expect(obtenerConfiguracionAgingFotos("PRODUCTOR")).resolves.toEqual({ habilitado: false });
    });

    it("una política inválida de operadores no impide leer la política válida de productores", async () => {
        guardarValores({
            ...activa, vigencia_fotos: "inválida",
            aging_fotos_productor_habilitado: "true", vigencia_fotos_productor: "1",
            aviso_vencimiento_fotos_productor_habilitado: "false", anticipacion_aviso_fotos_productor: "",
        });

        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).rejects.toThrow("La vigencia de las fotos");
        await expect(obtenerConfiguracionAgingFotos("PRODUCTOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 1, avisosHabilitados: false, diasAnticipacionAviso: 0,
        });
    });

    it("valida la anticipación del productor contra su propia vigencia", async () => {
        guardarValores({
            ...activa,
            aging_fotos_productor_habilitado: "true", vigencia_fotos_productor: "5",
            aviso_vencimiento_fotos_productor_habilitado: "true", anticipacion_aviso_fotos_productor: "7",
        });

        await expect(obtenerConfiguracionAgingFotos("PRODUCTOR")).rejects.toThrow("La anticipación del aviso");
    });

    it("lee las cuatro opciones del panel en una sola consulta", async () => {
        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 30, avisosHabilitados: true, diasAnticipacionAviso: 7,
        });
        expect(mocks.consultar).toHaveBeenCalledExactlyOnceWith([
            "aging_fotos_habilitado", "vigencia_fotos", "aviso_vencimiento_fotos_habilitado", "anticipacion_aviso_fotos",
        ]);
    });

    it("toma los cambios administrativos sin reiniciar ni conservar valores anteriores", async () => {
        await obtenerConfiguracionAgingFotos("OPERADOR");
        guardarValores({ ...activa, vigencia_fotos: "60", anticipacion_aviso_fotos: "10" });

        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 60, avisosHabilitados: true, diasAnticipacionAviso: 10,
        });
        guardarValores({ ...activa, aging_fotos_habilitado: "false" });
        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({ habilitado: false });
        expect(mocks.consultar).toHaveBeenCalledTimes(3);
    });

    it.each<Record<string, string | null>>([{}, { aging_fotos_habilitado: null }, { aging_fotos_habilitado: "false", vigencia_fotos: "", aviso_vencimiento_fotos_habilitado: "false", anticipacion_aviso_fotos: "" }])(
        "no activa el aging con configuración ausente o deshabilitada: %j", async (valores) => {
            guardarValores(valores);

            await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({ habilitado: false });
        },
    );

    it("permite vencimientos de un día con avisos deshabilitados y anticipación vacía", async () => {
        guardarValores({ ...activa, vigencia_fotos: "1", aviso_vencimiento_fotos_habilitado: "false", anticipacion_aviso_fotos: "" });

        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 1, avisosHabilitados: false, diasAnticipacionAviso: 0,
        });
    });

    it("no activa avisos si todavía no está su opción en la base", async () => {
        guardarValores({ aging_fotos_habilitado: "true", vigencia_fotos: "3" });

        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).resolves.toEqual({
            habilitado: true, diasVigencia: 3, avisosHabilitados: false, diasAnticipacionAviso: 0,
        });
    });

    it.each(["", "TRUE", "1", "yes"])("rechaza habilitación inválida %s sin activar un valor por defecto", async (valor) => {
        guardarValores({ ...activa, aging_fotos_habilitado: valor });
        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).rejects.toThrow("La habilitación");
        guardarValores({ ...activa, aviso_vencimiento_fotos_habilitado: valor });
        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).rejects.toThrow("La habilitación");
    });

    it.each([null, "", "0", "-1", "1.5", "3e1", " 30", "36501", "9007199254740992"])(
        "rechaza vigencia activa inválida: %s", async (valor) => {
            guardarValores({ ...activa, vigencia_fotos: valor });

            await expect(obtenerConfiguracionAgingFotos("OPERADOR")).rejects.toThrow("La vigencia de las fotos");
        },
    );

    it.each([null, "", "0", "-1", "1.5", "1e1", " 7", "30", "31"])(
        "rechaza anticipación activa inválida: %s", async (valor) => {
            guardarValores({ ...activa, anticipacion_aviso_fotos: valor });

            await expect(obtenerConfiguracionAgingFotos("OPERADOR")).rejects.toThrow("La anticipación del aviso");
        },
    );

    it("propaga un fallo de lectura para que la tarea no borre fotos usando una configuración supuesta", async () => {
        mocks.consultar.mockRejectedValue(new Error("Base de datos no disponible"));

        await expect(obtenerConfiguracionAgingFotos("OPERADOR")).rejects.toThrow("Base de datos no disponible");
    });
});
