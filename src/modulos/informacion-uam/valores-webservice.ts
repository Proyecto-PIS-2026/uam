export type ValorWebservice = string | number | boolean | null | ValorWebservice[] | { [clave: string]: ValorWebservice };

export function textoValorWebservice(valor: unknown): string {
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

export function numeroValorWebservice(valor: ValorWebservice): number | null {
    if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
    if (typeof valor !== "string") return null;

    const texto = valor.trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(texto)) return null;

    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
}
