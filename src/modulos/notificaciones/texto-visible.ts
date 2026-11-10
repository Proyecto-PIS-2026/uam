export function textoVisibleNotificacion(texto: string): string {
    if (!texto.startsWith("Tu publicación de ")) return texto;
    return texto.replace(/ \(ID #[1-9]\d*\)(?= (?:ha vencido el |está próxima a vencer el ))/u, "");
}
