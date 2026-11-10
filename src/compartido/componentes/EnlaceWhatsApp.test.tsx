import { act, render, screen, within } from "@testing-library/react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import EnlaceWhatsApp from "./EnlaceWhatsApp";

const mensaje = "Hola, quisiera consultar por limón & naranja.";
const enlace = (
    <EnlaceWhatsApp numero="+598 99-123-456" mensaje={mensaje} className="contacto" aria-label="Contactar a Huerta Norte por WhatsApp">
        <span>Contactar</span>
    </EnlaceWhatsApp>
);

afterEach(() => vi.restoreAllMocks());

describe("EnlaceWhatsApp", () => {
    it.each([
        { dispositivo: "escritorio", agente: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", origen: "https://web.whatsapp.com", ruta: "/send" },
        { dispositivo: "celular", agente: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", origen: "https://wa.me", ruta: "/59899123456" },
    ])("conserva el chat y el mensaje en $dispositivo", ({ agente, origen, ruta }) => {
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue(agente);
        render(enlace);

        const contacto = screen.getByRole("link", { name: "Contactar a Huerta Norte por WhatsApp" });
        const destino = new URL(contacto.getAttribute("href")!);
        expect(destino.origin).toBe(origen);
        expect(destino.pathname).toBe(ruta);
        if (ruta === "/send") expect(destino.searchParams.get("phone")).toBe("59899123456");
        expect(destino.searchParams.get("text")).toBe(mensaje);
        expect(contacto).toHaveAttribute("target", "_blank");
        expect(contacto).toHaveAttribute("rel", "noopener noreferrer");
        expect(contacto).toHaveClass("contacto");
        expect(contacto).toHaveTextContent("Contactar");
    });

    it("hidrata el enlace de un celular sin discrepancias con el HTML del servidor", async () => {
        vi.spyOn(navigator, "userAgent", "get").mockReturnValue("Mozilla/5.0 (Android 14)");
        const contenedor = document.createElement("div");
        contenedor.innerHTML = renderToString(enlace);
        document.body.append(contenedor);
        const errorHidratacion = vi.fn();
        let raiz: Root | undefined;
        try {
            expect(contenedor.querySelector("a")).toHaveAttribute("href", expect.stringContaining("https://web.whatsapp.com/send?phone=59899123456"));
            await act(async () => {
                raiz = hydrateRoot(contenedor, enlace, { onRecoverableError: errorHidratacion });
            });
            const contacto = within(contenedor).getByRole("link", { name: "Contactar a Huerta Norte por WhatsApp" });
            expect(contacto).toHaveAttribute("href", expect.stringContaining("https://wa.me/59899123456?text="));
            expect(errorHidratacion).not.toHaveBeenCalled();
        } finally {
            if (raiz) await act(async () => raiz?.unmount());
            contenedor.remove();
        }
    });
});
