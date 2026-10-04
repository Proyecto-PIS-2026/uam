export const dynamic = 'force-dynamic';

import Inicio from "../../../modulos/consulta-mercado/inicio/inicio";
import { obtenerEspeciesInicio, obtenerUrlListaInteligente } from "../../../modulos/consulta-mercado/inicio/consultas-inicio";

export const metadata = {
  title: "Mercado de hoy | UAM",
};

export default async function Page() {
  const [especies, urlListaInteligente] = await Promise.all([
    obtenerEspeciesInicio(),
    obtenerUrlListaInteligente(),
  ]);
  return <Inicio especies={especies} urlListaInteligente={urlListaInteligente}/>;
}
