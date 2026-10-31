import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { cerrarSesion, obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ cerrarSesion: vi.fn(), obtenerSesion: vi.fn() }));

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cerrarSesion).mockResolvedValue(undefined);
    vi.mocked(obtenerSesion).mockResolvedValue(null);
});

describe("finalización de una sesión inválida", () => {
    it("borra la cookie y redirige al login sin permitir guardar la respuesta en caché", async () => {
        const respuesta = await GET(new Request("https://uam.test/sesion-finalizada"));
        expect(cerrarSesion).toHaveBeenCalledOnce();
        expect(respuesta.status).toBe(303);
        expect(respuesta.headers.get("Location")).toBe("https://uam.test/iniciar-sesion");
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    });

    it.each([
        ["OPERADOR", "/mi-mercado"], ["PRODUCTOR", "/mi-mercado/productor"], ["ADMINISTRADOR", "/inicio"],
    ] as const)("conserva una sesión válida de %s aunque llegue una respuesta vieja de otro pedido", async (rol, ruta) => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2000000000 });
        const respuesta = await GET(new Request("https://uam.test/sesion-finalizada"));
        expect(cerrarSesion).not.toHaveBeenCalled();
        expect(respuesta.status).toBe(303);
        expect(respuesta.headers.get("Location")).toBe(`https://uam.test${ruta}`);
    });

    it("no borra la sesión ni redirige si no se pudo consultar la base", async () => {
        vi.mocked(obtenerSesion).mockRejectedValue(new Error("ECONNREFUSED"));
        const respuesta = await GET(new Request("https://uam.test/sesion-finalizada"));
        expect(cerrarSesion).not.toHaveBeenCalled();
        expect(respuesta.status).toBe(503);
        expect(respuesta.headers.has("Location")).toBe(false);
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
        expect(await respuesta.text()).toBe("No pudimos verificar tu sesión. Intentá nuevamente.");
    });
});
