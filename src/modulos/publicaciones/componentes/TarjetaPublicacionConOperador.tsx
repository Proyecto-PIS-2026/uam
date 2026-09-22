"use client";

import { useState } from "react";
import Imagen from "next/image";
import Enlace from "next/link";
import estilos from "./TarjetaPublicacionConOperador.module.css";

export type PropiedadesPublicacionConOperador = {
  foto?: string | null;
  especie: string;
  variedad: string;
  categoria: string;
  calibre: string;
  presentacion: string;
  operador: string;
  precio: number | null;
  rutaDetalle?: string;
  alSeleccionar?: () => void;
};

const formatoPrecio = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function PublicacionConOperador({
  foto,
  especie,
  variedad,
  categoria,
  calibre,
  presentacion,
  operador,
  precio,
  rutaDetalle,
  alSeleccionar,
}: PropiedadesPublicacionConOperador) {
  const [fotoFallida, actualizarFotoFallida] = useState<string | null>(null);
  const tieneFoto = Boolean(foto?.trim()) && foto !== fotoFallida;
  const tienePrecio = precio !== null && Number.isFinite(precio) && precio >= 0;

  return (
    <article className={estilos.tarjeta} aria-label={`${especie} — ${operador}`}>
      <div className={estilos.imagen}>
        {tieneFoto ? (
          <Imagen
            src={foto!}
            alt={`${especie}, variedad ${variedad}`}
            fill
            sizes="(max-width: 479px) 80px, (max-width: 639px) 112px, 160px"
            className={estilos.foto}
            onError={() => actualizarFotoFallida(foto!)}
          />
        ) : (
          <div className={estilos.sinFoto}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <circle cx="8" cy="8" r="1.5" />
              <path d="m3 17 5-5 4 4 4-6 5 7" />
            </svg>
            <span>Sin foto disponible</span>
          </div>
        )}
      </div>

      <div className={estilos.contenido}>
        <div className={estilos.informacion}>
          <h2 className={estilos.especie}>
            {especie} <span className={estilos.variedad}>— {variedad}</span>
          </h2>
          <dl className={estilos.detalles}>
            <div><dt>Categoría</dt><dd>{categoria}</dd></div>
            <div><dt>Calibre</dt><dd>{calibre}</dd></div>
            <div><dt>Presentación</dt><dd>{presentacion}</dd></div>
          </dl>
        </div>

        <div className={estilos.filaInferior}>
          <dl className={estilos.operador}>
            <dt>Operador</dt>
            <dd>{operador}</dd>
          </dl>
          <div className={estilos.bloquePrecio}>
            <p className={estilos.etiquetaPrecio}>Precio</p>
            <p className={estilos.precio}>
              {tienePrecio ? formatoPrecio.format(precio) : "Consultar precio"}
            </p>
            {tienePrecio && <p className={estilos.unidad}>UYU · por presentación</p>}
          </div>
        </div>
        {alSeleccionar ? (
          <button
            type="button"
            className={estilos.enlace}
            onClick={alSeleccionar}
            aria-label={`Ver detalle de ${especie}`}
          >
            Ver detalle <span aria-hidden="true">↗</span>
          </button>
        ) : rutaDetalle && (
          <Enlace href={rutaDetalle} className={estilos.enlace} aria-label={`Ver detalle de ${especie}`}>
            Ver detalle <span aria-hidden="true">↗</span>
          </Enlace>
        )}
      </div>
    </article>
  );
}
