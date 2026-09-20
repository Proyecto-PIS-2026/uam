import Inicio from "./inicio";
import { obtenerEspecies } from "@/infraestructura/persistencia/prisma/especies";

export default async function Page() {
  const especiesBD = await obtenerEspecies();

  const especies = especiesBD.map((especie) => ({
    id: especie.id,
    nombreEspecie: especie.nombreEspecie,
    uamId: especie.uamId,
    fotoEspecie: especie.fotoEspecie,
  }));

  return <Inicio especies={especies} />;
}