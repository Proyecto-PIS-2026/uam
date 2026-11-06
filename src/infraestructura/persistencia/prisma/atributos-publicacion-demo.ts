import { CALIBRES_GENERALES_ADICIONALES, ENVASES_PUBLICACION, KILOS_EMPAQUETADO } from "./catalogos-publicacion";

export function atributosPublicacionDemo(indice: number) {
  const grupo = Math.floor(indice / 4);
  const variante = indice % 4;
  return {
    envase: variante === 0 || variante === 1 ? ENVASES_PUBLICACION[grupo % ENVASES_PUBLICACION.length] : null,
    kilos: variante === 0 || variante === 2 ? KILOS_EMPAQUETADO[grupo % KILOS_EMPAQUETADO.length] : null,
    calibre: indice % 3 === 0 ? CALIBRES_GENERALES_ADICIONALES[Math.floor(indice / 3) % CALIBRES_GENERALES_ADICIONALES.length] : null,
  };
}
