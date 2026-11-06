import Inicio from "@/modulos/consulta-mercado/inicio/inicio";
import { redirigirAMercadoPropio } from "@/modulos/identidad-acceso/autorizacion/controles";
import {
    obtenerEspeciesInicio,
    obtenerUrlListaInteligente,
} from "@/modulos/consulta-mercado/inicio/consultas-inicio";
import { obtenerConfiguracionOrdenamiento } from "@/modulos/consulta-mercado/acciones/configuracion-ordenamiento";


export const dynamic = "force-dynamic";

export const metadata = {
    title: "Mercado de hoy | UAM",
};

export default async function Page() {
    await redirigirAMercadoPropio();

    const [especies, urlListaInteligente, ordenamiento] = await Promise.all([
        obtenerEspeciesInicio(),
        obtenerUrlListaInteligente(),
        obtenerConfiguracionOrdenamiento(),
    ]);

    return (
        <Inicio
            key={`${ordenamiento.habilitado}-${ordenamiento.ordenLanding}`}
            especies={especies}
            urlListaInteligente={urlListaInteligente}
            ordenamientoHabilitado={ordenamiento.habilitado}
            ordenPredeterminado={ordenamiento.ordenLanding}
        />
    );
}
