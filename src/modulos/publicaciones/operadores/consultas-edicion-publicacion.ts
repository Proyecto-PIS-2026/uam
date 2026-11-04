import { db } from "../../../infraestructura/persistencia/prisma/db";
import type { OpcionesEdicionPublicacion } from "./tipos";
import { ordenarOpcionesPorNombre } from "./ordenar-opciones";

export async function obtenerOpcionesEdicionPublicacion(): Promise<OpcionesEdicionPublicacion> {
    const [especies, variedades, envases, kilos, categorias, calibres, paises] = await Promise.all([
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
        db.orm.public.Envase.select("id", "nombreEnvase").orderBy((envase) => envase.id.asc()).all(),
        db.orm.public.KilosEmpaquetado.select("id", "valor").orderBy((peso) => peso.id.asc()).all(),
        db.orm.public.Categoria
            .select("id", "nombreCategoria", "especieId")
            .orderBy((categoria) => categoria.nombreCategoria.asc())
            .all(),
        db.orm.public.Calibre
            .select("id", "codigoCalibre", "nombreCalibre")
            .orderBy((calibre) => calibre.nombreCalibre.asc())
            .all(),
        db.orm.public.Pais
            .select("id", "nombrePais")
            .orderBy((pais) => pais.nombrePais.asc())
            .all(),
    ]);

    const especiesActivas = new Set(especies.map((especie) => especie.id));
    const variedadesDisponibles = variedades.filter((variedad) => especiesActivas.has(variedad.especieId));
    const categoriasDisponibles = categorias.filter((categoria) => categoria.especieId === null || especiesActivas.has(categoria.especieId));

    return {
        especies: ordenarOpcionesPorNombre(especies.map((especie) => ({ id: especie.id, nombre: especie.nombreEspecie }))),
        variedades: ordenarOpcionesPorNombre(variedadesDisponibles.map((variedad) => ({
            id: variedad.id,
            nombre: variedad.nombreVariedad,
            especieId: variedad.especieId,
        }))),
        envases: envases.map((envase) => ({ id: envase.id, nombre: envase.nombreEnvase })),
        kilos: kilos.map((peso) => ({ id: peso.id, nombre: peso.valor })),
        categorias: ordenarOpcionesPorNombre(categoriasDisponibles.map((categoria) => ({
            id: categoria.id,
            nombre: categoria.nombreCategoria,
            especieId: categoria.especieId,
        }))),
        calibres: ordenarOpcionesPorNombre(calibres.map((calibre) => ({
            id: calibre.id,
            nombre: calibre.codigoCalibre === calibre.nombreCalibre
                ? calibre.nombreCalibre : `${calibre.codigoCalibre} - ${calibre.nombreCalibre}`,
        }))),
        paises: ordenarOpcionesPorNombre(paises.map((pais) => ({ id: pais.id, nombre: pais.nombrePais }))),
    };
}
