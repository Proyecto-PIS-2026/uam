export function esDispositivoMovil(): boolean {
    if (typeof navigator === "undefined") return false;
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
        || /Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
}

export function crearEnlaceWhatsApp(mensaje: string, numero = "", movil = esDispositivoMovil()): string {
    const telefono = numero.replace(/\D/g, "");
    const texto = encodeURIComponent(mensaje);
    return movil
        ? `https://wa.me/${telefono}?text=${texto}`
        : `https://web.whatsapp.com/send?${telefono ? `phone=${telefono}&` : ""}text=${texto}`;
}
