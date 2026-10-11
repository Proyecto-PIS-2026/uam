import type { ConsultaHistorica } from "../../src/modulos/informacion-uam/precios-historicos/parametros-consulta";
import { validarHistoricoProducto } from "../../src/modulos/informacion-uam/precios-historicos/validar-historico";

export async function obtenerHistoricoPrecios(consulta: ConsultaHistorica) {
  const parametros = new URLSearchParams({
    species_id: String(consulta.speciesId), from: consulta.desde, to: consulta.hasta,
  });
  const respuesta = await fetch(`http://127.0.0.1:3101/historicos?${parametros}`, { cache: "no-store" });
  if (!respuesta.ok) throw new Error("No se pudieron cargar los precios históricos simulados.");
  return validarHistoricoProducto(await respuesta.json(), consulta);
}
