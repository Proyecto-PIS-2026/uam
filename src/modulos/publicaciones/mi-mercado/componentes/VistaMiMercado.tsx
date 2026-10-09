import MiMercado from "./MiMercado";
import { obtenerPublicacionesDeOperador } from "../consultas-mi-mercado";
import { mapearPublicacionesMiMercado } from "../mapear-publicaciones";
import { obtenerOpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import { obtenerOperadorActual, obtenerOperadorPorNombre } from "../../../usuarios/operadores/operador-actual";
import { obtenerSesion } from "../../../identidad-acceso/autenticacion/sesiones";
import { autorizado } from "../../../identidad-acceso/autorizacion/permisos";
import { notFound, redirect } from "next/navigation";

type VistaMiMercadoProps = {
    abrirAltaInicial?: boolean;
    operadorNombre?: string;
};

// TODO: reemplazar por el valor real de Configuración ("incremento_precio")
// cuando se implemente el ítem BP-18.2
const incrementoPrecio = 10;

export default async function VistaMiMercado({ abrirAltaInicial = false, operadorNombre }: VistaMiMercadoProps) {
    const sesion = await obtenerSesion();
    if (!sesion) redirect("/iniciar-sesion");

    const operador = operadorNombre === undefined
        ? await obtenerOperadorActual()
        : await obtenerOperadorPorNombre(operadorNombre);
    if (!operador) notFound();
    if (!autorizado("operador.publicacion.consultarPropias", sesion, operador)) redirect("/inicio");
    const puedeCrear = autorizado("operador.publicacion.crear", sesion, operador);
    const puedeModificar = autorizado("operador.publicacion.modificar", sesion, operador);
    const puedeEliminar = autorizado("operador.publicacion.eliminar", sesion, operador);
    if (abrirAltaInicial && !puedeCrear) redirect("/inicio");
    const [publicacionesBD, opcionesEdicion] = await Promise.all([
        obtenerPublicacionesDeOperador(operador.id),
        obtenerOpcionesEdicionPublicacion(),
    ]);
    const publicaciones = mapearPublicacionesMiMercado(publicacionesBD);

    return <MiMercado key={operador.id} publicaciones={publicaciones} incrementoPrecio={incrementoPrecio} opcionesEdicion={opcionesEdicion} operadorId={operador.id} nombreOperador={operador.nombreFantasia} abrirAltaInicial={abrirAltaInicial} puedeCrear={puedeCrear} puedeModificar={puedeModificar} puedeEliminar={puedeEliminar} />;
}
