export type PublicacionPonderable = {
    foto: string | null;
    precio: number | null;
    cantidadUnidades?: number | null;
    variedad: string;
    envase: string;
    kilos: string;
    categoria: string;
    calibre: string;
    pais: string;
};

type PublicacionConDesempate = PublicacionPonderable & {
    id: number;
    fecha: string;
};


export function calcularPonderacion(publicacion: PublicacionPonderable): number {
    let puntos = publicacion.foto?.trim() ? 3 : 0;
    if (publicacion.precio != null) {
        puntos++;
    }
    if (publicacion.cantidadUnidades != null) {
        puntos++;
    }
    const campos = [publicacion.variedad, publicacion.envase, publicacion.kilos, publicacion.categoria, publicacion.calibre, publicacion.pais];
    for (const campo of campos) {
        if (campo.trim() !== "") puntos++;
    }
    return puntos;
}

export function compararPorPonderacionYFecha(primera: PublicacionConDesempate, segunda: PublicacionConDesempate): number {
    const ponderacion = calcularPonderacion(segunda) - calcularPonderacion(primera);
    if (ponderacion !== 0) {
        return ponderacion;
    }
    const fecha = new Date(segunda.fecha).getTime() - new Date(primera.fecha).getTime();
    if (fecha !== 0) {
        return fecha;
    }
    return primera.id - segunda.id;
}