import { describe, expect, it } from "vitest";
import { calcularPonderacion, compararPorPonderacionYFecha, type PublicacionPonderable } from "./ponderacion-publicacion";

function crearPublicacion(cambios: Partial<PublicacionPonderable & { id: number; fecha: string }> = {}) {
    return {
        id: 1,
        fecha: "2026-11-02T12:00:00.000Z",
        foto: null,
        precio: null,
        cantidadUnidades: null,
        variedad: "",
        presentacion: "",
        categoria: "",
        calibre: "",
        pais: "",
        ...cambios,
    };
}

describe("calcularPonderacion", () => {
    it("devuelve cero cuando no hay datos opcionales", () => {
        expect(calcularPonderacion(crearPublicacion())).toBe(0);
    });

    it("asigna tres puntos a la fotografía", () => {
        expect(calcularPonderacion(crearPublicacion({ foto: "/tomate.jpg" }))).toBe(3);
    });

    it.each(["variedad", "presentacion", "categoria", "calibre", "pais"] as const)("asigna un punto al campo %s", (campo) => {
        expect(calcularPonderacion(crearPublicacion({ [campo]: "Completado" }))).toBe(1);
    });

    it("asigna un punto al precio", () => {
        expect(calcularPonderacion(crearPublicacion({ precio: 150 }))).toBe(1);
    });

    it("asigna un punto a la cantidad de unidades", () => {
        expect(calcularPonderacion(crearPublicacion({ cantidadUnidades: 20 }))).toBe(1);
    });

    it("no confunde un valor numérico cero con un dato ausente", () => {
        expect(calcularPonderacion(crearPublicacion({ precio: 0, cantidadUnidades: 0 }))).toBe(2);
    });

    it("no suma puntos por campos que solo contienen espacios", () => {
        const publicacion = crearPublicacion({ foto: "   ", variedad: " ", presentacion: " ", categoria: " ", calibre: " ", pais: " " });
        expect(calcularPonderacion(publicacion)).toBe(0);
    });

    it("no suma puntos cuando la cantidad de unidades está ausente", () => {
        expect(calcularPonderacion(crearPublicacion({ cantidadUnidades: undefined }))).toBe(0);
    });

    it("suma diez puntos cuando están completos todos los campos ponderables", () => {
        const publicacion = crearPublicacion({
            foto: "/tomate.jpg",
            precio: 150,
            cantidadUnidades: 20,
            variedad: "Perita",
            presentacion: "Cajón",
            categoria: "Primera",
            calibre: "Mediano",
            pais: "Uruguay",
        });
        expect(calcularPonderacion(publicacion)).toBe(10);
    });
});

describe("compararPorPonderacionYFecha", () => {
    it("prioriza los puntos aunque la publicación sea más antigua", () => {
        const completa = crearPublicacion({ id: 1, foto: "/tomate.jpg", fecha: "2026-11-01T12:00:00.000Z" });
        const reciente = crearPublicacion({ id: 2, precio: 150, fecha: "2026-11-02T12:00:00.000Z" });
        expect(compararPorPonderacionYFecha(completa, reciente)).toBeLessThan(0);
        expect(compararPorPonderacionYFecha(reciente, completa)).toBeGreaterThan(0);
    });

    it("prioriza la fotografía frente a dos campos simples", () => {
        const conFoto = crearPublicacion({ id: 1, foto: "/tomate.jpg" });
        const conDosCampos = crearPublicacion({ id: 2, precio: 150, variedad: "Perita" });
        expect(compararPorPonderacionYFecha(conFoto, conDosCampos)).toBeLessThan(0);
    });

    it("prioriza la fecha más reciente cuando los puntos empatan", () => {
        const antigua = crearPublicacion({ id: 1, precio: 150, fecha: "2026-11-01T12:00:00.000Z" });
        const reciente = crearPublicacion({ id: 2, variedad: "Perita", fecha: "2026-11-02T12:00:00.000Z" });
        expect(compararPorPonderacionYFecha(reciente, antigua)).toBeLessThan(0);
    });

    it.each([["hora", "2026-11-02T13:00:00.000Z"], ["minuto", "2026-11-02T12:01:00.000Z"], ["segundo", "2026-11-02T12:00:01.000Z"], ["milisegundo", "2026-11-02T12:00:00.001Z"]])("considera el cambio de %s al comparar fechas", (_, fecha) => {
        const anterior = crearPublicacion({ id: 1 });
        const posterior = crearPublicacion({ id: 2, fecha });
        expect(compararPorPonderacionYFecha(posterior, anterior)).toBeLessThan(0);
    });

    it("desempata por ID cuando dos fechas representan el mismo instante en distintas zonas", () => {
        const primera = crearPublicacion({ id: 1, fecha: "2026-11-02T12:00:00.000Z" });
        const segunda = crearPublicacion({ id: 2, fecha: "2026-11-02T09:00:00.000-03:00" });
        expect(compararPorPonderacionYFecha(primera, segunda)).toBeLessThan(0);
    });

    it("desempata por ID ascendente cuando los puntos y la fecha empatan", () => {
        const primera = crearPublicacion({ id: 1 });
        const segunda = crearPublicacion({ id: 2 });
        expect(compararPorPonderacionYFecha(primera, segunda)).toBeLessThan(0);
        expect(compararPorPonderacionYFecha(segunda, primera)).toBeGreaterThan(0);
    });

    it("devuelve cero al comparar una publicación consigo misma", () => {
        const publicacion = crearPublicacion();
        expect(compararPorPonderacionYFecha(publicacion, publicacion)).toBe(0);
    });
});