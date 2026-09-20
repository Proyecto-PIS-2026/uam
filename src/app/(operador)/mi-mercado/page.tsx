import MiMercado, { type Publicacion } from "./mi-mercado";
import varsTemp from "./vars-temporales";
import { obtenerPublicacionesDeOperador } from "@/infraestructura/persistencia/prisma/publicaciones";

// TODO: reemplazar por el valor real de Configuración ("incremento_precio")
// cuando se implemente el ítem BP-18.2
const incrementoPrecio = varsTemp.incrementoPrecio;


export default async function Page() {
    //TODO: reemplazar por el operadorId del usuario loggeado (por ahora hardcodeado)
    const operadorId = varsTemp.operadorId;
    const publicacionesBD = await obtenerPublicacionesDeOperador(operadorId);
    const publicaciones: Publicacion[] = publicacionesBD.map((rel) => {
        const pub = rel.publicacion;
        return {
            id: pub.id as number,
            foto: pub.foto as string | null,
            precio: String(pub.precio),
            publicacionActiva: pub.publicacionActiva as boolean,
            publicacionDisponible: pub.publicacionDisponible as boolean,
            presentacion: {
                nombrePresentacion: pub.presentacion.nombrePresentacion,
                variedad: {
                    nombreVariedad: pub.presentacion.variedad.nombreVariedad,
                    especie: {
                        id: pub.presentacion.variedad.especie.id,
                        nombreEspecie: pub.presentacion.variedad.especie.nombreEspecie,
                        fotoEspecie: pub.presentacion.variedad.especie.fotoEspecie,
                    },
                },
            },
            categoria: { nombreCategoria: pub.categoria.nombreCategoria },
            calibre: {
                codigoCalibre: pub.calibre.codigoCalibre,
                nombreCalibre: pub.calibre.nombreCalibre,
            },
        };
    });

        return (
            <MiMercado
                publicaciones={publicaciones}
                incrementoPrecio={incrementoPrecio}
            />
        );
}
