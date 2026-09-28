import MiMercado, { type Publicacion } from "./MiMercado";
import { obtenerPublicacionesDeOperador } from "../consultas-mi-mercado";
import { obtenerOpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import { obtenerOperadorActual, obtenerOperadorPorId } from "../../../usuarios/operadores/operador-actual";
import { notFound } from "next/navigation";

type VistaMiMercadoProps = {
    abrirAltaInicial?: boolean;
    operadorId?: number;
};

// TODO: reemplazar por el valor real de Configuración ("incremento_precio")
// cuando se implemente el ítem BP-18.2
const incrementoPrecio = 10;

export default async function VistaMiMercado({ abrirAltaInicial = false, operadorId }: VistaMiMercadoProps) {
    const operador = operadorId === undefined
        ? await obtenerOperadorActual()
        : await obtenerOperadorPorId(operadorId);
    if (!operador) notFound();
    const [publicacionesBD, opcionesEdicion] = await Promise.all([
        obtenerPublicacionesDeOperador(operador.id),
        obtenerOpcionesEdicionPublicacion(),
    ]);
    const publicaciones: Publicacion[] = publicacionesBD.map((rel) => {
        const pub = rel.publicacion;
        return {
            id: pub.id as number,
            publicacionOperadorId: rel.id,
            paisId: rel.paisId,
            foto: pub.foto as string | null,
            precio: pub.precio === null ? null : String(pub.precio),
            publicacionActiva: pub.publicacionActiva as boolean,
            publicacionDisponible: pub.publicacionDisponible as boolean,
            presentacion: {
                id: pub.presentacion.id,
                nombrePresentacion: pub.presentacion.nombrePresentacion,
                variedad: {
                    id: pub.presentacion.variedad.id,
                    nombreVariedad: pub.presentacion.variedad.nombreVariedad,
                    especie: {
                        id: pub.presentacion.variedad.especie.id,
                        nombreEspecie: pub.presentacion.variedad.especie.nombreEspecie,
                        fotoEspecie: pub.presentacion.variedad.especie.fotoEspecie,
                    },
                },
            },
            categoria: { id: pub.categoria.id, nombreCategoria: pub.categoria.nombreCategoria },
            calibre: {
                id: pub.calibre.id,
                codigoCalibre: pub.calibre.codigoCalibre,
                nombreCalibre: pub.calibre.nombreCalibre,
            },
        };
    });

    return <MiMercado key={operador.id} publicaciones={publicaciones} incrementoPrecio={incrementoPrecio} opcionesEdicion={opcionesEdicion} operadorId={operador.id} abrirAltaInicial={abrirAltaInicial} />;
}
