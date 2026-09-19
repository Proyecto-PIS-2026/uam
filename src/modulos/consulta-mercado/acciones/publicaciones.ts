import { db } from "../../../infraestructura/persistencia/prisma/db";
import { or } from "@prisma/orm-postgres/orm-client";

export type ordenPublicaciones =
    | "ninguno"
    | "precio_asc"
    | "precio_desc"
    | "alfabetico_asc"
    | "alfabetico_desc";

export type filtrosPublicaciones = {
    busqueda?: string;

    especieId?: number;
    variedadId?: number;
    presentacionId?: number;
    categoriaId?: number;
    calibreId?: number;

    precioMin?: number;
    precioMax?: number;

    orden?: ordenPublicaciones;
    cursor?: string;
    limite?: number;
};

export type publicacionListado = {
    id: number;
    precio: number;
    foto: string | null;

    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;

    operador: {
        id: number;
        nombreFantasia: string;
        fotoPerfil: string | null;
    };
};

export type resultadoPublicaciones = {
    publicaciones: publicacionListado[];
    nextCursor: string | null;
    hasMore: boolean;
};

export type publicacionAgrupada = Omit<publicacionListado, "operador">;

export type operadorListado = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    publicaciones: publicacionAgrupada[];
};

export type resultadoPublicacionesAgrupadas = {
    operadores: operadorListado[];
    nextCursor: string | null;
    hasMore: boolean;
};

export type publicacionCompleta = {
    id: number;
    precio: number;
    foto: string | null;

    especie: string;
    variedad: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    codigoCalibre: string;
    pais: string;

    operador: {
        id: number;
        nombreFantasia: string;
        fotoPerfil: string | null;
        whatsApp: string;
    };
};

// Si seguimos usando numeric en vez de int para el precio
type publicacionCreateInput = Parameters<typeof db.orm.public.Publicacion.create>[0];
type precioPublicacion = NonNullable<publicacionCreateInput["precio"]>;
function convertirPrecio(valor: number): precioPublicacion {
    return valor.toFixed(2) as unknown as precioPublicacion;
}

type publicacionComparable = Pick<publicacionListado, "especie" | "variedad" | "presentacion" | "categoria" | "calibre">;
function compararAlfabeticamente(a: publicacionComparable, b: publicacionComparable): number {
    const campos = ["especie", "variedad", "presentacion", "categoria", "calibre"] as const;
    for (const campo of campos) {
        const resultado = a[campo].localeCompare(b[campo], "es", { sensitivity: "base" });
        if (resultado !== 0) return resultado;
    }
    return 0;
}

