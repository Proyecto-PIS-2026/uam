import { notFound } from "next/navigation";
import { all } from "@prisma/orm-postgres/orm-client";
import { db } from "@/infraestructura/persistencia/prisma/db";
import FormularioEdicion from "./formulario";

export default async function Page({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const publicacionOperadorId = Number(id);

    if (!Number.isSafeInteger(publicacionOperadorId) || publicacionOperadorId <= 0) {
        notFound();
    }

    // En desarrollo, imprime en la terminal los IDs reales para probar la edición.
    // Para abrir esta pantalla se usa publicacionOperadorId en la ruta /mi-mercado/[id]/editar.
    if (process.env.NODE_ENV === "development") {
        const vinculos = await db.orm.public.PublicacionOperador
            .select("id", "publicacionId", "operadorId")
            .where(() => all())
            .all();

        const cantidadPorOperador = new Map<number, number>();
        for (const item of vinculos) {
            cantidadPorOperador.set(
                item.operadorId,
                (cantidadPorOperador.get(item.operadorId) ?? 0) + 1
            );
        }

        console.log(
            "Publicaciones reales disponibles:",
            vinculos.map((item) => ({
                publicacionOperadorId: item.id,
                publicacionId: item.publicacionId,
                operadorId: item.operadorId,
                cantidadDelOperador: cantidadPorOperador.get(item.operadorId),
            }))
        );
    }
    ///////////////////////

    const vinculoPorIdOperador = await db.orm.public.PublicacionOperador
        .where({ id: publicacionOperadorId })
        .include("publicacion", (publicacion) =>
            publicacion
                .include("presentacion", (presentacion) =>
                    presentacion.include("variedad", (variedad) =>
                        variedad.include("especie")
                    )
                )
                .include("categoria")
                .include("calibre")
        )
        .first();

    const vinculo = vinculoPorIdOperador ?? await db.orm.public.PublicacionOperador
        .where({ publicacionId: publicacionOperadorId })
        .include("publicacion", (publicacion) =>
            publicacion
                .include("presentacion", (presentacion) =>
                    presentacion.include("variedad", (variedad) =>
                        variedad.include("especie")
                    )
                )
                .include("categoria")
                .include("calibre")
        )
        .first();

    if (!vinculo) {
        notFound();
    }

    const publicacion = vinculo.publicacion;
    const especieId = publicacion.presentacion.variedad.especie.id;
    const datosIniciales = {
        precio:
            publicacion.precio == null
                ? null
                : String(publicacion.precio),
        foto:
            typeof publicacion.foto === "string"
                ? publicacion.foto
                : null,
        categoriaId: Number(publicacion.categoriaId),
        calibreId: Number(publicacion.calibreId),
        presentacionId: Number(publicacion.presentacionId),
        disponible: Boolean(publicacion.publicacionDisponible),
    };

    const [calibresBD, presentacionesBD, categoriasBD] = await Promise.all([
        db.orm.public.Calibre.where(() => all()).all(),
        db.orm.public.Presentacion
            .where((presentacion) =>
                presentacion.presentacionActiva.eq(true)
            )
            .include("variedad", (variedad) =>
                variedad
                    .select("especieId", "variedadActiva", "nombreVariedad")
                    .include("especie", (especie) =>
                        especie.select("especieActiva")
                    )
            )
            .all(),
        db.orm.public.Categoria.where(() => all()).all(),
    ]);

    const presentaciones = presentacionesBD
        .filter(
            (presentacion) =>
                presentacion.variedad.especieId === especieId &&
                presentacion.variedad.variedadActiva &&
                presentacion.variedad.especie.especieActiva
        )
        .map(({ id: presentacionId, nombrePresentacion, variedad }) => ({
            id: presentacionId,
            nombrePresentacion,
            nombreVariedad: variedad.nombreVariedad,
        }));

    const calibres = calibresBD
        .filter(({ nombreCalibre, codigoCalibre }) => {
            const nombreNormalizado = nombreCalibre.trim().toLocaleUpperCase();
            const codigoNormalizado = codigoCalibre.trim().toLocaleUpperCase();

            return (
                nombreNormalizado !== "EXTRA" &&
                codigoNormalizado !== "EX" &&
                !nombreNormalizado.includes("PLANTAS")
            );
        })
        .map(({ id: calibreId, nombreCalibre }) => ({
            id: calibreId,
            nombreCalibre,
        }));

    const categorias = categoriasBD
        .filter(
            (categoria) =>
                categoria.especieId === null ||
                Number(categoria.especieId) === especieId
        )
        .map(({ id: categoriaId, nombreCategoria }) => ({
            id: Number(categoriaId),
            nombreCategoria,
        }));

    return (
        <FormularioEdicion
            publicacionOperadorId={vinculo.id}
            nombreEspecie={publicacion.presentacion.variedad.especie.nombreEspecie}
            nombreVariedad={publicacion.presentacion.variedad.nombreVariedad}
            inicial={datosIniciales}
            calibres={calibres}
            presentaciones={presentaciones}
            categorias={categorias}
        />
    );
}
