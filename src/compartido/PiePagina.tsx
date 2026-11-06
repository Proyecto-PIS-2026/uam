
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import styles from "./PiePagina.module.css";

export default function PiePagina() {
    return (
        <footer className={styles.pie}>
            <div className={styles.contenido}>
                <address className={styles.contacto} aria-label="Contacto de UAM">
                    <p className={styles.dato}>
                        <LocationOnOutlinedIcon className={styles.icono} aria-hidden="true" />
                        <span>Cno. Luis Eduardo Pérez 6651</span>
                    </p>
                    <a className={styles.dato} href="tel:+59823114592">
                        <LocalPhoneOutlinedIcon className={styles.icono} aria-hidden="true" />
                        <span>(+598) 2 311 45 92</span>
                    </a>
                    <a className={styles.dato} href="mailto:info@uam.com.uy">
                        <EmailOutlinedIcon className={styles.icono} aria-hidden="true" />
                        <span>info@uam.com.uy</span>
                    </a>
                </address>
                <section className={styles.avisosLegales} aria-label="Avisos legales">
                    <p className={styles.avisoLegal}>
                        Las fotos y precios son responsabilidad de los operadores. La UAM no se responsabiliza ni interviene en su contenido o publicación.
                    </p>
                    <p className={styles.avisoLegal}>
                        Las operaciones de compraventa se realizan exclusivamente entre operadores y compradores. La UAM no participa ni interviene en dichas transacciones, ni asume responsabilidad por los acuerdos comerciales entre las partes.
                    </p>
                </section>
                <p className={styles.derechos}>© UAM. Todos los derechos reservados.</p>
            </div>
        </footer>
    );
}
