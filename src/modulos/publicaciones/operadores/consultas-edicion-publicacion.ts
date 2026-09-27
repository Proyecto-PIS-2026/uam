import { db } from "../../../infraestructura/persistencia/prisma/db";
import type { OpcionCategoria, OpcionEdicion, OpcionPresentacion, OpcionVariedad } from "./componentes/DrawerEditarPublicacion";

export type OpcionesEdicionPublicacion = {
    especies: OpcionEdicion[];
    variedades: OpcionVariedad[];
    presentaciones: OpcionPresentacion[];
    categorias: OpcionCategoria[];
    calibres: OpcionEdicion[];
};

export async function obtenerOpcionesEdicionPublicacion(): Promise<OpcionesEdicionPublicacion> {
    const [especies, variedades, presentaciones, categorias, calibres] = await Promise.all([
        db.orm.public.Especie
            .select("id", "nombreEspecie")
            .where({ especieActiva: true })
            .orderBy((especie) => especie.nombreEspecie.asc())
            .all(),
        db.orm.public.Variedad
            .select("id", "nombreVariedad", "especieId")
            .where({ variedadActiva: true })
            .orderBy((variedad) => variedad.nombreVariedad.asc())
            .all(),
        db.orm.public.Presentacion
            .select("id", "nombrePresentacion", "variedadId")
            .where({ presentacionActiva: true })
            .orderBy((presentacion) => presentacion.nombrePresentacion.asc())
            .all(),
        db.orm.public.Categoria
            .select("id", "nombreCategoria", "especieId")
            .orderBy((categoria) => categoria.nombreCategoria.asc())
            .all(),
        db.orm.public.Calibre
            .select("id", "codigoCalibre", "nombreCalibre")
            .orderBy((calibre) => calibre.nombreCalibre.asc())
            .all(),
    ]);

    const especiesActivas = new Set(especies.map((especie) => especie.id));
    const variedadesDisponibles = variedades.filter((variedad) => especiesActivas.has(variedad.especieId));
    const variedadesActivas = new Set(variedadesDisponibles.map((variedad) => variedad.id));
    const presentacionesDisponibles = presentaciones.filter((presentacion) => variedadesActivas.has(presentacion.variedadId));
    const categoriasDisponibles = categorias.filter((categoria) => categoria.especieId === null || especiesActivas.has(categoria.especieId));

    return {
        especies: especies.map((especie) => ({ id: especie.id, nombre: especie.nombreEspecie })),
        variedades: variedadesDisponibles.map((variedad) => ({
            id: variedad.id,
            nombre: variedad.nombreVariedad,
            especieId: variedad.especieId,
        })),
        presentaciones: presentacionesDisponibles.map((presentacion) => ({
            id: presentacion.id,
            nombre: presentacion.nombrePresentacion,
            variedadId: presentacion.variedadId,
        })),
        categorias: categoriasDisponibles.map((categoria) => ({
            id: categoria.id,
            nombre: categoria.nombreCategoria,
            especieId: categoria.especieId,
        })),
        calibres: calibres.map((calibre) => ({
            id: calibre.id,
            nombre: `${calibre.codigoCalibre} - ${calibre.nombreCalibre}`,
        })),
    };
}
