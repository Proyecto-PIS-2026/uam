import Inicio from "./inicio";
import { obtenerEspeciesConPublicacionesActivas } from "@/infraestructura/persistencia/prisma/especies";

export const metadata = {
  title: "Mercado de hoy | UAM",
};

export default async function Page() {
  const especies = await obtenerEspeciesConPublicacionesActivas();
  return <Inicio especies={especies} />;
}