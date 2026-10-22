import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaPublicacionProductor } from "@/modulos/publicaciones/altaPublicacionProductor";
import { ErrorAutorizacion, exigirProductor } from "@/modulos/identidad-acceso/autorizacion/controles";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";

export const runtime = "nodejs";

export async function GET() {
    try {
        await exigirProductor();
        const [especies, variedades, presentaciones, categorias, calibres, paises] = await Promise.all([
            db.orm.public.Especie.select("id", "nombreEspecie").where({ especieActiva: true }).all(),
            db.orm.public.Variedad.select("id", "especieId", "nombreVariedad").where({ variedadActiva: true }).all(),
            db.orm.public.Presentacion.select("id", "variedadId", "nombrePresentacion").where({ presentacionActiva: true }).all(),
            db.orm.public.Categoria.select("id", "especieId", "nombreCategoria").all(),
            db.orm.public.Calibre.select("id", "nombreCalibre").all(),
            db.orm.public.Pais.select("id", "codigoPais", "nombrePais").all(),
        ]);
        return NextResponse.json({
            especies: especies.map(({ id, nombreEspecie }) => ({ id, nombre: nombreEspecie })),
            variedades: variedades.map(({ id, especieId, nombreVariedad }) => ({ id, especieId, nombre: nombreVariedad })),
            presentaciones: presentaciones.map(({ id, variedadId, nombrePresentacion }) => ({ id, variedadId, nombre: nombrePresentacion })),
            categorias: categorias.map(({ id, especieId, nombreCategoria }) => ({ id, especieId, nombre: nombreCategoria })),
            calibres: calibres.map(({ id, nombreCalibre }) => ({ id, nombre: nombreCalibre })),
            paises: paises.map(({ id, codigoPais, nombrePais }) => ({ id, codigo: codigoPais, nombre: nombrePais })),
        });
    } catch (error) {
        if (error instanceof ErrorAutorizacion) {
            return NextResponse.json({ errores: [error.message] }, { status: error.status });
        }
        console.error("Error al cargar el alta de publicaciones de Productor:", error);
        return NextResponse.json({ errores: ["No se pudieron cargar los datos del formulario."] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const sesion = await exigirProductor();
        const productor = await db.orm.public.Productor.where({ usuarioId: sesion.usuarioId }).select("id", "usuarioId").first();
        if (!productor) {
            return NextResponse.json({ errores: ["No se encontró el Productor."] }, { status: 404 });
        }
        if (!autorizado("productor.publicacion.crear", sesion, productor)) {
            return NextResponse.json({ errores: ["No tenés permiso para realizar esta operación."] }, { status: 403 });
        }
        let datos: unknown;
        try {
            datos = await request.json();
        } catch {
            return NextResponse.json({ errores: ["El cuerpo de la solicitud no es un JSON válido."] }, { status: 400 });
        }
        if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
            return NextResponse.json({ errores: ["Los datos de la publicación no son válidos."] }, { status: 400 });
        }
        if ("productorId" in datos && datos.productorId !== productor.id) {
            return NextResponse.json({ errores: ["No tenés permiso para publicar para otro Productor."] }, { status: 403 });
        }
        const resultado = await altaPublicacionProductor({ ...datos, productorId: productor.id });
        return NextResponse.json(resultado, { status: resultado.esValido ? 201 : 400 });
    } catch (error) {
        if (error instanceof ErrorAutorizacion) {
            return NextResponse.json({ errores: [error.message] }, { status: error.status });
        }
        console.error("Error al crear publicación de Productor:", error);
        return NextResponse.json({ errores: ["No se pudo guardar la publicación."] }, { status: 500 });
    }
}
