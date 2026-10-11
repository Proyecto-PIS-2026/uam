import MiMercado from "./MiMercado";
import { obtenerPublicacionesDeOperador } from "../consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "../mapear-publicaciones";
import { obtenerOpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import { obtenerOperadorActual, obtenerOperadorPorNombre } from "../../../usuarios/operadores/operador-actual";
import { obtenerConfiguracion } from "@/modulos/administracion/ConsultaConfiguracion";
import { notFound, redirect } from "next/navigation";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";

type VistaMiMercadoProps = {
    abrirAltaInicial?: boolean;
    operadorNombre?: string;
};

export default async function VistaMiMercado({ abrirAltaInicial = false, operadorNombre }: VistaMiMercadoProps) {
    const sesion = await requerirOperador();
    const operador = operadorNombre === undefined
        ? await obtenerOperadorActual()
        : await obtenerOperadorPorNombre(operadorNombre);
    if (!operador) notFound();
    if (operador.usuarioId !== sesion.usuarioId) redirect("/mi-mercado");
    const [publicacionesBD, opcionesEdicion, incrementoPrecioConfiguracion] = await Promise.all([
        obtenerPublicacionesDeOperador(operador.id),
        obtenerOpcionesEdicionPublicacion(),
        obtenerConfiguracion("incremento_precio"),
    ]);
    const publicaciones = mapearPublicacionesMiMercado(publicacionesBD);
    const incrementoPrecio = Number(incrementoPrecioConfiguracion); 
    return <MiMercado key={operador.id} publicaciones={publicaciones} incrementoPrecio={incrementoPrecio} opcionesEdicion={opcionesEdicion} operadorId={operador.id} nombreOperador={operador.nombreFantasia} abrirAltaInicial={abrirAltaInicial} />;
}