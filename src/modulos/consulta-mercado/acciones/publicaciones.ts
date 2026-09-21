import { db } from "../../../infraestructura/persistencia/prisma/db";
import { and, or } from "@prisma/orm-postgres/orm-client";

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
    lote?: string;
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
    siguienteLote: string | null;
    hayMas: boolean;
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
    siguienteLote: string | null;
    hayMas: boolean;
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

// Obtener Lista De Publicaciones
export async function consultarPublicaciones(filtros: filtrosPublicaciones = {}): Promise<resultadoPublicaciones> {
    // Se arma la consulta base
    let consulta = db.sql.public.publicacionOperador
        .innerJoin(db.sql.public.publicacion, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacionOperador.publicacionId, tablas.publicacion.id))
        .innerJoin(db.sql.public.presentacion, (tablas, operaciones) =>
            operaciones.eq(tablas.publicacion.presentacionId, tablas.presentacion.id))
        .innerJoin(db.sql.public.variedad, (tablas, operaciones) =>
                operaciones.eq(tablas.presentacion.variedadId, tablas.variedad.id))
        .innerJoin(db.sql.public.especie, (tablas, operaciones) =>
                operaciones.eq(tablas.variedad.especieId, tablas.especie.id))
        .innerJoin(db.sql.public.categoria, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacion.categoriaId, tablas.categoria.id))
        .innerJoin( db.sql.public.calibre, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacion.calibreId, tablas.calibre.id))
        .innerJoin(db.sql.public.operador, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacionOperador.operadorId, tablas.operador.id))
        .select((tablas) => ({
            id: tablas.publicacion.id,
            precio: tablas.publicacion.precio,
            foto: tablas.publicacion.foto,
            especie: tablas.especie.nombreEspecie,
            variedad: tablas.variedad.nombreVariedad,
            presentacion: tablas.presentacion.nombrePresentacion,
            categoria: tablas.categoria.nombreCategoria,
            calibre: tablas.calibre.codigoCalibre,
            operadorId: tablas.operador.id,
            operadorNombreFantasia: tablas.operador.nombreFantasia,
            operadorFotoPerfil: tablas.operador.fotoPerfil
        }));

    // Publicacion Activa y Disponible
    consulta = consulta.where((tablas, operaciones) =>
        operaciones.and(
            operaciones.eq(tablas.publicacion.publicacionActiva, true), 
            operaciones.eq(tablas.publicacion.publicacionDisponible, true)
        )
    );

    // Jerarquia Especie > Variedad > Presentación
    const especieId = filtros.especieId;
    const variedadId = especieId !== undefined ? filtros.variedadId : undefined;
    const presentacionId = variedadId !== undefined ? filtros.presentacionId : undefined;
    
    // Filtro de Especie
    if (especieId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.especie.id, especieId)
        );
    }
    
    // Filtro de Variedad
    if (variedadId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.variedad.id, variedadId)
        );
    }
    
    // Filtro de Presentacion
    if (presentacionId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.presentacion.id, presentacionId)
        );
    }

    // Filtro de Categoria
    if (filtros.categoriaId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.categoria.id, filtros.categoriaId!)
        );
    }

    // Filtro de Calibre
    if (filtros.calibreId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.calibre.id, filtros.calibreId!)
        );
    }

    // Filtro de Precio Minimo
    if (filtros.precioMin !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.gte(tablas.publicacion.precio, convertirPrecio(filtros.precioMin!))
        );
    }

    // Filtro de Precio Maximo
    if (filtros.precioMax !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.lte(tablas.publicacion.precio, convertirPrecio(filtros.precioMax!))
        );
    }

    // Filtro de Barra de Busqueda
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
        const patronBusqueda = `%${busqueda}%`;
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.or(
                // Busca por nombre de Especie
                operaciones.ilike(tablas.especie.nombreEspecie, patronBusqueda),
                // Busca por nombre de Variedad
                operaciones.ilike(tablas.variedad.nombreVariedad, patronBusqueda),
                // Busca por nombre de Presentacion
                operaciones.ilike(tablas.presentacion.nombrePresentacion, patronBusqueda),
                // Busca por nombre de Categoria
                operaciones.ilike(tablas.categoria.nombreCategoria, patronBusqueda),
                // Busca por nombre de Calibre
                operaciones.ilike(tablas.calibre.codigoCalibre, patronBusqueda),
                // Busca por nombre fantasia de Operador
                operaciones.ilike(tablas.operador.nombreFantasia, patronBusqueda)
            )
        );
    }

    // Filtros de Ordenamiento
    switch (filtros.orden) {
        // Precio Ascendente
        case "precio_asc":
            consulta = consulta
                .orderBy((tablas) => tablas.publicacion.precio, { direction: "asc" })
                // Desempate por id
                .orderBy((tablas) => tablas.publicacion.id, { direction: "asc" });
            break;
        // Precio Descendiente
        case "precio_desc":
            consulta = consulta
                .orderBy((tablas) => tablas.publicacion.precio, { direction: "desc" })
                // Desempate por id
                .orderBy((tablas) => tablas.publicacion.id, { direction: "asc" });
            break;
        // Alfabetico Ascendente
        case "alfabetico_asc":
            consulta = consulta
                // Primero a nivel de Especie
                .orderBy("especie", { direction: "asc" })
                // Segundo a nivel de Variedad
                .orderBy("variedad", { direction: "asc" })
                // Desempate por id
                .orderBy("id", { direction: "asc" });
            break;
        // Alfabetico Descendiente
        case "alfabetico_desc":
            consulta = consulta
                // Primero a nivel de Especie
                .orderBy("especie", { direction: "desc" })
                // Segundo a nivel de Variedad
                .orderBy("variedad", { direction: "desc" })
                // Desempate por id
                .orderBy("id", { direction: "asc" });
            break;
        // No hay Ordenamiento
        case "ninguno":
        default:
            // Solo id
            consulta = consulta.orderBy( (tablas) => tablas.publicacion.id, { direction: "asc" });
            break;
    }

    // Paginacion por Lotes de 10 publicaciones (se puede modificar modificando limite)
    const limite = 10;
    const inicio = filtros.lote ? Number(filtros.lote) : 0;
    if (!Number.isInteger(inicio) || inicio < 0) {
        throw new Error(`El lote "${filtros.lote}" no es válido.`);
    }

    // Arma la consulta con el lote actual de publicaciones
    const plan = consulta
        .select((tablas) => ({
            id: tablas.publicacion.id,
            precio: tablas.publicacion.precio,
            foto: tablas.publicacion.foto,
            especie: tablas.especie.nombreEspecie,
            variedad: tablas.variedad.nombreVariedad,
            presentacion: tablas.presentacion.nombrePresentacion,
            categoria: tablas.categoria.nombreCategoria,
            calibre: tablas.calibre.codigoCalibre,
            operadorId: tablas.operador.id,
            operadorNombreFantasia: tablas.operador.nombreFantasia,
            operadorFotoPerfil: tablas.operador.fotoPerfil,
        }))
        .limit(limite + 1)
        .offset(inicio)
        .build();

    // Ejecuta la consulta
    const filas = await db.runtime().query(plan);

    // Determina si quedan más publicaciones por entregar
    const hayMas = filas.length > limite;
    const filasPagina = filas.slice(0, limite);

    // Arma el resultado a entregar
    const publicaciones: publicacionListado[] =
        filasPagina.map((fila) => ({
            id: Number(fila.id),
            precio: Number(fila.precio),
            foto: fila.foto,
            especie: fila.especie,
            variedad: fila.variedad,
            presentacion: fila.presentacion,
            categoria: fila.categoria,
            calibre: fila.calibre,
            operador: {
                id: Number(fila.operadorId),
                nombreFantasia: fila.operadorNombreFantasia,
                fotoPerfil: fila.operadorFotoPerfil,
            },
        }));

    // Determina el siguiente lote (si hay más)
    const siguienteLote = hayMas ? String(inicio + limite) : null;

    // Se retorna
    return {
        publicaciones,
        siguienteLote,
        hayMas
    };
}

