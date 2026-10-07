"use client";

import { useRef, useState } from "react";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";

import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";

import type { LocalParaModificar, TipoNave } from "../../Compartidos/Tipos";
import styles from "./ManejarContratos.module.css";

interface ManejarContratosProps {
    operadorId: number;
    locales: LocalParaModificar[];
}

interface NuevoContrato {
    nave: TipoNave | "";
    numeroLocal: string;
    finContrato: string;
}

interface Notificacion {
    mensaje: string;
    tipo: "error" | "success";
    key: number;
}

export default function ManejarContratos({ operadorId, locales }: ManejarContratosProps) {
    const [localesActuales, setLocalesActuales] = useState<LocalParaModificar[]>(locales);
    const [nuevoContrato, setNuevoContrato] = useState<NuevoContrato>({ nave: "", numeroLocal: "", finContrato: "" });
    const [notificacion, setNotificacion] = useState<Notificacion | null>(null);

    const [idEditando, setIdEditando] = useState<number | null>(null);
    const [fechaEdicion, setFechaEdicion] = useState<string>("");

    const [localAEliminar, setLocalAEliminar] = useState<LocalParaModificar | null>(null);
    const [modalCrearAbierto, setModalCrearAbierto] = useState(false);

    const contadorNotificacion = useRef(0);
    const contadorLocal = useRef(0);

    const naves: TipoNave[] = ["A", "B", "D", "E", "Tinglado"];

    function mostrarNotificacion(mensaje: string, tipo: "error" | "success") {
        contadorNotificacion.current += 1;
        setNotificacion({ mensaje, tipo, key: contadorNotificacion.current });
    }

    function activarEdicion(local: LocalParaModificar) {
        setIdEditando(local.id);
        setFechaEdicion(local.finContrato ? obtenerFechaInput(local.finContrato) : "");
    }

    function cancelarEdicion() {
        setIdEditando(null);
        setFechaEdicion("");
    }

    function guardarFecha(local: LocalParaModificar) {
        setLocalesActuales((actuales) =>
            actuales.map((item) =>
                item.id === local.id ? { ...item, finContrato: fechaEdicion === "" ? null : fechaEdicion } : item,
            ),
        );

        /*
         * TODO: implementar actualización en BD.
         */

        setIdEditando(null);
        mostrarNotificacion(`La fecha del local ${local.nave}-${local.numeroLocal} fue actualizada.`, "success");
    }

    function confirmarEliminacion() {
        if (!localAEliminar) return;

        const local = localAEliminar;
        setLocalesActuales((actuales) => actuales.filter((item) => item.id !== local.id));

        /*
         * TODO: implementar eliminación en BD.
         */

        setLocalAEliminar(null);
        mostrarNotificacion(`El local ${local.nave}-${local.numeroLocal} fue eliminado.`, "success");
    }

    function agregarContrato(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();

        if (nuevoContrato.nave === "") {
            mostrarNotificacion("Debe seleccionar una nave.", "error");
            return;
        }

        const numeroLocal = Number(nuevoContrato.numeroLocal);
        if (!Number.isInteger(numeroLocal) || numeroLocal < 1 || numeroLocal > 300) {
            mostrarNotificacion("El número de local debe ser un entero entre 1 y 300.", "error");
            return;
        }

        /*
         * TODO: implementar creación en BD.
         */

        contadorLocal.current += 1;

        const nuevoLocalItem: LocalParaModificar = {
            id: contadorLocal.current,
            nave: nuevoContrato.nave as TipoNave,
            numeroLocal: numeroLocal,
            finContrato: nuevoContrato.finContrato === "" ? null : nuevoContrato.finContrato,
        };

        setLocalesActuales((prev) => [...prev, nuevoLocalItem]);
        setNuevoContrato({ nave: "", numeroLocal: "", finContrato: "" });
        setModalCrearAbierto(false);
        mostrarNotificacion("El nuevo contrato fue agregado correctamente.", "success");
    }

    return (
        <section className={styles.contenedor}>
            <div className={styles.encabezado}>
                <div>
                    <h3 className={styles.titulo}>Contratos y locales</h3>
                    <p className={styles.descripcion}>Gestión de locales asignados y sus vencimientos.</p>
                </div>
            </div>

            {localesActuales.length === 0 ? (
                <div className={styles.sinLocales}>
                    <p>El operador no tiene locales asignados.</p>
                </div>
            ) : (
                <div className={styles.tablaContenedor}>
                    <table className={styles.tabla}>
                        <thead>
                            <tr>
                                <th>Número local</th>
                                <th>Fecha de vencimiento</th>
                                <th>Estado actual</th>
                                <th className={styles.columnaAcciones}>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {localesActuales.map((local) => {
                                const estaEditando = idEditando === local.id;
                                const estado = calcularEstado(local.finContrato);

                                return (
                                    <tr key={local.id}>
                                        <td data-label="Número local">
                                            <strong className={styles.localCodigo}>
                                                {local.nave}-{local.numeroLocal}
                                            </strong>
                                        </td>

                                        <td data-label="Fecha de vencimiento">
                                            {estaEditando ? (
                                                <TextField
                                                    type="date"
                                                    size="small"
                                                    value={fechaEdicion}
                                                    onChange={(e) => setFechaEdicion(e.target.value)}
                                                    className={styles.inputFecha}
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                />
                                            ) : (
                                                <span>
                                                    {local.finContrato
                                                        ? formatearFecha(obtenerFechaInput(local.finContrato))
                                                        : "-"}
                                                </span>
                                            )}
                                        </td>

                                        <td data-label="Estado actual">
                                            <span className={`${styles.badge} ${styles[estado.clase]}`}>
                                                {estado.texto}
                                            </span>
                                        </td>

                                        <td data-label="Acciones" className={styles.acciones}>
                                            {estaEditando ? (
                                                <div className={styles.grupoBotonesEdit}>
                                                    <IconButton
                                                        color="primary"
                                                        size="small"
                                                        onClick={() => guardarFecha(local)}
                                                        title="Guardar"
                                                    >
                                                        <CheckIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        color="inherit"
                                                        size="small"
                                                        onClick={cancelarEdicion}
                                                        title="Cancelar"
                                                    >
                                                        <CloseIcon fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            ) : (
                                                <div className={styles.grupoBotones}>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => activarEdicion(local)}
                                                        title="Editar fecha"
                                                        className={styles.botonEditar}
                                                    >
                                                        <EditIcon fontSize="small" />
                                                    </IconButton>
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setLocalAEliminar(local)}
                                                        title="Eliminar contrato"
                                                        className={styles.botonEliminar}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Botón flotante para Agregar Contrato */}
            <div className={styles.contenedorAgregar}>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setModalCrearAbierto(true)}
                    className={styles.botonAgregar}
                >
                    Agregar contrato
                </Button>
            </div>

            {/* Modal para Crear Contrato */}
            <Dialog open={modalCrearAbierto} onClose={() => setModalCrearAbierto(false)} fullWidth maxWidth="xs">
                <form onSubmit={agregarContrato}>
                    <DialogTitle className={styles.modalTitulo}>Agregar contrato</DialogTitle>
                    <DialogContent className={styles.modalContenido}>
                        <FormControl fullWidth size="small" className={styles.campoModal}>
                            <InputLabel id="label-nave">Nave</InputLabel>
                            <Select
                                labelId="label-nave"
                                label="Nave"
                                value={nuevoContrato.nave}
                                onChange={(e) =>
                                    setNuevoContrato((actual) => ({ ...actual, nave: e.target.value as TipoNave }))
                                }
                            >
                                {naves.map((nave) => (
                                    <MenuItem key={nave} value={nave}>
                                        {nave}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <TextField
                            fullWidth
                            size="small"
                            label="Número de local (1-300)"
                            type="number"
                            slotProps={{ htmlInput: { min: 1, max: 300, step: 1 } }}
                            value={nuevoContrato.numeroLocal}
                            onChange={(e) => setNuevoContrato((actual) => ({ ...actual, numeroLocal: e.target.value }))}
                            className={styles.campoModal}
                        />

                        <TextField
                            fullWidth
                            size="small"
                            label="Fin de contrato (opcional)"
                            type="date"
                            slotProps={{ inputLabel: { shrink: true } }}
                            value={nuevoContrato.finContrato}
                            onChange={(e) => setNuevoContrato((actual) => ({ ...actual, finContrato: e.target.value }))}
                            className={styles.campoModal}
                        />
                    </DialogContent>
                    <DialogActions className={styles.modalAcciones}>
                        <Button
                            type="button"
                            variant="outlined"
                            onClick={() => setModalCrearAbierto(false)}
                            className={styles.botonCancelarModal}
                        >
                            Cancelar
                        </Button>
                        <Button type="submit" variant="contained" className={styles.botonGuardarModal}>
                            Guardar
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Modal de Confirmación de Eliminación */}
            <Dialog open={Boolean(localAEliminar)} onClose={() => setLocalAEliminar(null)} maxWidth="xs">
                <DialogTitle className={styles.modalTitulo}>¿Eliminar contrato?</DialogTitle>
                <DialogContent>
                    <p className={styles.textoConfirmacion}>
                        ¿Está seguro de que desea eliminar el local{" "}
                        <strong>
                            {localAEliminar?.nave}-{localAEliminar?.numeroLocal}
                        </strong>
                        ? Esta acción no se puede deshacer.
                    </p>
                </DialogContent>
                <DialogActions className={styles.modalAcciones}>
                    <Button
                        type="button"
                        variant="outlined"
                        onClick={() => setLocalAEliminar(null)}
                        className={styles.botonCancelarModal}
                    >
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        variant="contained"
                        color="error"
                        onClick={confirmarEliminacion}
                        className={styles.botonEliminarModal}
                    >
                        Eliminar
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Notificación única flotante en la esquina */}
            <Snackbar
                key={notificacion?.key}
                open={Boolean(notificacion)}
                autoHideDuration={4000}
                onClose={() => setNotificacion(null)}
                anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            >
                {notificacion ? (
                    <Alert onClose={() => setNotificacion(null)} severity={notificacion.tipo} variant="filled" sx={{ width: "100%" }}>
                        {notificacion.mensaje}
                    </Alert>
                ) : undefined}
            </Snackbar>

            {/* Anti warnings */}
            {void operadorId}
        </section>
    );
}

function calcularEstado(finContrato: string | null): { texto: string; clase: "vigente" | "expirado" } {
    if (!finContrato) return { texto: "Vigente", clase: "vigente" };

    const fecha = obtenerFechaInput(finContrato);
    const hoy = obtenerFechaActual();

    if (fecha < hoy) return { texto: "Expirado", clase: "expirado" };

    return { texto: "Vigente", clase: "vigente" };
}

function obtenerFechaInput(fecha: string): string {
    return fecha.slice(0, 10);
}

function obtenerFechaActual(): string {
    const hoy = new Date();
    const año = hoy.getFullYear();
    const mes = String(hoy.getMonth() + 1).padStart(2, "0");
    const dia = String(hoy.getDate()).padStart(2, "0");
    return `${año}-${mes}-${dia}`;
}

function formatearFecha(fecha: string): string {
    const [año, mes, dia] = fecha.split("-");
    return `${dia}/${mes}/${año}`;
}