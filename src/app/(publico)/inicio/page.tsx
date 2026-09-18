import Inicio from "./inicio";
import { obtenerEspecies } from "@/infraestructura/persistencia/prisma/especies";

export default async function Page() {
  const especiesBD = await obtenerEspecies();

  const especies = especiesBD.map((especie) => ({
    id: especie.id,
    nombreEspecie: especie.nombreEspecie,
    especieActiva: especie.especieActiva,
    uamId: especie.uamId,
  }));

  return <Inicio especies={especies} />;
}