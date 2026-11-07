import { beforeEach, expect, it, vi } from "vitest";
import { estaHabilitadoCambioContrasena } from "./configuracion";

const mocks = vi.hoisted(() => ({ where: vi.fn(), select: vi.fn(), first: vi.fn() }));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: { Configuracion: mocks } } } }));
beforeEach(() => {
    vi.resetAllMocks();
    mocks.where.mockReturnThis();
    mocks.select.mockReturnThis();
});

it.each([true, false])("respeta el valor administrativo habilitado=%s", async (habilitado) => {
    mocks.first.mockResolvedValue({ valorConfiguracion: String(habilitado) });
    expect(await estaHabilitadoCambioContrasena()).toBe(habilitado);
    expect(mocks.where).toHaveBeenCalledWith({ nombreConfiguracion: "restablecimiento_contrasena_habilitado" });
});

it("no habilita el cambio si falta la configuración", async () => {
    mocks.first.mockResolvedValue(null);
    expect(await estaHabilitadoCambioContrasena()).toBe(false);
});

it("lee otra vez la configuración para respetar cambios sin reiniciar el servidor", async () => {
    mocks.first.mockResolvedValueOnce({ valorConfiguracion: "true" }).mockResolvedValueOnce({ valorConfiguracion: "false" });
    expect(await estaHabilitadoCambioContrasena()).toBe(true);
    expect(await estaHabilitadoCambioContrasena()).toBe(false);
});
