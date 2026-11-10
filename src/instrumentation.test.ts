import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { register } from "./instrumentation";

const mocks = vi.hoisted(() => ({ iniciar: vi.fn() }));
vi.mock("./infraestructura/tareas-programadas/iniciar-en-servidor", () => ({ iniciarTareasEnServidor: mocks.iniciar }));

beforeEach(() => {
    vi.resetAllMocks();
    vi.stubEnv("NEXT_RUNTIME", "nodejs");
    vi.stubEnv("NEXT_PHASE", undefined);
    vi.stubEnv("NEXT_PRIVATE_BUILD_WORKER", undefined);
    vi.stubEnv("NODE_ENV", "production");
    mocks.iniciar.mockResolvedValue(undefined);
});

afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
});

describe("inicio de las tareas internas", () => {
    it("inicia en producción sin requerir configuración de tareas en el entorno", async () => {
        register();
        await vi.waitFor(() => expect(mocks.iniciar).toHaveBeenCalledOnce());
    });

    it.each([
        ["NEXT_RUNTIME", "edge"],
        ["NEXT_PHASE", "phase-production-build"],
        ["NEXT_PHASE", "phase-export"],
        ["NEXT_PRIVATE_BUILD_WORKER", "1"],
        ["NODE_ENV", "test"],
    ])("no procesa fotos cuando %s es %s", async (variable, valor) => {
        vi.stubEnv(variable, valor);
        register();
        await vi.dynamicImportSettled();
        expect(mocks.iniciar).not.toHaveBeenCalled();
    });

    it("registra un fallo de arranque sin impedir que la aplicación continúe", async () => {
        const error = new Error("No se pudo iniciar el planificador");
        mocks.iniciar.mockRejectedValue(error);
        const registrar = vi.spyOn(console, "error").mockImplementation(() => {});
        register();
        await vi.waitFor(() => expect(registrar).toHaveBeenCalledWith(
            expect.stringContaining("La aplicación continuará funcionando"), error,
        ));
    });
});
