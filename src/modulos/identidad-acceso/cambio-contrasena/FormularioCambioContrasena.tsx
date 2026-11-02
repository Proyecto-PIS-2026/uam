"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Alert, TextField } from "@mui/material";
import { cambiarMiContrasena } from "./cambiarMiContrasena";
import { validarCambioContrasena } from "./validarCambioContrasena";
import styles from "@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/FormularioModificarProductor.module.css";

export default function FormularioCambioContrasena({ volver }: { volver: string }) {
    const router = useRouter();
    const [actual, setActual] = useState("");
    const [nueva, setNueva] = useState("");
    const [confirmacion, setConfirmacion] = useState("");
    const [errores, setErrores] = useState<readonly string[]>([]);
    const [mensaje, setMensaje] = useState("");
    const [guardando, setGuardando] = useState(false);
    const enviando = useRef(false);

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (enviando.current) return;
        setMensaje("");
        const datos = { actual, nueva, confirmacion };
        const validacion = validarCambioContrasena(datos);
        if (!validacion.esValido) { setErrores(validacion.errores); return; }
        enviando.current = true;
        setGuardando(true);
        setErrores([]);
        try {
            const resultado = await cambiarMiContrasena(datos);
            if (!resultado.esValido) { setErrores(resultado.errores); return; }
            setActual(""); setNueva(""); setConfirmacion("");
            setMensaje(resultado.mensaje);
        } catch {
            setErrores(["No se pudo cambiar la contraseña. Intentá nuevamente."]);
        } finally {
            enviando.current = false;
            setGuardando(false);
        }
    }

    return <form className={styles.formulario} onSubmit={guardar} noValidate aria-label="Cambio de contraseña">
        {errores.length > 0 && <Alert severity="error">{errores.join(" ")}</Alert>}
        {mensaje && <Alert severity="success" role="status">{mensaje}</Alert>}
        <section className={styles.seccion}>
            <TextField label="Contraseña actual" type="password" autoComplete="current-password" value={actual} onChange={e => setActual(e.target.value)} disabled={guardando} required />
            <TextField label="Nueva contraseña" type="password" autoComplete="new-password" helperText="Al menos 8 caracteres." value={nueva} onChange={e => setNueva(e.target.value)} disabled={guardando} required />
            <TextField label="Confirmar nueva contraseña" type="password" autoComplete="new-password" value={confirmacion} onChange={e => setConfirmacion(e.target.value)} disabled={guardando} required />
        </section>
        <div className={styles.acciones}>
            <button type="button" className={styles.cancelar} disabled={guardando} onClick={() => router.push(volver)}>Cancelar</button>
            <button type="submit" className={styles.guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
    </form>;
}
