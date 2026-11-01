import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const reemplazar = vi.fn();
const fetchSimulado = vi.fn<typeof fetch>();

beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("window", { location: { href: "https://uam.test/mi-mercado", origin: "https://uam.test", replace: reemplazar } });
    vi.stubGlobal("fetch", fetchSimulado);
});

afterEach(() => vi.unstubAllGlobals());

describe("fetchConSesion", () => {
    it("conserva la solicitud y la respuesta exitosa", async () => {
        const { fetchConSesion } = await import("./cliente-sesion");
        const respuesta = new Response(JSON.stringify({ guardado: true }));
        const opciones = { method: "PATCH", body: new FormData() };
        fetchSimulado.mockResolvedValue(respuesta);
        expect(await fetchConSesion("/api/publicaciones/1", opciones)).toBe(respuesta);
        expect(fetchSimulado).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/1", opciones);
        expect(reemplazar).not.toHaveBeenCalled();
    });

    it.each([
        "/api/publicaciones/1",
        new URL("https://uam.test/api/publicaciones/1"),
        new Request("https://uam.test/api/publicaciones/1"),
    ])("finaliza la sesión ante un 401 propio: %s", async (entrada) => {
        const { fetchConSesion } = await import("./cliente-sesion");
        fetchSimulado.mockResolvedValue(new Response(null, { status: 401 }));
        await expect(fetchConSesion(entrada)).rejects.toThrow("Tu sesión finalizó. Volvé a iniciar sesión.");
        expect(reemplazar).toHaveBeenCalledExactlyOnceWith("/sesion-finalizada");
    });

    it("redirige una sola vez cuando varias solicitudes fallan a la vez", async () => {
        const { fetchConSesion } = await import("./cliente-sesion");
        fetchSimulado.mockImplementation(async () => new Response(null, { status: 401 }));
        const resultados = await Promise.allSettled([
            fetchConSesion("/api/publicaciones/1"), fetchConSesion("/api/sesion"), fetchConSesion("/api/publicaciones/productor"),
        ]);
        expect(resultados.every((resultado) => resultado.status === "rejected")).toBe(true);
        expect(reemplazar).toHaveBeenCalledExactlyOnceWith("/sesion-finalizada");
    });

    it.each([400, 403, 404, 409, 500, 503])("no cierra sesión por una respuesta %s", async (status) => {
        const { fetchConSesion } = await import("./cliente-sesion");
        const respuesta = new Response(null, { status });
        fetchSimulado.mockResolvedValue(respuesta);
        expect(await fetchConSesion("/api/publicaciones/1")).toBe(respuesta);
        expect(reemplazar).not.toHaveBeenCalled();
    });

    it("no cierra la sesión por un 401 de un servicio externo", async () => {
        const { fetchConSesion } = await import("./cliente-sesion");
        const respuesta = new Response(null, { status: 401 });
        fetchSimulado.mockResolvedValue(respuesta);
        expect(await fetchConSesion("https://externo.test/servicio")).toBe(respuesta);
        expect(reemplazar).not.toHaveBeenCalled();
    });

    it("conserva un fallo de conexión sin cerrar sesión", async () => {
        const { fetchConSesion } = await import("./cliente-sesion");
        const error = new TypeError("Failed to fetch");
        fetchSimulado.mockRejectedValue(error);
        await expect(fetchConSesion("/api/publicaciones/1")).rejects.toBe(error);
        expect(reemplazar).not.toHaveBeenCalled();
    });

    it("ignora una respuesta tardía si la solicitud fue cancelada", async () => {
        const { fetchConSesion } = await import("./cliente-sesion");
        const controlador = new AbortController();
        fetchSimulado.mockImplementation(async () => { controlador.abort(); return new Response(null, { status: 401 }); });
        await expect(fetchConSesion("/api/sesion", { signal: controlador.signal })).rejects.toMatchObject({ name: "AbortError" });
        expect(reemplazar).not.toHaveBeenCalled();
    });
});
