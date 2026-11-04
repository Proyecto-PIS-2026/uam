import { describe, expect, it } from "vitest";
import { crearEnlaceWhatsApp } from "./enlace-whatsapp";
import type { Publicacion } from "./tipos";

function crearPublicacion(): Publicacion {
    return {
        id: 52,
        version: 1,
        publicacionOperadorId: 13,
        paisId: 44,
        foto: "/api/imagenes/publicaciones/52",
        precio: "45",
        fecha: "2026-10-03T15:00:00.000Z",
        publicacionActiva: true,
        publicacionDisponible: true,
        especie: { id: 7, nombreEspecie: "Acelga", fotoEspecie: null },
            variedad: { id: 6, nombreVariedad: "-" },
            envase: { id: 5, nombreEnvase: "Docena" }, kilos: null,
        categoria: { id: 1, nombreCategoria: "I" },
        calibre: { id: 2, codigoCalibre: "M", nombreCalibre: "12 PLANTAS" },
    };
}

describe("crearEnlaceWhatsApp", () => {
    it("comparte una publicación con solo especie sin inventar atributos", () => {
        const publicacion: Publicacion = { ...crearPublicacion(), variedad: null, envase: null, kilos: null, categoria: null, calibre: null, paisId: null, precio: null };
        const mensaje = new URL(crearEnlaceWhatsApp(publicacion, "El Mercado", "https://mercado.example")).searchParams.get("text");

        expect(mensaje).toContain("🌿 Acelga\n");
        expect(mensaje).toContain("💰 Precio: Consultar\n");
        expect(mensaje).not.toMatch(/Empaquetado:|Kilos:|Categoría:|Calibre:|undefined|null/);
    });

    it("prepara el mensaje con los datos del producto y el perfil en el origen actual", () => {
        const nombreOperador = "Mercado Pérez & Hijos/Sur";
        const mensaje = [
            "🌿 Acelga",
            "📦 Empaquetado: Docena",
            "🏷️ Categoría: I",
            "📏 Calibre: 12 PLANTAS",
            "💰 Precio: $45",
            "",
            `Disponible en ${nombreOperador}`,
            `🔗 https://mercado.example/operadores/${encodeURIComponent(nombreOperador)}`,
        ].join("\n");

        const enlace = crearEnlaceWhatsApp(crearPublicacion(), nombreOperador, "https://mercado.example");

        expect(enlace).toBe(`https://web.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`);
        expect(new URL(enlace).searchParams.get("text")).toBe(mensaje);
    });

    it("incluye la variedad y Consultar cuando la publicación no tiene precio", () => {
        const publicacion = crearPublicacion();
        publicacion.precio = null;
        publicacion.variedad!.nombreVariedad = "Verde";

        const mensaje = new URL(crearEnlaceWhatsApp(publicacion, "El Mercado", "https://otro.example")).searchParams.get("text");

        expect(mensaje).toContain("🌿 Acelga - Verde\n");
        expect(mensaje).toContain("💰 Precio: Consultar\n");
        expect(mensaje).toContain("https://otro.example/operadores/El%20Mercado");
    });
});


it("comparte kilos sin exigir envase", () => {
    const publicacion: Publicacion = { ...crearPublicacion(), envase: null, kilos: { id: 2, valor: "18-24" } };
    const mensaje = new URL(crearEnlaceWhatsApp(publicacion, "El Mercado", "https://mercado.example")).searchParams.get("text");
    expect(mensaje).toContain("Kilos: 18-24 kg");
    expect(mensaje).not.toContain("Empaquetado:");
});
