import type { Publicacion } from "./tipos";

export function crearEnlaceWhatsApp(publicacion: Publicacion, nombreOperador: string, origen: string): string {
    const especie = publicacion.presentacion.variedad.especie.nombreEspecie;
    const variedad = publicacion.presentacion.variedad.nombreVariedad;
    const nombreProducto = variedad && variedad !== "-" ? `${especie} - ${variedad}` : especie;
    const enlacePerfil = `${origen}/operadores/${encodeURIComponent(nombreOperador)}`;
    const mensaje = [
        `🌿 ${nombreProducto}`,
        `📦 Presentación: ${publicacion.presentacion.nombrePresentacion}`,
        `🏷️ Categoría: ${publicacion.categoria.nombreCategoria}`,
        `📏 Calibre: ${publicacion.calibre.nombreCalibre}`,
        `💰 Precio: ${publicacion.precio !== null ? `$${Number(publicacion.precio)}` : "Consultar"}`,
        "",
        `Disponible en ${nombreOperador}`,
        `🔗 ${enlacePerfil}`,
    ].join("\n");

    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
