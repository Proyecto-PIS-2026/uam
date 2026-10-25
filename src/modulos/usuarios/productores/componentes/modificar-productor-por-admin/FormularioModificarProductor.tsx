"use client";

import NotificacionToast, { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import HojasDecorativas from "@/compartido/HojasDecorativas";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import { modificarProductor } from "./modificarProductor";
import type { ProductorParaModificar } from "./obtenerProductorParaModificar";

import styles from "./FormularioModificarProductor.module.css";

type Props = {
    productor: ProductorParaModificar;
};

const CODIGOS_PAIS = ["+598", "+54", "+55", "+56", "+595"];

export default function FormularioModificarProductor({ productor }: Props) {
    const router = useRouter();

    const [nombre, setNombre] = useState(productor.nombre);
    const [codigoPais, setCodigoPais] = useState(
        productor.codigoPais,
    );
    const [telefono, setTelefono] = useState(productor.telefono);

    const [contraseña, setContraseña] = useState("");
    const [confirmacionContraseña, setConfirmacionContraseña] =
        useState("");

    const [errores, setErrores] = useState<string[]>([]);
    const { notificacion, notificar, cerrarNotificacion } = useNotificacionToast();
    const [guardando, setGuardando] = useState(false);

    function cancelar() {
        router.push(`/gestion-productores/${productor.id}`);
    }

    async function guardar(
        evento: FormEvent<HTMLFormElement>,
    ) {
        evento.preventDefault();

        if (guardando) return;

        setErrores([]);
        cerrarNotificacion();
        setGuardando(true);

        try {
            const resultado = await modificarProductor({
                productorId: productor.id,
                nombre,
                codigoPais,
                telefono,
                contraseña,
                confirmacionContraseña,
            });

            if (!resultado.esValido) {
                setErrores(resultado.errores);
                return;
            }

            router.push(`/gestion-productores/${resultado.id}`);
        } catch (error) {
            console.error(
                "Error al modificar productor:",
                error,
            );

            notificar(
                "No se pudieron guardar los cambios. Intentá de nuevo.",
                "error",
            );
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className={styles.pagina}>
            <NotificacionToast notificacion={notificacion} alCerrar={cerrarNotificacion} />
            <div className={styles.contenedor}>
                <button
                    type="button"
                    className={styles.volver}
                    onClick={cancelar}
                    disabled={guardando}
                >
                    <ArrowBackIcon aria-hidden="true" fontSize="inherit" />
                    Volver al perfil
                </button>

                <header className={styles.encabezado}>
                    <HojasDecorativas />
                    <h1 className={styles.titulo}>
                        Modificar productor
                    </h1>

                    <p className={styles.descripcion}>
                        Actualizá la información registrada de{" "}
                        <strong>{productor.nombre}</strong>.
                    </p>
                </header>

                <form
                    className={styles.formulario}
                    onSubmit={guardar}
                    noValidate
                >
                    <section className={styles.seccion}>
                        <h2 className={styles.subtitulo}>
                            Datos del productor
                        </h2>

                        <label className={styles.campo}>
                            <span className={styles.etiqueta}>
                                Nombre
                            </span>

                            <input
                                className={styles.entrada}
                                value={nombre}
                                onChange={(evento) =>
                                    setNombre(
                                        evento.target.value,
                                    )
                                }
                                disabled={guardando}
                            />
                        </label>

                        <div className={styles.filaTelefono}>
                            <label className={styles.campo}>
                                <span
                                    className={styles.etiqueta}
                                >
                                    Código
                                </span>

                                <select
                                    className={styles.entrada}
                                    value={codigoPais}
                                    onChange={(evento) =>
                                        setCodigoPais(
                                            evento.target.value,
                                        )
                                    }
                                    disabled={guardando}
                                >
                                    {CODIGOS_PAIS.map(
                                        (codigo) => (
                                            <option
                                                key={codigo}
                                                value={codigo}
                                            >
                                                {codigo}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </label>

                            <label className={styles.campo}>
                                <span
                                    className={styles.etiqueta}
                                >
                                    WhatsApp
                                </span>

                                <input
                                    className={styles.entrada}
                                    value={telefono}
                                    onChange={(evento) =>
                                        setTelefono(
                                            evento.target.value,
                                        )
                                    }
                                    disabled={guardando}
                                />
                            </label>
                        </div>
                    </section>

                    <section className={styles.seccion}>
                        <h2 className={styles.subtitulo}>
                            Cambiar contraseña
                        </h2>

                        <p className={styles.ayuda}>
                            Dejá los campos vacíos si no querés
                            modificar la contraseña actual.
                        </p>

                        <div
                            className={
                                styles.grillaContraseña
                            }
                        >
                            <label className={styles.campo}>
                                <span
                                    className={styles.etiqueta}
                                >
                                    Nueva contraseña
                                </span>

                                <input
                                    className={styles.entrada}
                                    type="password"
                                    value={contraseña}
                                    onChange={(evento) =>
                                        setContraseña(
                                            evento.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    disabled={guardando}
                                />
                            </label>

                            <label className={styles.campo}>
                                <span
                                    className={styles.etiqueta}
                                >
                                    Confirmar contraseña
                                </span>

                                <input
                                    className={styles.entrada}
                                    type="password"
                                    value={
                                        confirmacionContraseña
                                    }
                                    onChange={(evento) =>
                                        setConfirmacionContraseña(
                                            evento.target.value,
                                        )
                                    }
                                    autoComplete="new-password"
                                    disabled={guardando}
                                />
                            </label>
                        </div>
                    </section>

                    {errores.length > 0 && (
                        <div
                            className={styles.error}
                            role="alert"
                        >
                            {errores.map((error) => (
                                <p key={error}>{error}</p>
                            ))}
                        </div>
                    )}

                    <div className={styles.acciones}>
                        <button
                            type="button"
                            className={styles.cancelar}
                            onClick={cancelar}
                            disabled={guardando}
                        >
                            Cancelar
                        </button>

                        <button
                            type="submit"
                            className={styles.guardar}
                            disabled={guardando}
                        >
                            {guardando
                                ? "Guardando..."
                                : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
