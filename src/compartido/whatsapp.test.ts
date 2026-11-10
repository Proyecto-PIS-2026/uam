import { afterEach, describe, expect, it, vi } from "vitest";
import { crearEnlaceWhatsApp, esDispositivoMovil } from "./whatsapp";

afterEach(() => vi.unstubAllGlobals());

describe("destino de WhatsApp", () => {
    it.each([
        ["Mozilla/5.0 (Android)", 5, true],
        ["Mozilla/5.0 (iPhone)", 5, true],
        ["Mozilla/5.0 (iPad)", 5, true],
        ["Mozilla/5.0 (Macintosh)", 5, true],
        ["Mozilla/5.0 (Macintosh)", 0, false],
        ["Mozilla/5.0 (Windows NT 10.0)", 10, false],
    ])("distingue %s con %i puntos táctiles", (userAgent, maxTouchPoints, movil) => {
        vi.stubGlobal("navigator", { userAgent, maxTouchPoints });
        expect(esDispositivoMovil()).toBe(movil);
        const enlace = new URL(crearEnlaceWhatsApp("Hola, ¿hay papas?", "+598 99 123 456"));
        expect(enlace.hostname).toBe(movil ? "wa.me" : "web.whatsapp.com");
        expect(movil ? enlace.pathname : enlace.searchParams.get("phone")).toBe(movil ? "/59899123456" : "59899123456");
        expect(enlace.searchParams.get("text")).toBe("Hola, ¿hay papas?");
    });

    it("genera un enlace de escritorio sin depender de navigator al renderizar en el servidor", () => {
        vi.stubGlobal("navigator", undefined);
        expect(crearEnlaceWhatsApp("Papa $45")).toBe("https://web.whatsapp.com/send?text=Papa%20%2445");
    });
});
