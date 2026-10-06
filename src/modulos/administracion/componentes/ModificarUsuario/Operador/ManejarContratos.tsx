"use client";

import { useState } from "react";

import type { LocalParaModificar, TipoNave } from "../../Compartidos/Tipos";

interface ManejarContratosProps {
    operadorId: number;
    locales: LocalParaModificar[];
}

interface NuevoContrato {
    nave: TipoNave | "";
    numeroLocal: string;
    finContrato: string;
}

export default function ManejarContratos({ operadorId, locales }: ManejarContratosProps) {
    const [localesActuales, setLocalesActuales] = useState<LocalParaModificar[]>(locales);
    const [nuevoContrato, setNuevoContrato] = useState<NuevoContrato>({ nave: "", numeroLocal: "", finContrato: "" });
    const [error, setError] = useState<string | null>(null);
    const [mensaje, setMensaje] = useState<string | null>(null);
    const naves: TipoNave[] = ["A", "B", "D", "E", "Tinglado"];

    function cambiarFecha(localId: number, fecha: string) {
        setLocalesActuales((actuales) =>
            actuales.map((local) =>
                local.id === localId ? { ...local, finContrato: fecha === "" ? null : fecha } : local,
            ),
        );
        setMensaje(null);
        setError(null);
    }

    function guardarFecha(local: LocalParaModificar) {
        /*
        * TODO: implementar creación en BD.
        *
        * Consulta/acción:
        * agregarLocalOperador()
        *
        * Datos:
        * {
        *     operadorId,
        *     naveId: nave.id,
        *     numeroLocal,
        *     finContrato:
        *         nuevoContrato.finContrato === ""
        *             ? null
        *             : nuevoContrato.finContrato
        * }
        *
        * El id del local será generado automáticamente por Prisma.
        * La unicidad de nave + numeroLocal se valida exclusivamente en backend/BD.
        */

        setMensaje(`La fecha del local ${local.numeroLocal} fue validada.`);
    }

    function eliminarLocal(local: LocalParaModificar) {
        const confirmado = window.confirm(`¿Está seguro de que desea eliminar el local ${local.numeroLocal} de la nave ${local.nave}?\n\nEsta acción eliminará el local de la base de datos.`);
        if (!confirmado) return;

        setLocalesActuales((actuales) => actuales.filter((item) => item.id !== local.id));

        /*
         * TODO: implementar eliminación en BD.
         *
         * Consulta/acción:
         * eliminarLocal()
         *
         * Datos:
         * {
         *     localId: local.id,
         *     operadorId
         * }
         */

        setMensaje(`El local ${local.numeroLocal} fue eliminado de la vista.`);
    }

    function agregarContrato(evento: React.FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        setError(null);
        setMensaje(null);

        if (nuevoContrato.nave === "") {
            setError("Debe seleccionar una nave.");
            return;
        }

        const numeroLocal = Number(nuevoContrato.numeroLocal);
        if (!Number.isInteger(numeroLocal) || numeroLocal < 1 || numeroLocal > 300) {
            setError("El número de local debe ser un entero entre 1 y 300.");
            return;
        }

        /*
        * TODO: implementar creación en BD.
        *
        * Consulta/acción:
        * agregarLocalOperador()
        *
        * Datos:
        * {
        *     operadorId,
        *     naveId: nave.id,
        *     numeroLocal,
        *     finContrato:
        *         nuevoContrato.finContrato === ""
        *             ? null
        *             : nuevoContrato.finContrato
        * }
        *
        * El id del local será generado automáticamente por Prisma.
        * La unicidad de nave + numeroLocal se valida exclusivamente en backend/BD.
        */

        setNuevoContrato({ nave: "", numeroLocal: "", finContrato: "" });
        setMensaje("El contrato fue validado.");
    }

    return (
        <section>
            <h3>Contratos y locales</h3>

            {localesActuales.length === 0 ? (<p> El operador no tiene locales asignados. </p>
            ) : (
                <div>
                    {localesActuales.map((local) => (
                        <div key={local.id}>
                            <div>
                                <strong> Local{" "} {local.numeroLocal} </strong>
                                <span> Nave{" "} {local.nave} </span>
                                <span> {obtenerEstadoContrato(local.finContrato)} </span>
                            </div>

                            <div>
                                <label htmlFor={`fecha-contrato-${local.id}`}> Fin de contrato </label>

                                <input id={`fecha-contrato-${local.id}`} type="date" value={local.finContrato ? obtenerFechaInput(local.finContrato) : ""}
                                    onChange={(evento) => cambiarFecha(local.id, evento.target.value)}
                                />

                                <button type="button" onClick={() => guardarFecha(local)}> Guardar vencimiento </button>

                                <button type="button" onClick={() => eliminarLocal(local)}> Eliminar contrato </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div>
                <h4>Agregar contrato</h4>

                <form onSubmit={agregarContrato} >
                    <div>
                        <label htmlFor="nueva-nave"> Nave </label>
                        <select id="nueva-nave" value={nuevoContrato.nave} onChange={(evento) => setNuevoContrato((actual) => ({...actual, naveId: evento.target.value}))}>
                            <option value=""> Seleccionar nave </option>
                            {naves.map((nave) => (<option key={nave} value={nave}> {nave} </option>))}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="nuevo-numero-local"> Número de local </label>
                        <input id="nuevo-numero-local" type="number" min={1} max={300} step={1} value={nuevoContrato.numeroLocal} onChange={(evento) =>
                            setNuevoContrato((actual) => ({...actual, numeroLocal: evento.target.value}))}/>
                    </div>

                    <div>
                        <label htmlFor="nuevo-fin-contrato"> Fin de contrato </label>
                        <input id="nuevo-fin-contrato" type="date" value={nuevoContrato.finContrato} onChange={(evento) =>
                            setNuevoContrato((actual) => ({...actual, finContrato: evento.target.value}))}/>
                    </div>

                    {error && (<p role="alert"> {error} </p>)}

                    {mensaje && (<p> {mensaje} </p>)}

                    <button type="submit"> Agregar contrato </button>
                </form>
            </div>

            {/*
             * operadorId queda disponible para las futuras
             * operaciones de escritura.
             */}
            {void operadorId}
        </section>
    );
}

function obtenerEstadoContrato(finContrato: string | null): string {
    if (!finContrato) return "Sin vencimiento";

    const fecha = obtenerFechaInput(finContrato);

    const hoy = obtenerFechaActual();

    if (fecha < hoy) return "Vencido";

    return `Vencimiento: ${formatearFecha(fecha)}`;
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