export function textoValorHistorico(valor: unknown): string {
    if (valor == null) return "—";
    if (typeof valor === "string") return valor;
    if (typeof valor === "object") {
        try {
            return JSON.stringify(valor) ?? String(valor);
        } catch {
            return String(valor);
        }
    }
    return String(valor);
}
