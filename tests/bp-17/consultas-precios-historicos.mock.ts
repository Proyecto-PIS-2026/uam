import type { ConsultaHistorica } from "../../src/modulos/informacion-uam/precios-historicos/parametros-consulta";
import { filtrarHistorico, type FiltrosHistoricos } from "../../src/modulos/informacion-uam/precios-historicos/transformar-historico";
import { validarHistoricoProducto } from "../../src/modulos/informacion-uam/precios-historicos/validar-historico";

export async function obtenerHistoricoPrecios(consulta: ConsultaHistorica) {
  const parametros = new URLSearchParams({
    species_id: String(consulta.speciesId), from: consulta.desde, to: consulta.hasta,
  });
  const respuesta = await fetch(`http://127.0.0.1:3101/historicos?${parametros}`, { cache: "no-store" });
  if (!respuesta.ok) throw new Error("No se pudieron cargar los precios históricos simulados.");
  return validarHistoricoProducto(await respuesta.json(), consulta);
}

export async function obtenerHistoricoPreciosConFiltros(consulta: ConsultaHistorica, filtros: FiltrosHistoricos = {}) {
  const historico = filtrarHistorico(await obtenerHistoricoPrecios(consulta), consulta);
  const presentaciones = historico.series.flatMap((dia) => dia.presentations);
  const comparar = new Intl.Collator("es", { sensitivity: "base", numeric: true }).compare;
  const unicos = (valores: string[]) => [...new Set(valores)].sort(comparar);
  return {
    historico: filtrarHistorico(historico, consulta, filtros),
    opcionesFiltros: {
      variedades: unicos(presentaciones.map((presentacion) => presentacion.variety)),
      paises: unicos(presentaciones.map((presentacion) => presentacion.country)),
      calibres: unicos(presentaciones.map((presentacion) => presentacion.caliber)),
      categorias: unicos(presentaciones.flatMap((presentacion) => presentacion.prices.map((precio) => precio.category))),
    },
  };
}
