import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaPublicacionProductor } from "@/modulos/publicaciones/altaPublicacionProductor";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { ErrorCuerpoDemasiadoGrande, leerJsonLimitado } from "@/infraestructura/http/cuerpo-limitado";
import { Temporal } from "temporal-polyfill";

export const runtime = "nodejs";

async function exigirProductorOAdministrador() {
    const sesion = await obtenerSesion();
    if (!sesion) throw new ErrorAutorizacion(401, "Iniciá sesión para continuar.");
    if (sesion.rol !== "PRODUCTOR" && sesion.rol !== "ADMINISTRADOR") {
        throw new ErrorAutorizacion(403, "No tenés permiso para realizar esta operación.");
    }
    return sesion;
}

async function registrarEstadisticaPublicacion(usuarioId: number) {
    try {
        const usuarioVinculado = await db.orm.public.Usuario.select("username").where({ id: usuarioId }).first();
        if (usuarioVinculado?.username) {
            const ahora = new Date();
            const anio = ahora.getFullYear();
            const mes = String(ahora.getMonth() + 1).padStart(2, "0");
            const dia = String(ahora.getDate()).padStart(2, "0");
            const fechaStr = `${anio}-${mes}-${dia}`;
            const fechaInstant = Temporal.Instant.from(`${fechaStr}T00:00:00Z`);
            const username = usuarioVinculado.username;

            const existente = await db.orm.public.EstadisticaPublicacion
                .where({ fecha: fechaInstant, username })
                .first();

            if (existente) {
                await db.orm.public.EstadisticaPublicacion
                    .where({ id: existente.id })
                    .update({ cantidad: existente.cantidad + 1 });
            } else {
                await db.orm.public.EstadisticaPublicacion.create({
                    fecha: fechaInstant,
                    username: username,
                    cantidad: 1,
                });
            }
        }
    } catch (errEst) {
        console.error("Error al registrar estadística de publicación (productor):", errEst);
    }
}

export async function GET() {
    try {
        await exigirProductorOAdministrador();
        const [especies, variedades, envases, kilos, categorias, calibres, paises] = await Promise.all([
            db.orm.public.Especie.select("id", "nombreEspecie").where({ especieActiva: true }).all(),
            db.orm.public.Variedad.select("id", "especieId", "nombreVariedad").where({ variedadActiva: true }).all(),
            db.orm.public.Envase.select("id", "nombreEnvase").orderBy((envase) => envase.id.asc()).all(),
            db.orm.public.KilosEmpaquetado.select("id", "valor").orderBy((peso) => peso.id.asc()).all(),
            db.orm.public.Categoria.select("id", "especieId", "nombreCategoria").all(),
            db.orm.public.Calibre.select("id", "nombreCalibre").all(),
            db.orm.public.Pais.select("id", "codigoPais", "nombrePais").all(),
        ]);
        return NextResponse.json({
            especies: especies.map(({ id, nombreEspecie }) => ({ id, nombre: nombreEspecie })),
            variedades: variedades.map(({ id, especieId, nombreVariedad }) => ({ id, especieId, nombre: nombreVariedad })),
            envases: envases.map(({ id, nombreEnvase }) => ({ id, nombre: nombreEnvase })),
            kilos: kilos.map(({ id, valor }) => ({ id, nombre: valor })),
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
            const productor = await db.orm.public.Productor.where({ id: productorId }).select("id", "usuarioId").first();
            if (!productor) {
                return NextResponse.json({ errores: ["El productor no existe."] }, { status: 404 });
            }
            const resultado = await altaPublicacionProductor({ ...datos, productorId: productor.id });
            if (resultado.esValido) {
                await registrarEstadisticaPublicacion(productor.usuarioId);
            }
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
        if (resultado.esValido) {
            await registrarEstadisticaPublicacion(productor.usuarioId);
        }
        return NextResponse.json(resultado, { status: resultado.esValido ? 201 : 400 });
    } catch (error) {
        if (error instanceof ErrorAutorizacion) {
            return NextResponse.json({ errores: [error.message] }, { status: error.status });
        }
        console.error("Error al crear publicación de Productor:", error);
        return NextResponse.json({ errores: ["No se pudo guardar la publicación."] }, { status: 500 });
    }
}
