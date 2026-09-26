import Inicio from "../../../modulos/consulta-mercado/inicio/inicio";
import { obtenerEspeciesInicio } from "../../../modulos/consulta-mercado/inicio/consultas-inicio";

export const metadata = {
  title: "Mercado de hoy | UAM",
};

export default async function Page() {
  const especies = await obtenerEspeciesInicio();
  return <Inicio especies={especies} />;
}
