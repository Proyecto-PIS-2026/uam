const formatoNumero = new Intl.NumberFormat("es-UY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

export function formatearPrecio(valor: number): string {
    return `$ ${formatoNumero.format(valor)}`;
}
