
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import LocalPhoneOutlinedIcon from "@mui/icons-material/LocalPhoneOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
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
                    <div className={styles.bloqueAviso}>
                        <h2 className={styles.tituloAviso}>
                            <InfoOutlinedIcon className={styles.iconoAviso} aria-hidden="true" />
                            Fotos y precios
                        </h2>
                        <p className={styles.avisoLegal}>
                            Las fotos y precios son responsabilidad de los operadores. La UAM no se responsabiliza ni interviene en su contenido o publicación.
                        </p>
                    </div>
                    <div className={styles.bloqueAviso}>
                        <h2 className={styles.tituloAviso}>
                            <StorefrontOutlinedIcon className={styles.iconoAviso} aria-hidden="true" />
                            Operaciones comerciales
                        </h2>
                        <p className={styles.avisoLegal}>
                            Las operaciones de compraventa se realizan exclusivamente entre operadores y compradores. La UAM no participa ni interviene en dichas transacciones, ni asume responsabilidad por los acuerdos comerciales entre las partes.
                        </p>
                    </div>
                </section>
            </div>
        </footer>
    );
}
