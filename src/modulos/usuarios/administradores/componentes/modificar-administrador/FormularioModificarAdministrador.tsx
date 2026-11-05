"use client";

import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import HojasDecorativas from "@/compartido/HojasDecorativas";

import { useRef, useState, type FormEvent } from "react";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import BotonVolver from "@/compartido/BotonVolver";

import { modificarAdministrador } from "./modificarAdministrador";
import { modificarMiPerfilAdministrador } from "../../perfil-propio/modificarMiPerfilAdministrador";
import type { AdministradorParaModificar } from "./obtenerAdministradorParaModificar";

import styles from "./FormularioModificarAdministrador.module.css";

const RUTA_MI_PERFIL = "/mi-perfil";

type Props = {
    administrador: AdministradorParaModificar;
    perfilPropio?: boolean;
};

export default function FormularioModificarAdministrador({ administrador, perfilPropio = false }: Props) {
    const router = useRouter();
    const rutaPerfil = perfilPropio ? RUTA_MI_PERFIL : `/gestion-administradores/${administrador.id}`;

    const [nombreUsuario, setNombreUsuario] = useState(administrador.nombreUsuario);
    const [email, setEmail] = useState(administrador.email);

    const [contraseña, setContraseña] = useState("");
    const [confirmacionContraseña, setConfirmacionContraseña] = useState("");

    const [errores, setErrores] = useState<string[]>([]);
    const { notificar } = useNotificacionToast();
    const [guardando, setGuardando] = useState(false);
    const guardadoEnCurso = useRef(false);

    function cancelar() {
        router.push(rutaPerfil);
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (guardadoEnCurso.current) return;
        guardadoEnCurso.current = true;

        setErrores([]);
        setGuardando(true);

        try {
            const resultado = perfilPropio
                ? await modificarMiPerfilAdministrador({ nombreUsuario, email })
                : await modificarAdministrador({
                    administradorId: administrador.id,
                    nombreUsuario,
                    email,
                    contraseña,
                    confirmacionContraseña,
                });

            if (!resultado.esValido) {
                setErrores(resultado.errores);
                return;
            }

            router.push(rutaPerfil);
        } catch (error) {
            console.error("Error al modificar administrador:", error);

            notificar("No se pudieron guardar los cambios. Intentá de nuevo.", "error");
        } finally {
            guardadoEnCurso.current = false;
            setGuardando(false);
        }
    }

    return (
        <div className={styles.pagina}>
            <div className={styles.contenedor}>
                <BotonVolver className={styles.volver} onClick={cancelar} disabled={guardando}>
                    {perfilPropio ? "Volver a mi perfil" : "Volver al perfil"}
                </BotonVolver>

                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <h1 className={styles.titulo}>{perfilPropio ? "Editar mi perfil" : "Modificar administrador"}</h1>

                    <p className={styles.descripcion}>
                        {perfilPropio ? "Actualizar información de " : "Actualizá la información registrada de "}
                        <strong>{administrador.nombreUsuario}</strong>
                        {!perfilPropio && "."}
                    </p>
                </header>

                <form className={styles.formulario} onSubmit={guardar} noValidate>
                    <section className={styles.seccion}>
                        <h2 className={styles.subtitulo}>{perfilPropio ? "Datos de mi perfil" : "Datos del administrador"}</h2>

                        <TextField
                            fullWidth
                            size="small"
                            className={styles.control}
                            label="Nombre de usuario"
                            value={nombreUsuario}
                            onChange={(evento) => setNombreUsuario(evento.target.value)}
                            disabled={guardando}
                        />

                        <TextField
                            fullWidth
                            size="small"
                            className={styles.control}
                            label="Correo electrónico"
                            type="email"
                            value={email}
                            onChange={(evento) => setEmail(evento.target.value)}
                            disabled={guardando}
                        />

                        <p className={styles.ayuda}>
                            {perfilPropio
                                ? "El correo electrónico se usa para iniciar sesión: si lo cambiás, vas a tener que ingresar con el nuevo."
                                : "El correo electrónico se usa para iniciar sesión: si lo cambiás, el administrador va a tener que ingresar con el nuevo."}
                        </p>
                    </section>

                    {!perfilPropio && (
                        <section className={styles.seccion}>
                            <h2 className={styles.subtitulo}>Cambiar contraseña</h2>

                            <p className={styles.ayuda}>
                                Dejá los campos vacíos si no querés modificar la contraseña actual.
                            </p>

                            <div className={styles.grillaContraseña}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    className={styles.control}
                                    label="Nueva contraseña"
                                    type="password"
                                    value={contraseña}
                                    onChange={(evento) => setContraseña(evento.target.value)}
                                    autoComplete="new-password"
                                    disabled={guardando}
                                />

                                <TextField
                                    fullWidth
                                    size="small"
                                    className={styles.control}
                                    label="Confirmar contraseña"
                                    type="password"
                                    value={confirmacionContraseña}
                                    onChange={(evento) => setConfirmacionContraseña(evento.target.value)}
                                    autoComplete="new-password"
                                    disabled={guardando}
                                />
                            </div>
                        </section>
                    )}

                    {errores.length > 0 && (
                        <div className={styles.error} role="alert">
                            {errores.map((error) => (
                                <p key={error}>{error}</p>
                            ))}
                        </div>
                    )}

                    <div className={styles.acciones}>
                        <button type="button" className={styles.cancelar} onClick={cancelar} disabled={guardando}>
                            Cancelar
                        </button>

                        <button type="submit" className={styles.guardar} disabled={guardando}>
                            {guardando ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}