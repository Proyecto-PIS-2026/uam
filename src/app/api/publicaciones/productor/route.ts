import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaPublicacionProductor } from "@/modulos/publicaciones/altaPublicacionProductor";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { ErrorCuerpoDemasiadoGrande, leerJsonLimitado } from "@/infraestructura/http/cuerpo-limitado";

export const runtime = "nodejs";

async function exigirProductorOAdministrador() {
    const sesion = await obtenerSesion();
    if (!sesion) throw new ErrorAutorizacion(401, "Iniciá sesión para continuar.");
    if (sesion.rol !== "PRODUCTOR" && sesion.rol !== "ADMINISTRADOR") {
        throw new ErrorAutorizacion(403, "No tenés permiso para realizar esta operación.");
    }
    return sesion;
}

export async function GET() {
    try {
        await exigirProductorOAdministrador();
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
        const sesion = await exigirProductorOAdministrador();
        let datos: unknown;
        try {
            datos = await leerJsonLimitado(request);
        } catch (error) {
            if (error instanceof ErrorCuerpoDemasiadoGrande) {
                return NextResponse.json({ errores: [error.message] }, { status: 413 });
            }
            return NextResponse.json({ errores: ["El cuerpo de la solicitud no es un JSON válido."] }, { status: 400 });
        }
        if (typeof datos !== "object" || datos === null || Array.isArray(datos)) {
            return NextResponse.json({ errores: ["Los datos de la publicación no son válidos."] }, { status: 400 });
        }

        if (autorizado("administracion.publicacion.crear", sesion)) {
            const productorId = "productorId" in datos ? datos.productorId : undefined;
            if (typeof productorId !== "number" || !Number.isSafeInteger(productorId) || productorId <= 0) {
                return NextResponse.json({ errores: ["Debe seleccionar un productor."] }, { status: 400 });
            }
            const productor = await db.orm.public.Productor.where({ id: productorId }).select("id").first();
            if (!productor) {
                return NextResponse.json({ errores: ["El productor no existe."] }, { status: 404 });
            }
            const resultado = await altaPublicacionProductor({ ...datos, productorId: productor.id });
            return NextResponse.json(resultado, { status: resultado.esValido ? 201 : 400 });
        }

        const productor = await db.orm.public.Productor.where({ usuarioId: sesion.usuarioId }).select("id", "usuarioId").first();
        if (!productor) {
            return NextResponse.json({ errores: ["No se encontró el Productor."] }, { status: 404 });
        }
        if (!autorizado("productor.publicacion.crear", sesion, productor)) {
            return NextResponse.json({ errores: ["No tenés permiso para realizar esta operación."] }, { status: 403 });
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
