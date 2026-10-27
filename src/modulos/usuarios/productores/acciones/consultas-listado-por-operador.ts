import { autorizado, } from "../../../identidad-acceso/autorizacion/permisos";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { db } from "../../../../infraestructura/persistencia/prisma/db";
import { obtenerDepartamentos } from "@/compartido/departamentos-uruguay";

export type ProductorListado = {
    id: number;
    nombreFantasia: string;
    fotoPerfil: string | null;
    cantidadProductos: number;
    departamentos: string[];
};

export async function obtenerProductoresPorOperador(): Promise<ProductorListado[]> {
    const sesion = await obtenerSesion();
    if (!autorizado("productor.publicacion.consultar", sesion)) {
        throw new Error("No tiene permisos para consultar productores y sus publicaciones.");
    }
    const consulta = db.orm.public.Productor
        .select("id", "nombreFantasia", "fotoPerfil")
        .include("publicacionesProductor", (publicaciones) =>
            publicaciones.include("ubicaciones", (ubicaciones) => ubicaciones.select("departamento")).include("publicacion", (publicacion) =>
                publicacion.select("publicacionActiva", "publicacionDisponible", "tipoPublicacion")
            )
        );
    const productores = await consulta.all();
    const productoresPublicos: ProductorListado[] = [];
    for (const productor of productores) {
        let cantidadProductos = 0;
        const ubicacionesVisibles: { departamento: string | null }[] = [];
        for (const relacion of productor.publicacionesProductor) {
            const publicacion = relacion.publicacion;
            if (publicacion.publicacionActiva && publicacion.publicacionDisponible && publicacion.tipoPublicacion === "PRODUCTOR") {
                cantidadProductos++;
                ubicacionesVisibles.push(...relacion.ubicaciones);
            }
        }
        productoresPublicos.push({
            id: productor.id,
            nombreFantasia: productor.nombreFantasia,
            fotoPerfil: productor.fotoPerfil,
            cantidadProductos,
            departamentos: obtenerDepartamentos(ubicacionesVisibles),
        });
    }
    productoresPublicos.sort((primerProductor, segundoProductor) => // es para que siga las reglas del español y base para ignorar mayuscs y tildes
        primerProductor.nombreFantasia.localeCompare( segundoProductor.nombreFantasia, "es", { sensitivity: "base" } )
    );
    return productoresPublicos;
}
