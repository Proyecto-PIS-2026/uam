"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import TextField from "@mui/material/TextField";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { modificarMiPerfilAdministrador } from "@/modulos/usuarios/administradores/modificar-mi-perfil";
import type { MiPerfilAdministrador } from "@/modulos/usuarios/administradores/consultar-mi-perfil";
import styles from "@/modulos/usuarios/administradores/componentes/modificar-administrador/FormularioModificarAdministrador.module.css";

export default function FormularioEditarMiPerfil({ perfil }: { perfil: MiPerfilAdministrador }) {
    const router = useRouter();
    const [nombre, setNombre] = useState(perfil.nombre);
    const { notificar, cerrarNotificacion } = useNotificacionToast();
    const [guardando, setGuardando] = useState(false);
    const enviando = useRef(false);

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (enviando.current) return;
        enviando.current = true;
        setGuardando(true);
        cerrarNotificacion();
        try {
            const resultado = await modificarMiPerfilAdministrador({ nombre });
            if (!resultado.esValido) {
                notificar(resultado.errores.join("\n"), "error");
                return;
            }
            notificar(resultado.mensaje, "success");
            router.push("/mi-perfil");
            router.refresh();
        } catch {
            notificar("No se pudieron guardar los cambios. Intentá nuevamente.", "error");
        } finally {
            enviando.current = false;
            setGuardando(false);
        }
    }

    return (
        <form onSubmit={guardar} noValidate className={styles.formulario} aria-label="Editar mi perfil">
            <section className={styles.seccion} aria-labelledby="datos-mi-perfil">
                <h2 id="datos-mi-perfil" className={styles.subtitulo}>Datos de mi perfil</h2>
                <TextField
                    id="mi-perfil-usuario"
                    label="Nombre de usuario"
                    fullWidth
                    size="small"
                    className={styles.control}
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    autoComplete="username"
                    disabled={guardando}
                    required
                    slotProps={{ htmlInput: { minLength: 3 } }}
                />
            </section>
            <div className={styles.acciones}>
                <button type="button" className={styles.cancelar} disabled={guardando} onClick={() => router.push("/mi-perfil")}>Cancelar</button>
                <button type="submit" className={styles.guardar} disabled={guardando}>{guardando ? "Guardando…" : "Guardar cambios"}</button>
            </div>
        </form>
    );
}
