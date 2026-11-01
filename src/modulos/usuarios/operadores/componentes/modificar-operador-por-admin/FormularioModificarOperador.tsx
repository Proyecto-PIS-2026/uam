"use client";

import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import HojasDecorativas from "@/compartido/HojasDecorativas";

import { useId, useRef, useState, type FormEvent } from "react";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import BotonVolver from "@/compartido/BotonVolver";

import { modificarOperador } from "../../acciones/modificarOperador";
import type { NaveOpcion } from "@/modulos/usuarios/operadores/consultas-naves";
import type { OperadorParaModificar } from "../../tipos";
import SelectorFotoPerfil, { argumentosFotoPerfil, type CambioFotoPerfil } from "@/modulos/usuarios/componentes/SelectorFotoPerfil";

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

const CODIGOS_PAIS = [
    { codigo: "+598", pais: "Uruguay" },
    { codigo: "+54", pais: "Argentina" },
    { codigo: "+55", pais: "Brasil" },
    { codigo: "+56", pais: "Chile" },
    { codigo: "+595", pais: "Paraguay" },
];

export default function FormularioModificarOperador({
    operador,
    naves,
}: Props) {
    const router = useRouter();
    const idFormulario = useId();

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
    const { notificar } = useNotificacionToast();
    const [guardando, setGuardando] = useState(false);
    const guardadoEnCurso = useRef(false);
    const [foto, setFoto] = useState<CambioFotoPerfil>(undefined);

    function actualizarLocal(
        indice: number,
        campo: keyof LocalFormulario,
        valor: string | number,
    ) {
        if (campo === "nombre" && (typeof valor !== "string" || !/^[0-9]*$/.test(valor))) return;
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
            notificar("Debe haber al menos un local.", "warning");
            return;
        }

        setLocales((actuales) =>
            actuales.filter((_, i) => i !== indice),
        );

        setErrores([]);
    }

    function cancelar() {
        router.push(`/gestion-operadores/${operador.id}`);
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
            const resultado = await modificarOperador({
                operadorId: operador.id,
                nombre,
                codigoPais,
                telefono,
                contraseña,
                confirmacionContraseña,
                locales,
            }, ...argumentosFotoPerfil(foto));

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

                        <SelectorFotoPerfil fotoActual={operador.fotoPerfil} cambio={foto} alCambiar={setFoto} alError={(mensaje) => notificar(mensaje, "error")} deshabilitado={guardando} />

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
                            {locales.length === 0 && (
                                <EstadoVacio titulo="Sin locales registrados" descripcion="Agregá un local para completar la información del operador." icono={<LocationOnOutlinedIcon />} compacto anunciar={false} />
                            )}
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
                                                disabled={guardando}
                                            >
                                                Eliminar
                                            </button>
                                        </div>

                                        <div
                                            className={
                                                styles.grillaLocal
                                            }
                                        >
                                            <TextField
                                                select
                                                fullWidth
                                                size="small"
                                                className={styles.control}
                                                id={`${idFormulario}-nave-${indice}`}
                                                label="Nave"
                                                value={local.naveId}
                                                onChange={(evento) => actualizarLocal(indice, "naveId", Number(evento.target.value))}
                                                disabled={guardando}
                                            >
                                                {naves.map((nave) => (
                                                    <MenuItem key={nave.id} value={nave.id}>{nave.nombre}</MenuItem>
                                                ))}
                                            </TextField>

                                            <TextField
                                                fullWidth
                                                size="small"
                                                className={styles.control}
                                                label="Número de local"
                                                required
                                                type="text"
                                                value={local.nombre}
                                                slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                                                onChange={(evento) => actualizarLocal(indice, "nombre", evento.target.value)}
                                                disabled={guardando}
                                            />

                                            <TextField
                                                fullWidth
                                                size="small"
                                                className={styles.control}
                                                label="Fin de contrato"
                                                type="date"
                                                value={local.contrato}
                                                slotProps={{ inputLabel: { shrink: true } }}
                                                onChange={(evento) => actualizarLocal(indice, "contrato", evento.target.value)}
                                                disabled={guardando}
                                            />
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
