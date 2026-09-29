import MiMercado from "./MiMercado";
import { obtenerPublicacionesDeOperador } from "../consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "../mapear-publicaciones";
import { obtenerOpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import { obtenerOperadorActual, obtenerOperadorPorNombre } from "../../../usuarios/operadores/operador-actual";
import { notFound } from "next/navigation";

type VistaMiMercadoProps = {
    abrirAltaInicial?: boolean;
    operadorNombre?: string;
};

// TODO: reemplazar por el valor real de Configuración ("incremento_precio")
// cuando se implemente el ítem BP-18.2
const incrementoPrecio = 10;

export default async function VistaMiMercado({ abrirAltaInicial = false, operadorNombre }: VistaMiMercadoProps) {
    const operador = operadorNombre === undefined
        ? await obtenerOperadorActual()
        : await obtenerOperadorPorNombre(operadorNombre);
    if (!operador) notFound();
    const [publicacionesBD, opcionesEdicion] = await Promise.all([
        obtenerPublicacionesDeOperador(operador.id),
        obtenerOpcionesEdicionPublicacion(),
    ]);
    const publicaciones = mapearPublicacionesMiMercado(publicacionesBD);

    return <MiMercado key={operador.id} publicaciones={publicaciones} incrementoPrecio={incrementoPrecio} opcionesEdicion={opcionesEdicion} operadorId={operador.id} nombreOperador={operador.nombreFantasia} abrirAltaInicial={abrirAltaInicial} />;
}