export async function consultarPublicacionesAgrupadas(filtros: filtrosPublicaciones = {}): Promise<resultadoPublicacionesAgrupadas> {
    // Se arma la consulta base
    let consulta = db.sql.public.publicacionOperador
        .innerJoin(db.sql.public.publicacion, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacionOperador.publicacionId, tablas.publicacion.id))
        .innerJoin(db.sql.public.presentacion, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacion.presentacionId, tablas.presentacion.id))
        .innerJoin(db.sql.public.variedad, (tablas, operaciones) =>
                operaciones.eq(tablas.presentacion.variedadId, tablas.variedad.id))
        .innerJoin(db.sql.public.especie, (tablas, operaciones) =>
                operaciones.eq(tablas.variedad.especieId, tablas.especie.id))
        .innerJoin(db.sql.public.categoria, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacion.categoriaId, tablas.categoria.id))
        .innerJoin(db.sql.public.calibre, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacion.calibreId, tablas.calibre.id))
        .innerJoin(db.sql.public.operador, (tablas, operaciones) =>
                operaciones.eq(tablas.publicacionOperador.operadorId, tablas.operador.usuarioId))
        .select((tablas) => ({
            publicacionId: tablas.publicacion.id,
            precio: tablas.publicacion.precio,
            foto: tablas.publicacion.foto,
            especie: tablas.especie.nombreEspecie,
            variedad: tablas.variedad.nombreVariedad,
            presentacion: tablas.presentacion.nombrePresentacion,
            categoria: tablas.categoria.nombreCategoria,
            calibre: tablas.calibre.codigoCalibre,
            operadorId: tablas.operador.id,
            operadorNombreFantasia: tablas.operador.nombreFantasia,
            operadorFotoPerfil: tablas.operador.fotoPerfil,
        }));

    // Publicacion Activa y Disponible
    consulta = consulta.where((tablas, operaciones) =>
        operaciones.and(
            operaciones.eq(tablas.publicacion.publicacionActiva, true), 
            operaciones.eq(tablas.publicacion.publicacionDisponible, true)
        )
    );

    // Jerarquia Especie > Variedad > Presentación
    const especieId = filtros.especieId;
    const variedadId = especieId !== undefined ? filtros.variedadId : undefined;
    const presentacionId = variedadId !== undefined ? filtros.presentacionId : undefined;
    
    // Filtro de Especie
    if (especieId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.especie.id, especieId)
        );
    }
    
    // Filtro de Variedad
    if (variedadId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.variedad.id, variedadId)
        );
    }
    
    // Filtro de Presentacion
    if (presentacionId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.presentacion.id, presentacionId)
        );
    }

    // Filtro de Categoria
    if (filtros.categoriaId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.categoria.id, filtros.categoriaId!)
        );
    }

    // Filtro de Calibre
    if (filtros.calibreId !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.eq(tablas.calibre.id, filtros.calibreId!)
        );
    }

    // Filtro de Precio Minimo
    if (filtros.precioMin !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.gte(tablas.publicacion.precio, convertirPrecio(filtros.precioMin!))
        );
    }

    // Filtro de Precio Maximo
    if (filtros.precioMax !== undefined) {
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.lte(tablas.publicacion.precio, convertirPrecio(filtros.precioMax!))
        );
    }

    // Filtro de Barra de Busqueda
    const busqueda = filtros.busqueda?.trim();
    if (busqueda) {
        const patronBusqueda = `%${busqueda}%`;
        consulta = consulta.where((tablas, operaciones) =>
            operaciones.or(
                // Busca por nombre de Especie
                operaciones.ilike(tablas.especie.nombreEspecie, patronBusqueda),
                // Busca por nombre de Variedad
                operaciones.ilike(tablas.variedad.nombreVariedad, patronBusqueda),
                // Busca por nombre de Presentacion
                operaciones.ilike(tablas.presentacion.nombrePresentacion, patronBusqueda),
                // Busca por nombre de Categoria
                operaciones.ilike(tablas.categoria.nombreCategoria, patronBusqueda),
                // Busca por nombre de Calibre
                operaciones.ilike(tablas.calibre.codigoCalibre, patronBusqueda),
                // Busca por nombre fantasia de Operador
                operaciones.ilike(tablas.operador.nombreFantasia, patronBusqueda)
            )
        );
    }

    const consultaFiltrada = consulta.as("filtradas");

    // Obtener operadores
    let consultaOperadores =
        db.sql.public.operador
            .innerJoin(consultaFiltrada,
                (tablas, operaciones) =>
                    operaciones.eq(tablas.operador.id, tablas.filtradas.operadorId))
            .select((tablas, operaciones) => ({
                operadorId: tablas.filtradas.operadorId,
                operadorNombreFantasia: tablas.filtradas.operadorNombreFantasia,
                operadorFotoPerfil: tablas.filtradas.operadorFotoPerfil,
                precioMin: operaciones.min(tablas.filtradas.precio),
                precioMax: operaciones.max(tablas.filtradas.precio),
                especieOrden: operaciones.min(tablas.filtradas.especie),
                variedadOrden: operaciones.min(tablas.filtradas.variedad),
            }))
            .groupBy("operadorId", "operadorNombreFantasia", "operadorFotoPerfil");

    // Ordenar los operadores dependiendo del filtro de ordenamiento
    switch (filtros.orden) {
        // Precio Ascendente
        case "precio_asc":
            consultaOperadores = consultaOperadores
                .orderBy("precioMin", { direction: "asc" })
                // Desempate por id
                .orderBy("operadorId", { direction: "asc" });
            break;
        // Precio Descendiente
        case "precio_desc":
            consultaOperadores = consultaOperadores
                .orderBy("precioMax", { direction: "desc" })
                // Desempate por id
                .orderBy("operadorId", { direction: "asc" });
            break;
        // Alfabetico Ascendente
        case "alfabetico_asc":
            consultaOperadores = consultaOperadores
                // Primero por Especie
                .orderBy("especieOrden", { direction: "asc" })
                // Despues por Variedad
                .orderBy("variedadOrden", { direction: "asc" })
                // Desempate por id
                .orderBy("operadorId", { direction: "asc" });
            break;
        // Alfabetico Descendiente
        case "alfabetico_desc":
            consultaOperadores = consultaOperadores
                // Primero por Especie
                .orderBy("especieOrden", { direction: "desc" })
                // Despues por Variedad
                .orderBy("variedadOrden", { direction: "desc" })
                // Desempate por id
                .orderBy("operadorId", { direction: "asc" });
            break;
        // Sin orden
        default:
            consultaOperadores = consultaOperadores
                // Solo id
                .orderBy("operadorId", { direction: "asc" });
            break;
    }

    // Paginacion por lotes de a 3 operadores (se puede cambiar)
    const limite = 3;
    const inicio = filtros.lote ? Number(filtros.lote) : 0;
    const planOperadores = consultaOperadores.limit(limite + 1).offset(inicio).build();
    const filasOperadores = await db.runtime().query(planOperadores);
    const hayMas = filasOperadores.length > limite;
    const operadoresPagina = filasOperadores.slice(0, limite);
    const siguienteLote = hayMas ? String(inicio + limite) : null;

    // Si no hay operadores, no hace falta una segunda consulta
    if (operadoresPagina.length === 0) {
        return {
            operadores: [],
            siguienteLote: null,
            hayMas: false,
        };
    }

    const operadorIds = operadoresPagina.map((operador) => Number(operador.operadorId));
    let consultaPublicaciones = consulta.where((tablas, operaciones) => operaciones.in(tablas.operadorId, operadorIds));

    // Orden dentro de cada operador
    switch (filtros.orden) {
        case "precio_asc":
            consultaPublicaciones = consultaPublicaciones
                .orderBy("operadorId", { direction: "asc" })
                .orderBy("precio", { direction: "asc" })
                .orderBy("publicacionId", { direction: "asc" });
            break;
        case "precio_desc":
            consultaPublicaciones = consultaPublicaciones
                .orderBy("operadorId", { direction: "asc" })
                .orderBy("precio", { direction: "desc" })
                .orderBy("publicacionId", { direction: "asc" });
            break;
        case "alfabetico_asc":
            consultaPublicaciones = consultaPublicaciones
                .orderBy("operadorId", { direction: "asc" })
                .orderBy("especie", { direction: "asc" })
                .orderBy("variedad", { direction: "asc" })
                .orderBy("publicacionId", { direction: "asc" });
            break;
        case "alfabetico_desc":
            consultaPublicaciones = consultaPublicaciones
                .orderBy("operadorId", { direction: "asc" })
                .orderBy("especie", { direction: "desc" })
                .orderBy("variedad", { direction: "desc" })
                .orderBy("publicacionId", { direction: "asc" });
            break;
        default:
            consultaPublicaciones = consultaPublicaciones
                .orderBy("operadorId", { direction: "asc" })
                .orderBy("publicacionId", { direction: "asc" });
            break;
    }

    // Ejecutar segunda consulta
    const planPublicaciones = consultaPublicaciones.build();
    const filasPublicaciones = await db.runtime().query(planPublicaciones);

    // Agrupar publicaciones para construir la respuesta
    const publicacionesPorOperador = new Map<number, publicacionAgrupada[]>();
    for (const fila of filasPublicaciones) {
        const operadorId = Number(fila.operadorId);
        let publicaciones = publicacionesPorOperador.get(operadorId);

        if (!publicaciones) {
            publicaciones = [];
            publicacionesPorOperador.set(operadorId, publicaciones);
        }

        publicaciones.push({
            id: Number(fila.publicacionId),
            precio: Number(fila.precio),
            foto: fila.foto,
            especie: fila.especie,
            variedad: fila.variedad,
            presentacion: fila.presentacion,
            categoria: fila.categoria,
            calibre: fila.calibre,
        });
    }

    // Construir la lista de operadores a retornar
    const operadores: operadorListado[] =
        operadoresPagina.map((fila) => {
            const operadorId = Number(fila.operadorId);
            return {
                id: operadorId,
                nombreFantasia: fila.operadorNombreFantasia,
                fotoPerfil: fila.operadorFotoPerfil,
                publicaciones: publicacionesPorOperador.get(operadorId) ?? [],
            };
        });

    // Retornar
    return {
        operadores,
        siguienteLote,
        hayMas,
    };
}

// Obtener Publicacion Completa
export async function consultarPublicacion(id: number): Promise<publicacionCompleta | null> {
    // Publicacion Activa
    const publicacionOperador = await db.orm.public.PublicacionOperador
        .where((po) =>
            po.publicacion.some((publicacion) =>
                and(publicacion.id.eq(id), publicacion.publicacionActiva.eq(true), publicacion.publicacionDisponible.eq(true))))
        .include("publicacion", (publicacion) =>
            publicacion.select("id", "precio", "foto").include("presentacion", (presentacion) =>
                presentacion.include("variedad", (variedad) =>
                    variedad.include("especie"))).include("categoria").include("calibre"))
        .include("operador", (operador) =>
            operador.select("id", "nombreFantasia", "fotoPerfil", "whatsApp"))
        .include("pais", (pais) =>
            pais.select("id", "codigoPais", "nombrePais")).first();

    if (!publicacionOperador) return null;
    
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