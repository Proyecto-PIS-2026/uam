"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import styles from "./tarjetaProducto.module.css";

type Props = {
  idEspecie: number;
  nombre: string;
  operadores: number;
  imagen: string | null;
};

function FotoProducto({ imagen, nombre }: Pick<Props, "imagen" | "nombre">) {
  const [imagenFallida, setImagenFallida] = useState(false);
  const inicial = nombre.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className={styles.imagen}>
      {imagen && !imagenFallida ? (
        <Image src={imagen} alt={nombre} fill unoptimized sizes="(max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw" className={styles.foto} onError={() => setImagenFallida(true)}/>
      ) : (
        <span className={styles.sinFoto} aria-hidden="true">{inicial}</span>
      )}
    </div>
  );
}

export default function ProductoCard({ idEspecie, nombre, operadores, imagen }: Props) {
  return (
    <Link href={`/publicaciones?especieId=${idEspecie}`} className={styles.tarjeta}>
      <FotoProducto key={`${nombre}:${imagen ?? ""}`} imagen={imagen} nombre={nombre} />

      <div className={styles.contenido}>
        <div className={styles.nombreFila}>
          <h3 className={styles.nombre} title={nombre}>{nombre}</h3>
          <ArrowForwardRoundedIcon aria-hidden="true" className={styles.flecha} />
        </div>

        <div className={styles.pie}>
          <span className={styles.cantidad}>{operadores}</span>
          <span className={styles.etiqueta}>{operadores === 1 ? "operador" : "operadores"}</span>
        </div>
      </div>
    </Link>
  );
}
