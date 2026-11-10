import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { iniciarTareasEnServidor } from "./iniciar-en-servidor";

const mocks = vi.hoisted(() => ({ iniciar: vi.fn(), obtenerTareas: vi.fn() }));
vi.mock("./planificador", () => ({ iniciarPlanificadorTareas: mocks.iniciar }));
vi.mock("./registro", () => ({ obtenerTareasDiarias: mocks.obtenerTareas }));

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("DATABASE_URL", "postgresql://unit:unit@127.0.0.1:1/uam_unit");
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("inicio del planificador independiente del aging", () => {
    it("inicia el planificador con las tareas registradas", async () => {
        const tareas = [{ nombre: "otra-tarea", ejecutar: vi.fn() }];
        mocks.obtenerTareas.mockReturnValue(tareas);

        await iniciarTareasEnServidor();

        expect(mocks.iniciar).toHaveBeenCalledWith(tareas);
    });

    it("omite el inicio si no hay conexión de base de datos configurada", async () => {
        vi.stubEnv("DATABASE_URL", " ");
        const registrar = vi.spyOn(console, "warn").mockImplementation(() => undefined);

        await iniciarTareasEnServidor();

        expect(mocks.iniciar).not.toHaveBeenCalled();
        expect(mocks.obtenerTareas).not.toHaveBeenCalled();
        expect(registrar).toHaveBeenCalledWith(expect.stringContaining("DATABASE_URL"));
    });
});
