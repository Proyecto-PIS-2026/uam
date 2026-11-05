import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { cerrarSesion, obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ cerrarSesion: vi.fn(), obtenerSesion: vi.fn() }));

const atenderSolicitud: (solicitud: Request) => ReturnType<typeof GET> = GET;
const hostPublico = "uam-testing.bravesea-7e3d1ed9.brazilsouth.azurecontainerapps.io";

function solicitudDesdeProxy() {
    return new Request("https://0.0.0.0:3000/sesion-finalizada", {
        headers: { host: hostPublico, "x-forwarded-host": hostPublico, "x-forwarded-proto": "https" },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(cerrarSesion).mockResolvedValue(undefined);
    vi.mocked(obtenerSesion).mockResolvedValue(null);
});

describe("finalización de una sesión inválida", () => {
    it.each([
        ["público", () => new Request("https://uam.test/sesion-finalizada")],
        ["interno detrás del proxy de Azure", solicitudDesdeProxy],
    ] as const)("borra la cookie y redirige al login con una ruta relativa desde el origen %s", async (_, crearSolicitud) => {
        const respuesta = await atenderSolicitud(crearSolicitud());
        expect(cerrarSesion).toHaveBeenCalledOnce();
        expect(respuesta.status).toBe(303);
        expect(respuesta.headers.get("Location")).toBe("/iniciar-sesion");
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    });

    it.each([
        ["OPERADOR", "/mi-mercado"], ["PRODUCTOR", "/mi-mercado/productor"], ["ADMINISTRADOR", "/inicio"],
    ] as const)("conserva una sesión válida de %s aunque llegue una respuesta vieja de otro pedido", async (rol, ruta) => {
        vi.mocked(obtenerSesion).mockResolvedValue({ usuarioId: 1, rol, expiraEn: 2000000000 });
        const respuesta = await atenderSolicitud(solicitudDesdeProxy());
        expect(cerrarSesion).not.toHaveBeenCalled();
        expect(respuesta.status).toBe(303);
        expect(respuesta.headers.get("Location")).toBe(ruta);
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
    });

    it("no borra la sesión ni redirige si no se pudo consultar la base", async () => {
        vi.mocked(obtenerSesion).mockRejectedValue(new Error("ECONNREFUSED"));
        const respuesta = await GET();
        expect(cerrarSesion).not.toHaveBeenCalled();
        expect(respuesta.status).toBe(503);
        expect(respuesta.headers.has("Location")).toBe(false);
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
        expect(await respuesta.text()).toBe("No pudimos verificar tu sesión. Intentá nuevamente.");
    });

    it("no redirige si falla la eliminación de la cookie", async () => {
        vi.mocked(cerrarSesion).mockRejectedValue(new Error("No se pudo modificar la cookie"));
        const respuesta = await GET();
        expect(cerrarSesion).toHaveBeenCalledOnce();
        expect(respuesta.status).toBe(503);
        expect(respuesta.headers.has("Location")).toBe(false);
        expect(respuesta.headers.get("Cache-Control")).toBe("no-store");
        expect(await respuesta.text()).toBe("No pudimos verificar tu sesión. Intentá nuevamente.");
    });
});
