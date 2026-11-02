export type PublicacionPonderable = {
    foto: string | null;
    precio: number | null;
    cantidadUnidades?: number | null;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    pais: string;
};

export function calcularPonderacion(publicacion: PublicacionPonderable): number {
    let puntos = publicacion.foto?.trim() ? 3 : 0;
    if (publicacion.precio != null) {
        puntos++;
    }
    if (publicacion.cantidadUnidades != null) {
        puntos++;
    }
    const campos = [publicacion.variedad, publicacion.presentacion, publicacion.categoria, publicacion.calibre, publicacion.pais];
    for (const campo of campos) {
        if (campo.trim() !== "") puntos++;
    }
    return puntos;
}