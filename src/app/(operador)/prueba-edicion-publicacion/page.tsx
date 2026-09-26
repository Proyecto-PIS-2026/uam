import PruebaEdicionPublicacion from "../../../modulos/publicaciones/operadores/componentes/PruebaEdicionPublicacion";
import { obtenerOpcionesEdicionPublicacion } from "../../../modulos/publicaciones/operadores/consultas-edicion-publicacion";

export default async function Page() {
    const opciones = await obtenerOpcionesEdicionPublicacion();
    return <PruebaEdicionPublicacion opciones={opciones} />;
}
