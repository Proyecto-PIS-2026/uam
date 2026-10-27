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
                <p className={styles.derechos}>© UAM. Todos los derechos reservados.</p>
            </div>
        </footer>
    );
}
