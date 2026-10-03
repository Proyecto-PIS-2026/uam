import { describe, expect, it } from "vitest";
import { compararEspeciesPorPrioridad } from "./prioridad-especies";

describe("compararEspeciesPorPrioridad", () => {
    it("respeta la prioridad solicitada por UAM aunque las especies lleguen desordenadas", () => {
        const ordenEsperado = [
            "Papa", "Banana", "Naranja", "Manzana", "Tomate", "Cebolla", "Boniato",
            "Zanahoria", "Mandarina", "Morrón", "Sandía", "Limón", "Calabacín",
            "Zapallo", "Lechuga",
        ];

        expect([...ordenEsperado].reverse().sort(compararEspeciesPorPrioridad)).toEqual(ordenEsperado);
    });

    it("deja las demás especies después y en orden alfabético español", () => {
        const especies = ["Pera", "Árbol", "MORRON", "banana", "Apio"];

        expect(especies.sort(compararEspeciesPorPrioridad)).toEqual([
            "banana", "MORRON", "Apio", "Árbol", "Pera",
        ]);
    });
});
