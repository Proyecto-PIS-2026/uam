export const ERROR_IMPORTE_AJUSTE = "El importe debe ser un número entero mayor que cero, sin decimales ni otros caracteres.";

export function validarImporteAjuste(valor: unknown): number {
    if (typeof valor !== "string" || !/^\d+$/.test(valor)) {
        throw new Error(ERROR_IMPORTE_AJUSTE);
    }

    const importe = Number(valor);
    if (!Number.isSafeInteger(importe) || importe <= 0) {
        throw new Error(ERROR_IMPORTE_AJUSTE);
    }

    return importe;
}
