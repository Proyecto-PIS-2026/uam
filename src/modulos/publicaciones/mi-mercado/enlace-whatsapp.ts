import type { Publicacion } from "./tipos";
import { crearEnlaceWhatsApp as crearEnlace } from "@/compartido/whatsapp";

export function crearMensajeWhatsApp(publicacion: Publicacion, nombreOperador: string, origen: string): string {
    const especie = publicacion.especie.nombreEspecie;
    const variedad = publicacion.variedad?.nombreVariedad;
    const nombreProducto = variedad && variedad !== "-" ? `${especie} - ${variedad}` : especie;
    const enlacePerfil = `${origen}/operadores/${encodeURIComponent(nombreOperador)}`;
    return [
        `🌿 ${nombreProducto}`,
        ...(publicacion.envase ? [`📦 Envase: ${publicacion.envase.nombreEnvase}`] : []),
        ...(publicacion.kilos ? [`⚖️ Kilos: ${publicacion.kilos.valor} kg`] : []),
        ...(publicacion.categoria ? [`🏷️ Categoría: ${publicacion.categoria.nombreCategoria}`] : []),
        ...(publicacion.calibre ? [`📏 Calibre: ${publicacion.calibre.nombreCalibre}`] : []),
        `💰 Precio: ${publicacion.precio !== null ? `$${Number(publicacion.precio)}` : "Consultar"}`,
        "",
        `Disponible en ${nombreOperador}`,
        `🔗 ${enlacePerfil}`,
    ].join("\n");
}

export function crearEnlaceWhatsApp(publicacion: Publicacion, nombreOperador: string, origen: string): string {
    return crearEnlace(crearMensajeWhatsApp(publicacion, nombreOperador, origen));
}
