"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { modificarOperador } from "./modificarOperador";
import { bajaOperador } from "@/modulos/usuarios/operadores/bajaOperador";
import type { NaveOpcion } from "./obtenerNaves";
import type { OperadorParaModificar } from "./obtenerOperadorParaModificar";

import styles from "./FormularioModificarOperador.module.css";

type Props = {
    operador: OperadorParaModificar;
    naves: NaveOpcion[];
};

type LocalFormulario = {
    nombre: string;
    naveId: number;
    contrato: string;
};

const CODIGOS_PAIS = ["+598", "+54", "+55", "+56", "+595"];

export default function FormularioModificarOperador({
    operador,
    naves,
}: Props) {
    const router = useRouter();

    const [mostrarPopupEliminar, setMostrarPopupEliminar] = useState(false);

    const [nombre, setNombre] = useState(operador.nombre);
    const [codigoPais, setCodigoPais] = useState(
        operador.codigoPais,
    );
    const [telefono, setTelefono] = useState(operador.telefono);

    const [contraseña, setContraseña] = useState("");
    const [confirmacionContraseña, setConfirmacionContraseña] =
        useState("");

    const [locales, setLocales] = useState<LocalFormulario[]>(
        operador.locales.map((local) => ({
            nombre: local.nombre,
            naveId: local.naveId,
            contrato: local.contrato,
        })),
    );

    const [errores, setErrores] = useState<string[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [eliminando, setEliminando] = useState(false);

    async function eliminarOperador() {
        if (eliminando) return;

        setErrores([]);
        setEliminando(true);

        try {
            const resultado = await bajaOperador({
                operadorId: operador.id,
            });

            if (!resultado.esValido) {
                setErrores(resultado.errores);
                return;
            }

            router.push("/gestion-operadores");
        } catch (error) {
            console.error("Error al eliminar operador:", error);

            setErrores([
                "No se pudo eliminar el operador. Intentá de nuevo.",
            ]);
        } finally {
            setEliminando(false);
        }
    }

    function actualizarLocal(
        indice: number,
        campo: keyof LocalFormulario,
        valor: string | number,
    ) {
        setLocales((actuales) =>
            actuales.map((local, i) =>
                i === indice
                    ? {
                          ...local,
                          [campo]: valor,
                      }
                    : local,
            ),
        );
    }

    function agregarLocal() {
        setLocales((actuales) => [
            ...actuales,
            {
                nombre: "",
                naveId: naves[0]?.id ?? 0,
                contrato: "",
            },
        ]);
    }

    function eliminarLocal(indice: number) {
        if (locales.length === 1) {
            setErrores(["Debe haber al menos un local."]);
            return;
        }

        setLocales((actuales) =>
            actuales.filter((_, i) => i !== indice),
        );

        setErrores([]);
    }

    function cancelar() {
        router.push(`/gestion-operadores`);
    }

    async function guardar(
        evento: FormEvent<HTMLFormElement>,
    ) {
        evento.preventDefault();

        if (guardando) return;

        setErrores([]);
        setGuardando(true);

        try {
            const resultado = await modificarOperador({
                operadorId: operador.id,
                nombre,
                codigoPais,
                telefono,
                contraseña,
                confirmacionContraseña,
                locales,
            });

            if (!resultado.esValido) {
                setErrores(resultado.errores);
                return;
            }

            router.push(`/gestion-operadores/${resultado.id}`);
        } catch (error) {
            console.error(
                "Error al modificar operador:",
                error,
            );

            setErrores([
                "No se pudieron guardar los cambios. Intentá de nuevo.",
            ]);
        } finally {
            setGuardando(false);
        }
    }

    return (
        <div className={styles.pagina}>
            <div className={styles.contenedor}>
                <button
                    type="button"
                    className={styles.volver}
                    onClick={cancelar}
                    disabled={guardando}
                >
                    ← Volver al perfil
                </button>

                <header className={styles.encabezado}>
                    <h1 className={styles.titulo}>
                        Modificar operador
                    </h1>

                    <p className={styles.descripcion}>
                        Actualizá la información registrada de{" "}
                        <strong>{operador.nombre}</strong>.
                    </p>
                </header>

                <form
                    className={styles.formulario}
                    onSubmit={guardar}
                    noValidate
                >
                    <section className={styles.seccion}>
                        <h2 className={styles.subtitulo}>
                            Datos del operador
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
                        <div
                            className={
                                styles.encabezadoSeccion
                            }
                        >
                            <div>
                                <h2
                                    className={
                                        styles.subtitulo
                                    }
                                >
                                    Locales
                                </h2>

                                <p className={styles.ayuda}>
                                    Modificá la nave, el número
                                    de local o la fecha de fin de
                                    contrato.
                                </p>
                            </div>

                            <button
                                type="button"
                                className={
                                    styles.agregarLocal
                                }
                                onClick={agregarLocal}
                                disabled={guardando}
                            >
                                + Agregar local
                            </button>
                        </div>

                        <div
                            className={styles.listaLocales}
                        >
                            {locales.map(
                                (local, indice) => (
                                    <div
                                        className={styles.local}
                                        key={indice}
                                    >
                                        <div
                                            className={
                                                styles.encabezadoLocal
                                            }
                                        >
                                            <strong>
                                                Local{" "}
                                                {indice + 1}
                                            </strong>

                                            <button
                                                type="button"
                                                className={
                                                    styles.eliminarLocal
                                                }
                                                onClick={() =>
                                                    eliminarLocal(
                                                        indice,
                                                    )
                                                }
                                                disabled={
                                                    guardando ||
                                                    locales.length ===
                                                        1
                                                }
                                            >
                                                Eliminar
                                            </button>
                                        </div>

                                        <div
                                            className={
                                                styles.grillaLocal
                                            }
                                        >
                                            <label
                                                className={
                                                    styles.campo
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.etiqueta
                                                    }
                                                >
                                                    Nave
                                                </span>

                                                <select
                                                    className={
                                                        styles.entrada
                                                    }
                                                    value={
                                                        local.naveId
                                                    }
                                                    onChange={(
                                                        evento,
                                                    ) =>
                                                        actualizarLocal(
                                                            indice,
                                                            "naveId",
                                                            Number(
                                                                evento
                                                                    .target
                                                                    .value,
                                                            ),
                                                        )
                                                    }
                                                    disabled={
                                                        guardando
                                                    }
                                                >
                                                    {naves.map(
                                                        (
                                                            nave,
                                                        ) => (
                                                            <option
                                                                key={
                                                                    nave.id
                                                                }
                                                                value={
                                                                    nave.id
                                                                }
                                                            >
                                                                {
                                                                    nave.nombre
                                                                }
                                                            </option>
                                                        ),
                                                    )}
                                                </select>
                                            </label>

                                            <label
                                                className={
                                                    styles.campo
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.etiqueta
                                                    }
                                                >
                                                    Número de
                                                    local
                                                </span>

                                                <input
                                                    className={
                                                        styles.entrada
                                                    }
                                                    value={
                                                        local.nombre
                                                    }
                                                    onChange={(
                                                        evento,
                                                    ) =>
                                                        actualizarLocal(
                                                            indice,
                                                            "nombre",
                                                            evento
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    disabled={
                                                        guardando
                                                    }
                                                />
                                            </label>

                                            <label
                                                className={
                                                    styles.campo
                                                }
                                            >
                                                <span
                                                    className={
                                                        styles.etiqueta
                                                    }
                                                >
                                                    Fin de
                                                    contrato
                                                </span>

                                                <input
                                                    className={
                                                        styles.entrada
                                                    }
                                                    type="date"
                                                    value={
                                                        local.contrato
                                                    }
                                                    onChange={(
                                                        evento,
                                                    ) =>
                                                        actualizarLocal(
                                                            indice,
                                                            "contrato",
                                                            evento
                                                                .target
                                                                .value,
                                                        )
                                                    }
                                                    disabled={
                                                        guardando
                                                    }
                                                />
                                            </label>
                                        </div>
                                    </div>
                                ),
                            )}
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
                            className={`${styles.cancelar} !border-red-700 !text-red-500 hover:!bg-red-50`}
                            onClick={() => setMostrarPopupEliminar(true)}
                            disabled={guardando}
                        >
                            Eliminar operador
                        </button>

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
                {mostrarPopupEliminar && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                        <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
                            <h2 className="text-xl font-bold text-foreground">
                                Eliminar operador
                            </h2>

                            <p className="mt-3 text-sm text-muted-foreground">
                                ¿Está seguro de que desea eliminar al operador{" "}
                                <strong>{operador.nombre}</strong>?
                            </p>

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

                            <div className="mt-6 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setMostrarPopupEliminar(false)
                                    }
                                    className={styles.cancelar}
                                    disabled={eliminando}
                                >
                                    Cancelar
                                </button>

                                <button
                                    type="button"
                                    onClick={eliminarOperador}
                                    className={styles.guardar}
                                    disabled={eliminando}
                                >
                                    {eliminando
                                        ? "Eliminando..."
                                        : "Eliminar operador"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}