// Obtener Lista De Publicaciones
export async function consultarPublicaciones(filtros: filtrosPublicaciones = {}): Promise<resultadoPublicaciones> {
    // Publicacion activa
    let consulta = db.orm.public.PublicacionOperador.where((po) =>
        po.publicacion.some((publicacion) =>
            publicacion.publicacionActiva.eq(true)))
        .where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.publicacionDisponible.eq(true)));
    // Filtro especie
    if (filtros.especieId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.variedad.some((variedad) =>
                        variedad.especie.some((especie) =>
                            especie.id.eq(filtros.especieId!))))));
    }
    // Filtro variedad
    if (filtros.variedadId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.variedad.some((variedad) =>
                        variedad.id.eq(filtros.variedadId!)))));
    }
    // Filtro presentacion
    if (filtros.presentacionId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.id.eq(filtros.presentacionId!))));
    }
    // Filtro categoria
    if (filtros.categoriaId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.categoria.some((categoria) =>
                    categoria.id.eq(filtros.categoriaId!))));
    }
    // Filtro calibre
    if (filtros.calibreId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.calibre.some((calibre) =>
                    calibre.id.eq(filtros.calibreId!))));
    }
    // Filtro precio mínimo
    if (filtros.precioMin !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.precio.gte(convertirPrecio(filtros.precioMin!))));
    }
    // Filtro precio máximo
    if (filtros.precioMax !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.precio.lte(convertirPrecio(filtros.precioMax!))));
    }
    // Filtro de búsqueda
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
        const patronBusqueda = `%${busqueda}%`;
        consulta = consulta.where((po) =>
            or(po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.variedad.some((variedad) =>
                        variedad.especie.some((especie) =>
                            especie.nombreEspecie.ilike(patronBusqueda)))) ),
                po.publicacion.some((publicacion) =>
                    publicacion.presentacion.some((presentacion) =>
                        presentacion.variedad.some((variedad) =>
                            variedad.nombreVariedad.ilike(patronBusqueda)))),
                po.publicacion.some((publicacion) =>
                    publicacion.presentacion.some((presentacion) =>
                        presentacion.nombrePresentacion.ilike(patronBusqueda))),
                po.publicacion.some((publicacion) =>
                    publicacion.categoria.some((categoria) =>
                        categoria.nombreCategoria.ilike(patronBusqueda))),
                po.publicacion.some((publicacion) =>
                    publicacion.calibre.some((calibre) =>
                        calibre.nombreCalibre.ilike(patronBusqueda))),
                po.operador.some((operador) =>
                    operador.nombreFantasia.ilike(patronBusqueda))
            )
        );
    }
    // Obtener publicaciones
    const publicaciones = await consulta.include("publicacion", (publicacion) =>
        publicacion.select("id", "precio", "foto").include("presentacion", (presentacion) =>
            presentacion.include("variedad", (variedad) =>
                variedad.include("especie")))
        .include("categoria").include("calibre")).include("operador", (operador) =>
            operador.select("id", "nombreFantasia", "fotoPerfil")).all();   
    // Construir Resultado
    const resultado = publicaciones.map((publicacionOperador) => ({
        id: publicacionOperador.publicacion.id,
        precio: Number(publicacionOperador.publicacion.precio),
        foto: publicacionOperador.publicacion.foto,
        especie: publicacionOperador.publicacion.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacionOperador.publicacion.presentacion.variedad.nombreVariedad,
        presentacion: publicacionOperador.publicacion.presentacion.nombrePresentacion,
        categoria: publicacionOperador.publicacion.categoria.nombreCategoria,
        calibre: publicacionOperador.publicacion.calibre.nombreCalibre,
        operador: {
            id: publicacionOperador.operador.id,
            nombreFantasia: publicacionOperador.operador.nombreFantasia,
            fotoPerfil: publicacionOperador.operador.fotoPerfil,
        },
    }));   
    // Ordenar Resultado
    switch (filtros.orden) {
        case "precio_asc":
            resultado.sort((a, b) => a.precio - b.precio);
            break;
        case "precio_desc":
            resultado.sort((a, b) => b.precio - a.precio);
            break;
        case "alfabetico_asc":
            resultado.sort((a, b) => compararAlfabeticamente(a, b));
            break;
        case "alfabetico_desc":
            resultado.sort((a, b) => compararAlfabeticamente(b, a));
            break;
        default:
            break;
    }
    // Paginación
    const limite = 20; // 20 publicaciones a la vez.
    const inicio = filtros.cursor ? Number(filtros.cursor) : 0;
    const publicacionesPagina = resultado.slice(inicio, inicio + limite);
    const nuevoInicio = inicio + publicacionesPagina.length;
    const hasMore = nuevoInicio < resultado.length;
    const nextCursor = hasMore ? String(nuevoInicio) : null;
    // Retornar
    return {
        publicaciones: publicacionesPagina,
        nextCursor,
        hasMore,
    }; 
}

