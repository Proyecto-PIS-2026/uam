"use client";

import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import HojasDecorativas from "@/compartido/HojasDecorativas";

import { useId, useRef, useState, type FormEvent } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import BotonVolver from "@/compartido/BotonVolver";

import { modificarProductor } from "./modificarProductor";
import type { ProductorParaModificar } from "./obtenerProductorParaModificar";
import SelectorFotoPerfil, { argumentosFotoPerfil, type CambioFotoPerfil } from "@/modulos/usuarios/componentes/SelectorFotoPerfil";

import styles from "./FormularioModificarProductor.module.css";

type Props = {
    productor: ProductorParaModificar;
};

const CODIGOS_PAIS = [
    { codigo: "+598", pais: "Uruguay" },
    { codigo: "+54", pais: "Argentina" },
    { codigo: "+55", pais: "Brasil" },
    { codigo: "+56", pais: "Chile" },
    { codigo: "+595", pais: "Paraguay" },
];

export default function FormularioModificarProductor({ productor }: Props) {
    const router = useRouter();
    const idFormulario = useId();

    const [nombre, setNombre] = useState(productor.nombre);
    const [codigoPais, setCodigoPais] = useState(
        productor.codigoPais,
    );
    const [telefono, setTelefono] = useState(productor.telefono);

    const [contraseña, setContraseña] = useState("");
    const [confirmacionContraseña, setConfirmacionContraseña] =
        useState("");

    const [errores, setErrores] = useState<string[]>([]);
    const { notificar } = useNotificacionToast();
    const [guardando, setGuardando] = useState(false);
    const guardadoEnCurso = useRef(false);
    const [foto, setFoto] = useState<CambioFotoPerfil>(undefined);

    function cancelar() {
        router.push(`/gestion-productores/${productor.id}`);
    }

    async function guardar(
        evento: FormEvent<HTMLFormElement>,
    ) {
        evento.preventDefault();

        if (guardadoEnCurso.current) return;
        guardadoEnCurso.current = true;

        setErrores([]);
        setGuardando(true);

        try {
            const resultado = await modificarProductor({
                productorId: productor.id,
                nombre,
                codigoPais,
                telefono,
                contraseña,
                confirmacionContraseña,
            }, ...argumentosFotoPerfil(foto));

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
            guardadoEnCurso.current = false;
            setGuardando(false);
        }
    }

    return (
        <div className={styles.pagina}>
            <div className={styles.contenedor}>
                <BotonVolver
                    className={styles.volver}
                    onClick={cancelar}
                    disabled={guardando}
                >
                    Volver al perfil
                </BotonVolver>

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

                        <SelectorFotoPerfil fotoActual={productor.fotoPerfil} cambio={foto} alCambiar={setFoto} alError={(mensaje) => notificar(mensaje, "error")} deshabilitado={guardando} />

                        <TextField
                            fullWidth
                            size="small"
                            className={styles.control}
                            label="Nombre"
                            value={nombre}
                            onChange={(evento) => setNombre(evento.target.value)}
                            disabled={guardando}
                        />

                        <div className={styles.filaTelefono}>
                            <TextField
                                select
                                fullWidth
                                size="small"
                                className={styles.control}
                                id={`${idFormulario}-codigo`}
                                label="Código de país"
                                value={codigoPais}
                                onChange={(evento) => setCodigoPais(evento.target.value)}
                                disabled={guardando}
                            >
                                {CODIGOS_PAIS.map(({ codigo, pais }) => (
                                    <MenuItem key={codigo} value={codigo}>{codigo} ({pais})</MenuItem>
                                ))}
                            </TextField>

                            <TextField
                                fullWidth
                                size="small"
                                className={styles.control}
                                label="WhatsApp"
                                type="tel"
                                value={telefono}
                                slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                                onChange={(evento) => {
                                    const nuevoTelefono = evento.target.value;
                                    if (/^[0-9]*$/.test(nuevoTelefono)) setTelefono(nuevoTelefono);
                                }}
                                disabled={guardando}
                            />
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
