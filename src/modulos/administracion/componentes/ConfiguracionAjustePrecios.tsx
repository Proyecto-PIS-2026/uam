"use client";

import { useRef, useState, type FormEvent } from "react";
import Button from "@mui/material/Button";
import { guardarConfiguracionAjustePrecios } from "../acciones-ajuste-precios";
import { ERROR_IMPORTE_AJUSTE, validarImporteAjuste } from "../validar-importe-ajuste";
import tarjetaStyles from "./tarjetaConfiguracion.module.css";
import styles from "./ConfiguracionAjustePrecios.module.css";

interface ConfiguracionAjustePreciosProps {
    valorInicial: string | null;
}

export default function ConfiguracionAjustePrecios({ valorInicial }: ConfiguracionAjustePreciosProps) {
    const [guardado, setGuardado] = useState(valorInicial ?? "");
    const [valor, setValor] = useState(valorInicial ?? "");
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState("");
    const [mensaje, setMensaje] = useState("");
    const guardandoRef = useRef(false);

    function cancelar() {
        setValor(guardado);
        setError("");
        setMensaje("");
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (guardandoRef.current) return;
        setError("");
        setMensaje("");

        try {
            validarImporteAjuste(valor);
        } catch {
            setError(ERROR_IMPORTE_AJUSTE);
            return;
        }

        guardandoRef.current = true;
        setGuardando(true);

        try {
            const resultado = await guardarConfiguracionAjustePrecios(valor);
            if (!resultado.ok) {
                setError(resultado.error);
                return;
            }

            setGuardado(resultado.importe);
            setValor(resultado.importe);
            setMensaje("Importe guardado correctamente.");
        } catch {
            setError("No se pudo guardar el importe. Se mantiene la configuración anterior.");
        } finally {
            guardandoRef.current = false;
            setGuardando(false);
        }
    }

    return (
        <form className={tarjetaStyles.tarjeta} onSubmit={guardar} noValidate>
            <div className={tarjetaStyles.titulo}>Ajuste rápido de precios</div>
            <div className={tarjetaStyles.descripcion}>
                Importe en pesos para los controles de aumento y disminución rápida de precios.
            </div>
            <p className={tarjetaStyles.descripcion}>
                Importe vigente: {guardado ? `$${guardado}` : "Sin configurar"}
            </p>

            <label className={tarjetaStyles.campo}>
                Importe de ajuste ($)
                <input
                    className={`${tarjetaStyles.input} ${error ? tarjetaStyles.inputError : ""}`}
                    type="text"
                    inputMode="numeric"
                    value={valor}
                    disabled={guardando}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "error-importe-ajuste" : undefined}
                    onChange={(evento) => {
                        setValor(evento.target.value);
                        setError("");
                        setMensaje("");
                    }}
                />
            </label>
            {error && (
                <p id="error-importe-ajuste" role="alert" className={tarjetaStyles.mensajeError}>
                    {error}
                </p>
            )}
            {mensaje && <p role="status" className={styles.mensaje}>{mensaje}</p>}

            <div className={styles.acciones}>
                <Button
                    type="button"
                    variant="outlined"
                    disabled={guardando}
                    className={styles.botonCancelar}
                    onClick={cancelar}
                >
                    Cancelar
                </Button>
                <Button
                    type="submit"
                    variant="contained"
                    disabled={guardando}
                    className={styles.botonGuardar}
                >
                    {guardando ? "Guardando…" : "Guardar"}
                </Button>
            </div>
        </form>
    );
}
