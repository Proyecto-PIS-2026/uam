import historicoEjemplo from "./historico-ejemplo.json";
import type { HistoricoProducto } from "./tipos";

/** Fuente local de prueba. La integración con el webservice se conecta por separado. */
export function cargarHistoricoDePrueba(): HistoricoProducto {
    return historicoEjemplo as HistoricoProducto;
}