// Obtener Lista Publicaciones Agrupadas por Operador.
export async function consultarPublicacionesAgrupadas(filtros: filtrosPublicaciones = {}): Promise<resultadoPublicacionesAgrupadas> {
    // Publicacion activa
    let consulta = db.orm.public.PublicacionOperador.where((po) =>
        po.publicacion.some((publicacion) =>
            publicacion.publicacionActiva.eq(true)))
    .where((po) =>
        po.publicacion.some((publicacion) =>
            publicacion.publicacionDisponible.eq(true)));
    // Filtro especie
    if (filtros.especieId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.variedad.some((variedad) =>
                        variedad.especie.some((especie) =>
                            especie.id.eq(filtros.especieId!))))));
    }
    // Filtro variedad
    if (filtros.variedadId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.variedad.some((variedad) =>
                        variedad.id.eq(filtros.variedadId!)))));
    }
    // Filtro presentacion
    if (filtros.presentacionId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.id.eq(filtros.presentacionId!))));
    }
    // Filtro categoria
    if (filtros.categoriaId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.categoria.some((categoria) =>
                    categoria.id.eq(filtros.categoriaId!))));
    }
    // Filtro calibre
    if (filtros.calibreId !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.calibre.some((calibre) =>
                    calibre.id.eq(filtros.calibreId!))));
    }
    // Filtro precio mínimo
    if (filtros.precioMin !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.precio.gte(convertirPrecio(filtros.precioMin!))));
    }
    // Filtro precio máximo
    if (filtros.precioMax !== undefined) {
        consulta = consulta.where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.precio.lte(convertirPrecio(filtros.precioMax!))));
    }
    // Filtro de búsqueda
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
        const patronBusqueda = `%${busqueda}%`;
        consulta = consulta.where((po) =>
            or(po.publicacion.some((publicacion) =>
                publicacion.presentacion.some((presentacion) =>
                    presentacion.variedad.some((variedad) =>
                        variedad.especie.some((especie) =>
                            especie.nombreEspecie.ilike(patronBusqueda)))) ),
                po.publicacion.some((publicacion) =>
                    publicacion.presentacion.some((presentacion) =>
                        presentacion.variedad.some((variedad) =>
                            variedad.nombreVariedad.ilike(patronBusqueda)))),
                po.publicacion.some((publicacion) =>
                    publicacion.presentacion.some((presentacion) =>
                        presentacion.nombrePresentacion.ilike(patronBusqueda))),
                po.publicacion.some((publicacion) =>
                    publicacion.categoria.some((categoria) =>
                        categoria.nombreCategoria.ilike(patronBusqueda))),
                po.publicacion.some((publicacion) =>
                    publicacion.calibre.some((calibre) =>
                        calibre.nombreCalibre.ilike(patronBusqueda))),
                po.operador.some((operador) =>
                    operador.nombreFantasia.ilike(patronBusqueda))
            )
        );
    }
    // Obtener publicaciones
    const publicaciones = await consulta.include("publicacion", (publicacion) =>
        publicacion.select("id", "precio", "foto").include("presentacion", (presentacion) =>
            presentacion.include("variedad", (variedad) =>
                variedad.include("especie")))
        .include("categoria").include("calibre")).include("operador", (operador) =>
            operador.select("id", "nombreFantasia", "fotoPerfil")).all();
    // Agrupar publicaciones por operador
    const operadores = new Map<number, operadorListado>();
    for (const publicacionOperador of publicaciones) {
        const operadorId = publicacionOperador.operador.id;
        const publicacion: publicacionAgrupada = {
            id: publicacionOperador.publicacion.id,
            precio: Number(publicacionOperador.publicacion.precio),
            foto: publicacionOperador.publicacion.foto,
            especie: publicacionOperador.publicacion.presentacion.variedad.especie.nombreEspecie,
            variedad: publicacionOperador.publicacion.presentacion.variedad.nombreVariedad,
            presentacion: publicacionOperador.publicacion.presentacion.nombrePresentacion,
            categoria: publicacionOperador.publicacion.categoria.nombreCategoria,
            calibre: publicacionOperador.publicacion.calibre.nombreCalibre,
        };
        if (!operadores.has(operadorId)) {
            operadores.set(operadorId, {
                id: operadorId,
                nombreFantasia: publicacionOperador.operador.nombreFantasia,
                fotoPerfil: publicacionOperador.operador.fotoPerfil,
                publicaciones: [],
            });
        }
        operadores.get(operadorId)!.publicaciones.push(publicacion);
    }
    // Ordenar publicaciones
    for (const operador of operadores.values()) {
        switch (filtros.orden) {
            case "precio_asc":
                operador.publicaciones.sort((a, b) => a.precio - b.precio);
                break;
            case "precio_desc":
                operador.publicaciones.sort((a, b) => b.precio - a.precio);
                break;
            case "alfabetico_asc":
                operador.publicaciones.sort((a, b) => compararAlfabeticamente(a, b));
                break;
            case "alfabetico_desc":
                operador.publicaciones.sort((a, b) => compararAlfabeticamente(b, a));
                break;
            default:
                break;
        }
    }
    // Ordenar operadores
    const listaOperadores = Array.from(operadores.values());
    switch (filtros.orden) {
        case "precio_asc": 
            listaOperadores.sort((a, b) => a.publicaciones[0].precio - b.publicaciones[0].precio);
            break;
        case "precio_desc":
            listaOperadores.sort((a, b) => b.publicaciones[0].precio - a.publicaciones[0].precio);
            break;
        case "alfabetico_asc":
            listaOperadores.sort((a, b) => compararAlfabeticamente(a.publicaciones[0], b.publicaciones[0]));
            break;
        case "alfabetico_desc":
            listaOperadores.sort((a, b) => compararAlfabeticamente(b.publicaciones[0], a.publicaciones[0]));
            break;
        default:
            break;
    }
    // Paginación
    const limite = 5;
    const inicio = filtros.cursor ? Number(filtros.cursor) : 0;
    const operadoresPagina = listaOperadores.slice(inicio, inicio + limite);
    const nuevoInicio = inicio + operadoresPagina.length;
    const hasMore = nuevoInicio < listaOperadores.length;
    const nextCursor = hasMore ? String(nuevoInicio) : null;
    // Retornar
    return {
        operadores: operadoresPagina,
        nextCursor,
        hasMore,
    };
}

