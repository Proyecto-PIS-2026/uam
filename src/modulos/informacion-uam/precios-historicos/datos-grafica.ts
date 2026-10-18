import type { PrecioHistorico, RegistroHistorico, ValorHistorico } from "./tipos";
import { esFechaISO } from "./parametros-consulta";

export type RegistroGrafica = {
    dia: Pick<RegistroHistorico, "date">;
    precio: Pick<PrecioHistorico, "min_kg" | "max_kg">;
};

export type PuntoGraficaHistorica = {
    fecha: string;
    marcaDeTiempo: number;
    minimo: number | null;
    maximo: number | null;
    cantidad: number;
};

type ExtremoHistorico = {
    fecha: string;
    valor: number;
};

function numeroGraficable(valor: ValorHistorico): number | null {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
    if (typeof valor !== "string") return null;

    const texto = valor.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(texto)) return null;

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
}

function fechaGraficable(valor: ValorHistorico): { fecha: string; marcaDeTiempo: number } | null {
    if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;

    const marcaDeTiempo = Date.parse(`${valor}T12:00:00.000Z`);
    if (!Number.isFinite(marcaDeTiempo) || new Date(marcaDeTiempo).toISOString().slice(0, 10) !== valor) return null;

    return { fecha: valor, marcaDeTiempo };
}

export function agruparPreciosPorFecha(registros: readonly RegistroGrafica[]): PuntoGraficaHistorica[] {
    const puntosPorFecha = new Map<string, PuntoGraficaHistorica>();

    for (const { dia, precio } of registros) {
        const fecha = fechaGraficable(dia.date);
        if (!fecha) continue;

        const minimo = numeroGraficable(precio.min_kg);
        const maximo = numeroGraficable(precio.max_kg);
        const punto = puntosPorFecha.get(fecha.fecha) ?? { ...fecha, minimo: null, maximo: null, cantidad: 0 };

        // Cada campo conserva su serie, incluso si el mínimo supera al máximo.
        if (minimo !== null) punto.minimo = punto.minimo === null ? minimo : Math.min(punto.minimo, minimo);
        if (maximo !== null) punto.maximo = punto.maximo === null ? maximo : Math.max(punto.maximo, maximo);
        if (minimo !== null || maximo !== null) punto.cantidad += 1;

        // Mantener la fecha vacía permite interrumpir la línea donde faltan valores graficables.
        puntosPorFecha.set(fecha.fecha, punto);
    }

    return [...puntosPorFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export function obtenerExtremos(puntos: readonly PuntoGraficaHistorica[]): {
    minimo: ExtremoHistorico | null;
    maximo: ExtremoHistorico | null;
} | null {
    let minimo: ExtremoHistorico | null = null;
    let maximo: ExtremoHistorico | null = null;

    for (const punto of puntos) {
        if (punto.minimo !== null && (!minimo || punto.minimo < minimo.valor || (punto.minimo === minimo.valor && punto.fecha < minimo.fecha))) {
            minimo = { fecha: punto.fecha, valor: punto.minimo };
        }
        if (punto.maximo !== null && (!maximo || punto.maximo > maximo.valor || (punto.maximo === maximo.valor && punto.fecha < maximo.fecha))) {
            maximo = { fecha: punto.fecha, valor: punto.maximo };
        }
    }

    return minimo || maximo ? { minimo, maximo } : null;
}

export function obtenerFechasAnteriores(desde: string, hasta: string, hoy: string): string[] {
    if (!esFechaISO(desde) || !esFechaISO(hasta) || !esFechaISO(hoy) || desde > hasta) return [];

    const primerAnio = Number(desde.slice(0, 4));
    const ultimoAnio = Math.min(Number(hasta.slice(0, 4)), Number(hoy.slice(0, 4)) - 1);
    const mesYDia = hoy.slice(5);
    const fechas: string[] = [];

    for (let anio = primerAnio; anio <= ultimoAnio; anio += 1) {
        const fecha = `${String(anio).padStart(4, "0")}-${mesYDia}`;
        if (esFechaISO(fecha) && fecha >= desde && fecha <= hasta) fechas.push(fecha);
    }

    return fechas;
}
