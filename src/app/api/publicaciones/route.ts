import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { autorizado } from "@/modulos/identidad-acceso/autorizacion/permisos";
import { NextResponse } from "next/server";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaPublicacionOperador } from "@/modulos/publicaciones/altaPublicacionOperador";
import { obtenerOperadorAutorizado } from "@/modulos/usuarios/operadores/operador-actual";
import { ErrorAutorizacion } from "@/modulos/identidad-acceso/autorizacion/controles";
import { revalidatePath } from "next/cache";
import { ErrorCuerpoDemasiadoGrande, leerJsonLimitado } from "@/infraestructura/http/cuerpo-limitado";

export async function GET() {
	if (!autorizado("operador.catalogo.consultar")) {
		return NextResponse.json({ errores: ["No tiene permisos para consultar el catálogo de Operadores."] }, { status: 403 });
	}
	try {
		const sesion = await obtenerSesion();
		if (sesion?.rol === "PRODUCTOR") {
			return NextResponse.json({ errores: ["No tiene permisos para consultar el catálogo de Operadores."] }, { status: 403 });
		}
		const operadoresAutorizados = sesion?.rol === "OPERADOR"
			? [await obtenerOperadorAutorizado()]
			: db.orm.public.Operador.all();
		const [operadores, especies, variedades, presentaciones, categorias, calibres, paises] = await Promise.all([
			operadoresAutorizados,
			db.orm.public.Especie.all(),
			db.orm.public.Variedad.all(),
			db.orm.public.Presentacion.all(),
			db.orm.public.Categoria.all(),
			db.orm.public.Calibre.all(),
			db.orm.public.Pais.all(),
		]);

		return NextResponse.json({
			operadores: operadores.map(({ id, nombreFantasia }) => ({ id, nombre: nombreFantasia })),
			especies: especies.filter((item) => item.especieActiva).map(({ id, nombreEspecie }) => ({ id, nombre: nombreEspecie })),
			variedades: variedades.filter((item) => item.variedadActiva).map(({ id, especieId, nombreVariedad }) => ({ id, especieId, nombre: nombreVariedad })),
			presentaciones: presentaciones.filter((item) => item.presentacionActiva).map(({ id, variedadId, nombrePresentacion }) => ({ id, variedadId, nombre: nombrePresentacion })),
			categorias: categorias.map(({ id, especieId, nombreCategoria }) => ({ id, especieId, nombre: nombreCategoria })),
			calibres: calibres.map(({ id, nombreCalibre }) => ({ id, nombre: nombreCalibre })),
			paises: paises.map(({ id, nombrePais }) => ({ id, nombre: nombrePais })),
		});
	} catch (error) {
		if (error instanceof ErrorAutorizacion) {
			return NextResponse.json({ errores: [error.message] }, { status: error.status });
		}
		console.error("Error al cargar catálogos de publicaciones:", error);
		return NextResponse.json({ errores: ["No se pudieron cargar los datos del formulario."] }, { status: 500 });
	}
}

export async function POST(request: Request) {
	const sesion = await obtenerSesion();
	if (!sesion) return NextResponse.json({ errores: ["Debe iniciar sesión."] }, { status: 401 });

	let datos: unknown;
	try {
		datos = await leerJsonLimitado(request);
	} catch (error) {
		if (error instanceof ErrorCuerpoDemasiadoGrande) {
			return NextResponse.json({ errores: [error.message] }, { status: 413 });
		}
		return NextResponse.json({ errores: ["El cuerpo de la solicitud no es un JSON válido."] }, { status: 400 });
	}

	let operadorId: number | undefined;
	if (typeof datos === "object" && datos !== null && !Array.isArray(datos) && "operadorId" in datos) {
		const valor = (datos as Record<string, unknown>).operadorId;
		if (typeof valor !== "number" || !Number.isSafeInteger(valor) || valor <= 0) {
			return NextResponse.json({ errores: ["El operador no es válido."] }, { status: 400 });
		}
		operadorId = valor;
	}

	try {
		const esAdmin = autorizado("administracion.publicacion.crear", sesion);

		let operador;

		if (esAdmin) {
			if (operadorId === undefined) {
				return NextResponse.json({ errores: ["Debe seleccionar un operador."] },{ status: 400 });
			}

			const operadores = await db.orm.public.Operador.all();
			operador = operadores.find((item) => item.id === operadorId);

			if (!operador) {
				return NextResponse.json({ errores: ["El operador no existe."] },{ status: 404 });
			}
		} else {
			operador = await obtenerOperadorAutorizado(operadorId);
			if (!autorizado("operador.publicacion.crear", sesion, operador)) {
				return NextResponse.json({ errores: ["No tiene permisos para gestionar publicaciones de este Operador."] }, { status: 403 });
			}
		}
		
		const datosDelOperador = typeof datos === "object" && datos !== null && !Array.isArray(datos)
			? { ...datos, operadorId: operador.id }
			: datos;
		const resultado = await altaPublicacionOperador(datosDelOperador);
		if (resultado.esValido) {
			const rutas = [
				"/mi-mercado",
				`/mi-mercado/${encodeURIComponent(operador.nombreFantasia)}`,
				"/publicaciones",
				`/operadores/${encodeURIComponent(operador.nombreFantasia)}`,
				"/operadores",
				"/inicio",
			];
			for (const ruta of rutas) {
				try {
					revalidatePath(ruta);
				} catch (error) {
					console.error(`No se pudo revalidar ${ruta} tras crear la publicacion:`, error);
				}
			}
		}
		return NextResponse.json(resultado, { status: resultado.esValido ? 201 : 400 });
	} catch (error) {
		if (error instanceof ErrorAutorizacion) {
			return NextResponse.json({ errores: [error.message] }, { status: error.status });
		}
		console.error("Error al crear publicación:", error);
		return NextResponse.json({ errores: ["No se pudo guardar la publicación."] }, { status: 500 });
	}
}
