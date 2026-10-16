import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaPublicacionProductor } from "@/modulos/publicaciones/altaPublicacionProductor";

export const runtime = "nodejs";

export async function GET() {
    try {
        const [productores, usuarios, especies, variedades, presentaciones, categorias, calibres, paises] = await Promise.all([
            db.orm.public.Productor.select("id", "usuarioId").all(),
            db.orm.public.Usuario.select("id", "username").where({ rol: "PRODUCTOR" }).all(),
            db.orm.public.Especie.select("id", "nombreEspecie").where({ especieActiva: true }).all(),
            db.orm.public.Variedad.select("id", "especieId", "nombreVariedad").where({ variedadActiva: true }).all(),
            db.orm.public.Presentacion.select("id", "variedadId", "nombrePresentacion").where({ presentacionActiva: true }).all(),
            db.orm.public.Categoria.select("id", "especieId", "nombreCategoria").all(),
            db.orm.public.Calibre.select("id", "nombreCalibre").all(),
            db.orm.public.Pais.select("id", "codigoPais", "nombrePais").all(),
        ]);
        const nombres = new Map(usuarios.map((usuario) => [usuario.id, usuario.username]));
        return NextResponse.json({
            productores: productores
                .filter((productor) => nombres.has(productor.usuarioId))
                .map((productor) => ({ id: productor.id, nombre: nombres.get(productor.usuarioId)! })),
            especies: especies.map(({ id, nombreEspecie }) => ({ id, nombre: nombreEspecie })),
            variedades: variedades.map(({ id, especieId, nombreVariedad }) => ({ id, especieId, nombre: nombreVariedad })),
            presentaciones: presentaciones.map(({ id, variedadId, nombrePresentacion }) => ({ id, variedadId, nombre: nombrePresentacion })),
            categorias: categorias.map(({ id, especieId, nombreCategoria }) => ({ id, especieId, nombre: nombreCategoria })),
            calibres: calibres.map(({ id, nombreCalibre }) => ({ id, nombre: nombreCalibre })),
            paises: paises.map(({ id, codigoPais, nombrePais }) => ({ id, codigo: codigoPais, nombre: nombrePais })),
        });
    } catch (error) {
        console.error("Error al cargar el alta de publicaciones de Productor:", error);
        return NextResponse.json({ errores: ["No se pudieron cargar los datos del formulario."] }, { status: 500 });
    }
}

export async function POST(request: Request) {
    let datos: unknown;
    try {
        datos = await request.json();
    } catch {
        return NextResponse.json({ errores: ["El cuerpo de la solicitud no es un JSON válido."] }, { status: 400 });
    }
    try {
        const resultado = await altaPublicacionProductor(datos);
        return NextResponse.json(resultado, { status: resultado.esValido ? 201 : 400 });
    } catch (error) {
        console.error("Error al crear publicación de Productor:", error);
        return NextResponse.json({ errores: ["No se pudo guardar la publicación."] }, { status: 500 });
    }
}
