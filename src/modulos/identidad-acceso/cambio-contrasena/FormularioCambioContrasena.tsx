"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { cambiarMiContrasena } from "./cambiarMiContrasena";
import { validarCambioContrasena } from "./validarCambioContrasena";
import styles from "./FormularioCambioContrasena.module.css";

export default function FormularioCambioContrasena({ volver }: { volver: string }) {
    const router = useRouter();
    const [actual, setActual] = useState("");
    const [nueva, setNueva] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [guardando, setGuardando] = useState(false);
    const enviando = useRef(false);
    const [visibilidad, setVisibilidad] = useState({ actual: false, nueva: false, confirmacion: false });

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (enviando.current) return;
        cerrarNotificacion();
        const datos = { actual, nueva, confirmacion };
        const validacion = validarCambioContrasena(datos);
        if (!validacion.esValido) { notificar(validacion.errores.join("\n"), "error"); return; }
        enviando.current = true;
        setGuardando(true);
        try {
            const resultado = await cambiarMiContrasena(datos);
            if (!resultado.esValido) { notificar(resultado.errores.join("\n"), "error"); return; }
            setActual(""); setNueva(""); setConfirmacion("");
            notificar(resultado.mensaje, "success");
        } catch {
            notificar("No se pudo cambiar la contraseña. Intentá nuevamente.", "error");
        } finally {
            enviando.current = false;
            setGuardando(false);
        }
    }

    function campo(id: "actual" | "nueva" | "confirmacion", etiqueta: string, autoComplete: string, valor: string, cambiar: (valor: string) => void, ayuda?: string) {
        const visible = visibilidad[id];
        return <div className={styles.campo}>
            <label htmlFor={`contrasena-${id}`}>{etiqueta}</label>
            <div className={styles.entrada}>
                <input id={`contrasena-${id}`} type={visible ? "text" : "password"} autoComplete={autoComplete} value={valor} onChange={(evento) => cambiar(evento.target.value)} disabled={guardando} required />
                <button type="button" className={styles.mostrar} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} onClick={() => setVisibilidad((actual) => ({ ...actual, [id]: !actual[id] }))}>
                    {visible ? <VisibilityIcon /> : <VisibilityOffIcon />}
                </button>
            </div>
            {ayuda && <span className={styles.ayuda}>{ayuda}</span>}
        </div>;
    }

    return <form className={styles.formulario} onSubmit={guardar} noValidate aria-label="Cambio de contraseña">
        <section className={styles.seccion}>
            {campo("actual", "Contraseña actual", "current-password", actual, setActual)}
            {campo("nueva", "Nueva contraseña", "new-password", nueva, setNueva, "Al menos 8 caracteres.")}
            {campo("confirmacion", "Confirmar nueva contraseña", "new-password", confirmacion, setConfirmacion)}
        </section>
        <div className={styles.acciones}>
            <button type="button" className={styles.cancelar} disabled={guardando} onClick={() => router.push(volver)}>Cancelar</button>
            <button type="submit" className={styles.guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
    </form>;
}
