export function compararPaisesPorPrioridad(primero: string, segundo: string): number {
    const primeroNormalizado = primero.trim().toLocaleLowerCase("es");
    const segundoNormalizado = segundo.trim().toLocaleLowerCase("es");
    if (primeroNormalizado === "uruguay" && segundoNormalizado !== "uruguay") return -1;
    if (segundoNormalizado === "uruguay" && primeroNormalizado !== "uruguay") return 1;
    return primeroNormalizado.localeCompare(segundoNormalizado, "es", { sensitivity: "base", numeric: true });
}
