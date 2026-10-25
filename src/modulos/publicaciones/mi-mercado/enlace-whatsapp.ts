import type { Publicacion } from "./tipos";

export function crearEnlaceWhatsApp(publicacion: Publicacion, nombreOperador: string, origen: string): string {
    const especie = publicacion.especie.nombreEspecie;
    const variedad = publicacion.variedad?.nombreVariedad;
    const nombreProducto = variedad && variedad !== "-" ? `${especie} - ${variedad}` : especie;
    const enlacePerfil = `${origen}/operadores/${encodeURIComponent(nombreOperador)}`;
    const mensaje = [
        `🌿 ${nombreProducto}`,
        ...(publicacion.presentacion ? [`📦 Presentación: ${publicacion.presentacion.nombrePresentacion}`] : []),
        ...(publicacion.categoria ? [`🏷️ Categoría: ${publicacion.categoria.nombreCategoria}`] : []),
        ...(publicacion.calibre ? [`📏 Calibre: ${publicacion.calibre.nombreCalibre}`] : []),
        `💰 Precio: ${publicacion.precio !== null ? `$${Number(publicacion.precio)}` : "Consultar"}`,
        "",
        `Disponible en ${nombreOperador}`,
        `🔗 ${enlacePerfil}`,
    ].join("\n");

    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}
