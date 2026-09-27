"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./HojasDecorativas.module.css";

type HojasDecorativasProps = {
  variante?: "fondo" | "separador";
  className?: string;
};

type MotivoProps = { className: string };

function HojaAncha({ className }: MotivoProps) {
  return (
    <span className={`${styles.motivo} ${styles.hojaAncha} ${className}`}>
      <i className={styles.laminaAncha} />
      <i className={styles.nervio} />
    </span>
  );
}

function Ramita({ className }: MotivoProps) {
  return (
    <span className={`${styles.motivo} ${styles.ramita} ${className}`}>
      <i className={styles.eje} />
      <i className={`${styles.par} ${styles.parUno}`} />
      <i className={`${styles.par} ${styles.parDos}`} />
      <i className={`${styles.par} ${styles.parTres}`} />
    </span>
  );
}

function Helecho({ className }: MotivoProps) {
  return (
    <span className={`${styles.motivo} ${styles.helecho} ${className}`}>
      <i className={styles.eje} />
      <i className={`${styles.par} ${styles.parUno}`} />
      <i className={`${styles.par} ${styles.parDos}`} />
      <i className={`${styles.par} ${styles.parTres}`} />
      <i className={`${styles.par} ${styles.parCuatro}`} />
      <i className={`${styles.par} ${styles.parCinco}`} />
      <i className={`${styles.par} ${styles.parSeis}`} />
    </span>
  );
}

function Motivos() {
  return (
    <>
      <HojaAncha className={styles.motivoUno} />
      <Ramita className={styles.motivoDos} />
      <Helecho className={styles.motivoTres} />
      <HojaAncha className={styles.motivoCuatro} />
      <Ramita className={styles.motivoCinco} />
      <Helecho className={styles.motivoSeis} />
    </>
  );
}

export default function HojasDecorativas({ variante = "fondo", className = "" }: HojasDecorativasProps) {
  const decoracionRef = useRef<HTMLDivElement>(null);
  const patronRef = useRef<HTMLDivElement>(null);
  const [repeticiones, setRepeticiones] = useState(1);

  useEffect(() => {
    if (variante !== "fondo") return;

    const decoracion = decoracionRef.current;
    const patron = patronRef.current;
    if (!decoracion || !patron) return;

    const actualizarRepeticiones = () => {
      const altoPatron = patron.getBoundingClientRect().height;
      if (altoPatron === 0) return;

      const cantidad = Math.max(1, Math.ceil(decoracion.clientHeight / altoPatron));
      setRepeticiones(cantidad);
    };

    actualizarRepeticiones();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", actualizarRepeticiones);
      return () => window.removeEventListener("resize", actualizarRepeticiones);
    }

    const observador = new ResizeObserver(actualizarRepeticiones);
    observador.observe(decoracion);
    observador.observe(patron);
    return () => observador.disconnect();
  }, [variante]);

  return (
    <div ref={decoracionRef} className={`${styles.decoracion} ${styles[variante]} ${className}`} aria-hidden="true">
      {variante === "fondo"
        ? Array.from({ length: repeticiones }, (_, indice) => (
            <div key={indice} ref={indice === 0 ? patronRef : undefined} className={styles.patron}>
              <Motivos />
            </div>
          ))
        : <Motivos />}
    </div>
  );
}