// Obtener Publicacion Completa
export async function consultarPublicacion(id: number): Promise<publicacionCompleta | null> {
    // Publicacion Activa
    const publicaciones = await db.orm.public.PublicacionOperador
        .where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.id.eq(id)))
        .where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.publicacionActiva.eq(true)))
        .where((po) =>
            po.publicacion.some((publicacion) =>
                publicacion.publicacionDisponible.eq(true)))
        .include("publicacion", (publicacion) =>
            publicacion.select("id", "precio", "foto").include("presentacion", (presentacion) =>
                presentacion.include("variedad", (variedad) =>
                    variedad.include("especie"))).include("categoria").include("calibre"))
        .include("operador", (operador) =>
            operador.select("id", "nombreFantasia", "fotoPerfil", "whatsApp"))
        .include("pais", (pais) =>
            pais.select("id", "codigoPais", "nombrePais")).all();

    if (publicaciones.length === 0) return null;
    const publicacionOperador = publicaciones[0];
    // Retornar
    return {
        id: publicacionOperador.publicacion.id,
        precio: Number(publicacionOperador.publicacion.precio),
        foto: publicacionOperador.publicacion.foto,
        especie: publicacionOperador.publicacion.presentacion.variedad.especie.nombreEspecie,
        variedad: publicacionOperador.publicacion.presentacion.variedad.nombreVariedad,
        presentacion: publicacionOperador.publicacion.presentacion.nombrePresentacion,
        categoria: publicacionOperador.publicacion.categoria.nombreCategoria,
        calibre: publicacionOperador.publicacion.calibre.nombreCalibre,
        codigoCalibre: publicacionOperador.publicacion.calibre.codigoCalibre,
        pais: publicacionOperador.pais.nombrePais,
        operador: {
            id: publicacionOperador.operador.id,
            nombreFantasia: publicacionOperador.operador.nombreFantasia,
            fotoPerfil: publicacionOperador.operador.fotoPerfil,
            whatsApp: publicacionOperador.operador.whatsApp,
        },
    };
}