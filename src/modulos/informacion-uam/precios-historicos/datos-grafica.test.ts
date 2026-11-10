// @vitest-environment node
import { describe, expect, it } from "vitest";
import { agruparPreciosPorFecha, obtenerExtremos, obtenerFechasAnteriores, type RegistroGrafica } from "./datos-grafica";
import type { ValorHistorico } from "./tipos";

function registro(fecha: ValorHistorico, minimo: ValorHistorico, maximo: ValorHistorico): RegistroGrafica {
    return { dia: { date: fecha }, precio: { min_kg: minimo, max_kg: maximo } };
}

describe("agruparPreciosPorFecha", () => {
    it("ordena las fechas sin modificar los valores originales ni los registros de entrada", () => {
        const registros = [
            registro("2026-10-11", "15.5", "Ñ"),
            registro("2023-10-11", -8, -12),
            registro("2024-02-29", null, 20),
        ];
        const original = structuredClone(registros);
        for (const dato of registros) {
            Object.freeze(dato.dia);
            Object.freeze(dato.precio);
            Object.freeze(dato);
        }
        Object.freeze(registros);

        const puntos = agruparPreciosPorFecha(registros);

        expect(puntos.map((punto) => punto.fecha)).toEqual(["2023-10-11", "2024-02-29", "2026-10-11"]);
        expect(registros).toEqual(original);
    });

    it("agrupa el menor mínimo y el mayor máximo de todas las presentaciones de cada fecha", () => {
        const puntos = agruparPreciosPorFecha([
            registro("2026-10-10", 20, 50),
            registro("2026-10-11", 18, 25),
            registro("2026-10-10", 5.5, 16),
            registro("2026-10-10", 13, 75.5),
        ]);

        expect(puntos).toEqual([
            { fecha: "2026-10-10", marcaDeTiempo: Date.parse("2026-10-10T12:00:00.000Z"), minimo: 5.5, maximo: 75.5, cantidad: 3 },
            { fecha: "2026-10-11", marcaDeTiempo: Date.parse("2026-10-11T12:00:00.000Z"), minimo: 18, maximo: 25, cantidad: 1 },
        ]);
    });

    it("conserva los negativos y mínimos mayores que máximos sin intercambiar las series", () => {
        const puntos = agruparPreciosPorFecha([
            registro("2026-10-10", 80, 10),
            registro("2026-10-10", 95, 5),
            registro("2026-10-11", -3, -20),
        ]);

        expect(puntos[0]).toMatchObject({ minimo: 80, maximo: 10, cantidad: 2 });
        expect(puntos[1]).toMatchObject({ minimo: -3, maximo: -20, cantidad: 1 });
    });

    it("descarta Ñ solamente de su serie y conserva la otra cotización del registro", () => {
        const puntos = agruparPreciosPorFecha([
            registro("2026-10-10", "Ñ", 20),
            registro("2026-10-11", 30, "Ñ"),
            registro("2026-10-12", "Ñ", "Ñ"),
        ]);

        expect(puntos.map(({ minimo, maximo, cantidad }) => ({ minimo, maximo, cantidad }))).toEqual([
            { minimo: null, maximo: 20, cantidad: 1 },
            { minimo: 30, maximo: null, cantidad: 1 },
            { minimo: null, maximo: null, cantidad: 0 },
        ]);
    });

    it("agrupa series parciales de una fecha y cuenta cada registro graficable una sola vez", () => {
        const [punto] = agruparPreciosPorFecha([
            registro("2026-10-10", "Ñ", 20),
            registro("2026-10-10", 30, "Ñ"),
            registro("2026-10-10", 35, 18),
            registro("2026-10-10", "Ñ", "Ñ"),
        ]);

        expect(punto).toMatchObject({ minimo: 30, maximo: 20, cantidad: 3 });
    });

    it.each([
        ["15", 15], ["-1.25", -1.25], ["+3.5", 3.5], [".5", 0.5],
        ["2.", 2], [" 0 ", 0], ["1e2", 100], ["-2.5E-1", -0.25],
    ])("acepta la representación decimal %s sin alterar su valor", (valor, esperado) => {
        const [punto] = agruparPreciosPorFecha([registro("2026-10-10", valor, valor)]);

        expect(punto).toMatchObject({ minimo: esperado, maximo: esperado, cantidad: 1 });
    });

    it("no convierte vacíos, booleanos, estructuras, letras ni números no finitos en cotizaciones", () => {
        const valoresInvalidos: ValorHistorico[] = [
            "", " ", "\t\n", null, true, false, [], [12], {}, { precio: 12 },
            "Ñ", "12Ñ", "12 pesos", "1,25", "0x10", "0b10", "Infinity", "NaN", "1e999", NaN, Infinity, -Infinity,
        ];

        for (const valor of valoresInvalidos) {
            const puntos = agruparPreciosPorFecha([
                registro("2026-10-10", valor, 12),
                registro("2026-10-11", 15, valor),
            ]);

            expect(puntos[0]).toMatchObject({ minimo: null, maximo: 12, cantidad: 1 });
            expect(puntos[1]).toMatchObject({ minimo: 15, maximo: null, cantidad: 1 });
        }
    });

    it("conserva el cero y fechas sin valores como huecos entre los días graficables", () => {
        const puntos = agruparPreciosPorFecha([
            registro("2026-10-10", 0, "0"),
            registro("2026-10-11", "Ñ", null),
            registro("2026-10-12", 15, 20),
        ]);

        expect(puntos).toHaveLength(3);
        expect(puntos[0]).toMatchObject({ minimo: 0, maximo: 0, cantidad: 1 });
        expect(puntos[1]).toMatchObject({ fecha: "2026-10-11", minimo: null, maximo: null, cantidad: 0 });
        expect(puntos[2]).toMatchObject({ minimo: 15, maximo: 20, cantidad: 1 });
    });

    it("omite únicamente de la gráfica las fechas imposibles o sin formato ISO de día", () => {
        const fechasInvalidas: ValorHistorico[] = [
            "2026-02-29", "2026-02-30", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "2026-01-32",
            "2026-1-1", "16/10/2026", "2026-10-16T12:00:00Z", " 2026-10-16 ", "Ñ", "", null, 20261016, true, [], {},
        ];
        const registros = fechasInvalidas.map((fecha) => registro(fecha, 5, 10));
        const original = structuredClone(registros);

        expect(agruparPreciosPorFecha(registros)).toEqual([]);
        expect(registros).toEqual(original);
    });

    it.each(["2024-02-29", "2026-01-01", "0099-12-31"])("ubica %s a mediodía UTC sin cambiar el día", (fecha) => {
        const [punto] = agruparPreciosPorFecha([registro(fecha, 0, 10)]);

        expect(new Date(punto.marcaDeTiempo).toISOString()).toBe(`${fecha}T12:00:00.000Z`);
        const partes = new Intl.DateTimeFormat("en", { timeZone: "America/Montevideo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(punto.marcaDeTiempo));
        const parte = (tipo: Intl.DateTimeFormatPartTypes) => partes.find((valor) => valor.type === tipo)!.value;
        expect(`${parte("year").padStart(4, "0")}-${parte("month")}-${parte("day")}`).toBe(fecha);
        expect(punto.minimo).toBe(0);
    });

    it("conserva todo un período de tres años, sin limitarlo a los 40 registros de una página", () => {
        const desde = Date.parse("2023-10-11T00:00:00.000Z");
        const hasta = Date.parse("2026-10-11T00:00:00.000Z");
        const registros: RegistroGrafica[] = [];
        for (let instante = desde; instante <= hasta; instante += 86_400_000) {
            registros.push(registro(new Date(instante).toISOString().slice(0, 10), 20, 40));
        }
        registros[10].precio.min_kg = -1;
        registros[100].precio.max_kg = 99;

        const puntos = agruparPreciosPorFecha([...registros].reverse());

        expect(puntos).toHaveLength(1097);
        expect(puntos[0].fecha).toBe("2023-10-11");
        expect(puntos.at(-1)?.fecha).toBe("2026-10-11");
        expect(puntos.every((punto) => new Date(punto.marcaDeTiempo).toISOString() === `${punto.fecha}T12:00:00.000Z`)).toBe(true);
        expect(obtenerExtremos(puntos)).toEqual({
            minimo: { fecha: "2023-10-21", valor: -1 },
            maximo: { fecha: "2024-01-19", valor: 99 },
        });
    });

    it("devuelve una serie vacía cuando no hay registros filtrados", () => {
        expect(agruparPreciosPorFecha([])).toEqual([]);
    });
});

describe("obtenerExtremos", () => {
    it("busca el menor mínimo y mayor máximo en su propia serie, aun cuando estén invertidos", () => {
        const puntos = agruparPreciosPorFecha([
            registro("2026-10-11", 80, 20),
            registro("2025-03-15", 50, 30),
            registro("2024-07-01", 40, 25),
        ]);

        expect(obtenerExtremos(puntos)).toEqual({
            minimo: { fecha: "2024-07-01", valor: 40 },
            maximo: { fecha: "2025-03-15", valor: 30 },
        });
    });

    it("elige la fecha más temprana en empates, incluso si los puntos llegan desordenados", () => {
        const puntos = agruparPreciosPorFecha([
            registro("2026-10-11", -5, 0),
            registro("2024-07-01", -5, 0),
            registro("2025-03-15", 10, -20),
        ]).reverse();
        const original = structuredClone(puntos);

        expect(obtenerExtremos(puntos)).toEqual({
            minimo: { fecha: "2024-07-01", valor: -5 },
            maximo: { fecha: "2024-07-01", valor: 0 },
        });
        expect(puntos).toEqual(original);
    });

    it("calcula cada extremo por separado si sólo una serie tiene valores", () => {
        expect(obtenerExtremos(agruparPreciosPorFecha([
            registro("2026-10-10", "Ñ", "Ñ"),
            registro("2026-10-11", null, -20),
        ]))).toEqual({ minimo: null, maximo: { fecha: "2026-10-11", valor: -20 } });
        expect(obtenerExtremos(agruparPreciosPorFecha([
            registro("2026-10-10", 0, "Ñ"),
            registro("2026-10-11", "Ñ", "Ñ"),
        ]))).toEqual({ minimo: { fecha: "2026-10-10", valor: 0 }, maximo: null });
    });

    it("devuelve null cuando no hay ningún valor graficable", () => {
        expect(obtenerExtremos([])).toBeNull();
        expect(obtenerExtremos(agruparPreciosPorFecha([registro("2026-10-10", "Ñ", null)]))).toBeNull();
    });
});

describe("obtenerFechasAnteriores", () => {
    it("devuelve el mismo mes y día en orden ascendente y excluye el año actual y futuros", () => {
        expect(obtenerFechasAnteriores("2023-01-01", "2028-12-31", "2026-10-16")).toEqual([
            "2023-10-16", "2024-10-16", "2025-10-16",
        ]);
    });

    it("incluye las coincidencias en ambos límites del período", () => {
        expect(obtenerFechasAnteriores("2023-10-16", "2025-10-16", "2026-10-16")).toEqual([
            "2023-10-16", "2024-10-16", "2025-10-16",
        ]);
        expect(obtenerFechasAnteriores("2025-10-16", "2025-10-16", "2026-10-16")).toEqual(["2025-10-16"]);
    });

    it("omite las coincidencias que quedan fuera de los extremos del período", () => {
        expect(obtenerFechasAnteriores("2023-10-17", "2025-10-15", "2026-10-16")).toEqual(["2024-10-16"]);
    });

    it("devuelve vacío para períodos sin coincidencias o sin años anteriores", () => {
        expect(obtenerFechasAnteriores("2025-01-01", "2025-09-30", "2026-10-16")).toEqual([]);
        expect(obtenerFechasAnteriores("2026-01-01", "2027-12-31", "2026-10-16")).toEqual([]);
    });

    it("marca el 29 de febrero sólo en años donde existe, sin desplazarlo", () => {
        expect(obtenerFechasAnteriores("2019-01-01", "2024-12-31", "2024-02-29")).toEqual(["2020-02-29"]);
        expect(obtenerFechasAnteriores("1899-01-01", "1904-12-31", "2004-02-29")).toEqual(["1904-02-29"]);
        expect(obtenerFechasAnteriores("1999-01-01", "2000-12-31", "2004-02-29")).toEqual(["2000-02-29"]);
    });

    it.each([
        ["fecha inválida", "2025-12-31", "2026-10-16"],
        ["2023-01-01", "2025-02-30", "2026-10-16"],
        ["2023-01-01", "2025-12-31", "2026-02-29"],
        ["2023-01-01", "2025-12-31", ""],
        ["2023-1-1", "2025-12-31", "2026-10-16"],
        ["2025-12-31", "2023-01-01", "2026-10-16"],
    ])("devuelve vacío con fechas inválidas o rango invertido (%s, %s, %s)", (desde, hasta, hoy) => {
        expect(obtenerFechasAnteriores(desde, hasta, hoy)).toEqual([]);
    });
});
