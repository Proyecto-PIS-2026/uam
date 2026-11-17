import styles from "./HojasDecorativas.module.css";

type HojasDecorativasProps = {
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

export default function HojasDecorativas({ className = "" }: HojasDecorativasProps) {
  return (
    <div className={`${styles.decoracion} ${styles.separador} ${className}`} aria-hidden="true">
      <HojaAncha className={styles.motivoUno} />
      <Ramita className={styles.motivoDos} />
      <Helecho className={styles.motivoTres} />
    </div>
  );
}