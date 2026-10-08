"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import styles from "./RestablecerContrasena.module.css";

interface RestablecerContrasenaProps {
    usuarioId: number;
}

interface Notificacion {
    mensaje: string;
    tipo: "error" | "success";
    key: number;
}

export default function RestablecerContrasena({ usuarioId }: RestablecerContrasenaProps) {
    const [mostrarFormulario, setMostrarFormulario] = useState(false);
    const [nuevaContrasena, setNuevaContrasena] = useState("");
    const [confirmarContrasena, setConfirmarContrasena] = useState("");
    const [notificacion, setNotificacion] = useState<Notificacion | null>(null);

    function mostrarNotificacion(mensaje: string, tipo: "error" | "success") {
        setNotificacion({ mensaje, tipo, key: Date.now() });
    }

    function abrirFormulario() {
        setNotificacion(null);
        setMostrarFormulario(true);
    }

    function cancelar() {
        setNuevaContrasena("");
        setConfirmarContrasena("");
        setNotificacion(null);
        setMostrarFormulario(false);
    }

    function guardar(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (nuevaContrasena === "") {
            mostrarNotificacion("La nueva contraseña es obligatoria.", "error");
            return;
        }

        if (confirmarContrasena === "") {
            mostrarNotificacion("Debe confirmar la nueva contraseña.", "error");
            return;
        }

        if (nuevaContrasena !== confirmarContrasena) {
            mostrarNotificacion("Las contraseñas no coinciden.", "error");
            return;
        }

        /*
         * TODO: implementar modificación en base de datos.
         * Consulta/acción:
         * restablecerContrasena()
         * Datos:
         * {
         *     usuarioId,
         *     nuevaPassword: nuevaContrasena
         * }
         */

        void usuarioId;

        setNuevaContrasena("");
        setConfirmarContrasena("");
        setMostrarFormulario(false);
        mostrarNotificacion("La nueva contraseña fue validada.", "success");
    }

    return (
        <section className={styles.contenedor}>
            <div className={styles.encabezado}>
                <div>
                    <h3 className={styles.titulo}>Contraseña</h3>
                    <p className={styles.descripcion}>Cambiar la contraseña de este usuario.</p>
                </div>

                {!mostrarFormulario && (<Button variant="outlined" onClick={abrirFormulario} className={styles.boton}> Restablecer contraseña </Button>)}
            </div>

            <div className={`${styles.formularioContenedor} ${mostrarFormulario ? styles.formularioVisible : ""}`}>
                <form className={styles.formulario} onSubmit={guardar}>
                    <TextField fullWidth size="small" label="Nueva contraseña" type="password" value={nuevaContrasena} onChange={(evento) => 
                        setNuevaContrasena(evento.target.value)} className={styles.campo}
                    />

                    <TextField fullWidth size="small" label="Confirmar contraseña" type="password" value={confirmarContrasena} onChange={(evento) => 
                        setConfirmarContrasena(evento.target.value)} className={styles.campo}
                    />

                    <div className={styles.acciones}>
                        <Button type="button" variant="outlined" onClick={cancelar} className={styles.botonCancelar}> Cancelar </Button>
                        <Button type="submit" variant="contained" className={styles.botonGuardar}> Confirmar </Button>
                    </div>
                </form>
            </div>

            <Snackbar key={notificacion?.key} open={Boolean(notificacion)} autoHideDuration={4000} onClose={() => 
                setNotificacion(null)} anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
                {notificacion ? (<Alert onClose={() => setNotificacion(null)} severity={notificacion.tipo} variant="filled" sx={{ width: "100%" }}> {notificacion.mensaje} </Alert>) : undefined}
            </Snackbar>
        </section>
    );
}