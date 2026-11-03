import { describe, expect, it } from "vitest";
import { urlInternaNotificacion } from "./validacion-url";

describe("enlaces internos de notificaciones", () => {
    it.each([
        "/inicio",
        "/mi-mercado/productor",
        "/notificaciones?origen=mercado#nuevas",
        "/operadores/Jorge%20Ferias",
    ])("conserva la ruta interna %s", (url) => {
        expect(urlInternaNotificacion(url)).toBe(url);
    });

    it("normaliza caracteres y segmentos sin cambiar de origen", () => {
        expect(urlInternaNotificacion("/inicio/../notificaciones")).toBe("/notificaciones");
        expect(urlInternaNotificacion("/operadores/Jorge Ferias")).toBe("/operadores/Jorge%20Ferias");
    });

    it.each([
        null, undefined, 4, {}, "", "inicio", "https://externo.example", "http://externo.example",
        "//externo.example", "javascript:alert(1)", "data:text/html,hola", " /inicio", "/inicio ",
        "/\\externo.example", "/%5cexterno.example", "/%2fexterno.example", "/inicio\n", "/inicio%0d%0a",
        "/inicio\u0000", "/inicio%00", "/%xx", "/.//externo.example", "/%2e//externo.example",
        "/inicio/..//externo.example", "/" + "a".repeat(2048),
    ])("rechaza un enlace ausente o inseguro %#", (url) => {
        expect(urlInternaNotificacion(url)).toBeNull();
    });
});
