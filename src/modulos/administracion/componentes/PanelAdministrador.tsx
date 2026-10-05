"use client";

import {
    useEffect,
    useId,
    useRef,
    useState,
    type FormEvent,
    type ReactNode,
} from "react";
import { Temporal } from "@js-temporal/polyfill";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import { datosEjemplo } from "../datos-ejemplo";
import {
    validarConfiguracion,
    estadoEnlace,
    type DatosPanel,
    type ClaveConfiguracion,
    type OperadorAdministrable,
    type CuentaAdministrable,
    type CambioOperador,
} from "../configuracion";
import styles from "./PanelAdministrador.module.css";

function useEdicion<T>(inicial: T, aplicar: (valor: T) => T) {
    const [vigente, setVigente] = useState(inicial);
    const [borrador, setBorrador] = useState(inicial);
    const [mensaje, setMensaje] = useState("");
    const [error, setError] = useState(false);
    function fallar(texto: string) {
        setError(true);
        setMensaje(texto);
    }
    function cancelar() {
        setBorrador(vigente);
        setMensaje("");
        setError(false);
    }
    function confirmar() {
        const valor = aplicar(borrador);
        setVigente(valor);
        setBorrador(valor);
        setError(false);
        setMensaje(
            "Cambios aplicados a esta vista de ejemplo. No se guardaron en el servidor.",
        );
    }
    return {
        vigente,
        borrador,
        setBorrador,
        mensaje,
        error,
        fallar,
        cancelar,
        confirmar,
    };
}

function Mensaje({ texto, error = false }: { texto: string; error?: boolean }) {
    return texto ? (
        <p
            role={error ? "alert" : "status"}
            className={`${styles.mensaje} ${error ? styles.error : styles.exito}`}
        >
            {texto}
        </p>
    ) : null;
}
function Botones({ cancelar }: { cancelar: () => void }) {
    return (
        <div className={styles.acciones}>
            <button type="submit">Guardar</button>
            <button type="button" onClick={cancelar}>
                Cancelar
            </button>
        </div>
    );
}

function Tarjeta({
    id,
    titulo,
    ayuda,
    children,
}: {
    id: string;
    titulo: string;
    ayuda: string;
    children: ReactNode;
}) {
    return (
        <section
            id={id}
            aria-labelledby={`${id}-titulo`}
            className={styles.tarjeta}
        >
            <h2 id={`${id}-titulo`}>{titulo}</h2>
            <p className={styles.ayuda}>{ayuda}</p>
            {children}
        </section>
    );
}

const ajustes: {
    clave: ClaveConfiguracion;
    titulo: string;
    ayuda: string;
    label: string;
}[] = [
    {
        clave: "ordenamiento",
        titulo: "Ordenamiento de resultados",
        ayuda: "Mostrá u ocultá las opciones para ordenar las publicaciones. La búsqueda y los filtros siguen disponibles.",
        label: "Habilitar ordenamiento",
    },
    {
        clave: "incremento",
        titulo: "Ajuste rápido de precios",
        ayuda: "Importe en pesos para los controles de aumento y disminución rápida de precios.",
        label: "Importe de ajuste ($)",
    },
    {
        clave: "lista",
        titulo: "Lista Inteligente",
        ayuda: "Enlace al recurso externo de la UAM.",
        label: "URL de la Lista Inteligente",
    },
    {
        clave: "fotografias",
        titulo: "Vigencia de fotografías",
        ayuda: "Indicá cuántos días se considera vigente una fotografía.",
        label: "Período de vigencia (días)",
    },
];

function Ajuste({
    ajuste,
    inicial,
}: {
    ajuste: (typeof ajustes)[number];
    inicial: string | null;
}) {
    const id = useId();
    const edicion = useEdicion<string | null>(inicial, (valor) => {
        const validacion = validarConfiguracion(
            ajuste.clave,
            valor ?? (ajuste.clave === "ordenamiento" ? "true" : ""),
        );
        return validacion.ok ? validacion.valor : valor;
    });
    const { vigente, borrador } = edicion;
    let texto = vigente === null ? "Sin configurar" : vigente;
    if (ajuste.clave === "ordenamiento")
        texto =
            vigente === "true"
                ? "Habilitado"
                : vigente === "false"
                  ? "Deshabilitado"
                  : vigente === null
                    ? "Sin configurar (habilitado por defecto)"
                    : "Valor guardado inválido";
    if (ajuste.clave === "lista")
        texto =
            estadoEnlace(vigente) === "ausente"
                ? "Sin configurar"
                : estadoEnlace(vigente) === "invalido"
                  ? `URL guardada inválida: ${vigente}`
                  : vigente!;
    if (ajuste.clave === "fotografias" && vigente !== null) texto += " días";
    function enviar(evento: FormEvent) {
        evento.preventDefault();
        const validacion = validarConfiguracion(
            ajuste.clave,
            borrador ?? (ajuste.clave === "ordenamiento" ? "true" : ""),
        );
        if (!validacion.ok) {
            edicion.fallar(validacion.mensaje);
            return;
        }
        edicion.confirmar();
    }
    return (
        <Tarjeta id={ajuste.clave} titulo={ajuste.titulo} ayuda={ajuste.ayuda}>
            <p className={styles.vigente}>
                <strong>Valor vigente: </strong>
                {texto}
            </p>
            <form onSubmit={enviar} noValidate className={styles.formulario}>
                {ajuste.clave === "ordenamiento" ? (
                    <label className={styles.checkbox} htmlFor={id}>
                        <input
                            id={id}
                            type="checkbox"
                            checked={borrador === "true" || borrador === null}

                            onChange={(e) =>
                                edicion.setBorrador(String(e.target.checked))
                            }
                        />
                        {ajuste.label}
                    </label>
                ) : (
                    <label className={styles.campo} htmlFor={id}>
                        {ajuste.label}
                        <input
                            id={id}
                            type={ajuste.clave === "lista" ? "url" : "number"}
                            value={borrador ?? ""}
                            required
                            min={ajuste.clave === "fotografias" ? 1 : 0.01}
                            step={ajuste.clave === "fotografias" ? 1 : 0.01}

                            aria-invalid={edicion.error}
                            aria-describedby={
                                edicion.mensaje ? `${id}-mensaje` : undefined
                            }
                            onChange={(e) =>
                                edicion.setBorrador(e.target.value)
                            }
                        />
                    </label>
                )}
                <Botones cancelar={edicion.cancelar} />
                <div id={`${id}-mensaje`}>
                    <Mensaje texto={edicion.mensaje} error={edicion.error} />
                </div>
            </form>
        </Tarjeta>
    );
}

function EditarOperador({
    operador,
    alGuardar,
}: {
    operador: OperadorAdministrable;
    alGuardar: (cambio: CambioOperador) => void;
}) {
    const id = useId();
    const edicion = useEdicion<CambioOperador>(
        {
            id: operador.id,
            disponible: operador.disponible,
            locales: operador.locales.map(({ id, finContrato }) => ({
                id,
                finContrato,
            })),
        },
        (cambio) => {
            alGuardar(cambio);
            return cambio;
        },
    );
    function enviar(evento: FormEvent) {
        evento.preventDefault();
        try {
            for (const local of edicion.borrador.locales)
                if (local.finContrato !== null) {
                    if (!/^\d{4}-\d{2}-\d{2}$/.test(local.finContrato))
                        throw new Error();
                    Temporal.PlainDate.from(local.finContrato, {
                        overflow: "reject",
                    });
                }
        } catch {
            edicion.fallar(
                "Ingresá una fecha válida o dejá el campo vacío para indicar sin vencimiento.",
            );
            return;
        }
        edicion.confirmar();
    }
    return (
        <form onSubmit={enviar} noValidate className={styles.formulario}>
            <p className={styles.vigente}>
                Disponibilidad vigente:{" "}
                <strong>
                    {edicion.vigente.disponible
                        ? "Disponible"
                        : "No disponible"}
                </strong>
            </p>
            <label htmlFor={id} className={styles.checkbox}>
                <input
                    id={id}
                    type="checkbox"
                    checked={edicion.borrador.disponible}

                    onChange={(e) =>
                        edicion.setBorrador({
                            ...edicion.borrador,
                            disponible: e.target.checked,
                        })
                    }
                />
                Operador disponible
            </label>
            {operador.locales.map((local) => (
                <div key={local.id}>
                    <label
                        htmlFor={`${id}-${local.id}`}
                        className={styles.campo}
                    >
                        Fin de contrato · {local.nombre}
                        <input
                            id={`${id}-${local.id}`}
                            type="date"

                            aria-invalid={edicion.error}
                            value={
                                edicion.borrador.locales.find(
                                    (l) => l.id === local.id,
                                )?.finContrato ?? ""
                            }
                            onChange={(e) =>
                                edicion.setBorrador({
                                    ...edicion.borrador,
                                    locales: edicion.borrador.locales.map(
                                        (l) =>
                                            l.id === local.id
                                                ? {
                                                      ...l,
                                                      finContrato:
                                                          e.target.value ||
                                                          null,
                                                  }
                                                : l,
                                    ),
                                })
                            }
                        />
                    </label>
                    <p className={styles.ayuda}>
                        Fecha vigente:{" "}
                        {edicion.vigente.locales.find((l) => l.id === local.id)
                            ?.finContrato ?? "Sin vencimiento"}
                    </p>
                </div>
            ))}
            {!operador.locales.length && (
                <p className={styles.ayuda}>
                    Este Operador no tiene locales registrados. No tiene un
                    contrato local para editar.
                </p>
            )}
            <Botones cancelar={edicion.cancelar} />
            <Mensaje texto={edicion.mensaje} error={edicion.error} />
        </form>
    );
}

function Editar2FA({
    cuenta,
    alGuardar,
}: {
    cuenta: CuentaAdministrable;
    alGuardar: (id: number, habilitado: boolean) => void;
}) {
    const id = useId();
    const edicion = useEdicion(cuenta.twoFactorEnabled, (habilitado) => {
        alGuardar(cuenta.id, habilitado);
        return habilitado;
    });
    const [confirmacion, setConfirmacion] = useState(false);
    const confirmarRef = useRef<HTMLButtonElement>(null);
    useEffect(() => {
        if (confirmacion) confirmarRef.current?.focus();
    }, [confirmacion]);
    function cancelar() {
        setConfirmacion(false);
        edicion.cancelar();
    }
    return (
        <form
            className={styles.formulario}

            onSubmit={(e) => {
                e.preventDefault();
                setConfirmacion(true);
            }}
        >
            <p className={styles.vigente}>
                2FA vigente:{" "}
                <strong>
                    {edicion.vigente ? "Habilitado" : "Deshabilitado"}
                </strong>
            </p>
            <label htmlFor={id} className={styles.checkbox}>
                <input
                    id={id}
                    type="checkbox"
                    disabled={confirmacion}
                    checked={edicion.borrador}
                    onChange={(e) => edicion.setBorrador(e.target.checked)}
                />
                Habilitar 2FA para {cuenta.username}
            </label>
            {confirmacion ? (
                <div role="group" aria-label="Confirmar cambio de 2FA">
                    <p>
                        ¿Confirmar{" "}
                        {edicion.borrador ? "habilitación" : "deshabilitación"}{" "}
                        de 2FA para {cuenta.username}?
                    </p>
                    <div className={styles.acciones}>
                        <button
                            ref={confirmarRef}
                            type="button"
                            className={styles.primario}

                            onClick={() => {
                                edicion.confirmar();
                                setConfirmacion(false);
                            }}
                        >
                            Confirmar cambio
                        </button>
                        <button
                            type="button"

                            onClick={cancelar}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            ) : (
                <Botones cancelar={cancelar} />
            )}
            <Mensaje texto={edicion.mensaje} error={edicion.error} />
        </form>
    );
}

function GestionOperadores({
    operadores,
    alGuardar,
}: {
    operadores: OperadorAdministrable[];
    alGuardar: (cambio: CambioOperador) => void;
}) {
    const [busqueda, setBusqueda] = useState("");
    const [seleccion, setSeleccion] = useState("");
    const operador = operadores.find((o) => String(o.id) === seleccion);
    return (
        <Tarjeta
            id="operadores"
            titulo="Disponibilidad y contratos"
            ayuda="Un Operador con todos sus contratos vencidos deja de verse al público. Basta un local vigente o sin vencimiento para mantener el contrato vigente. La disponibilidad no modifica la licencia ni reactiva publicaciones dadas de baja."
        >
            <label className={styles.campo}>
                Buscar Operador
                <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </label>
            <label className={styles.campo}>
                Seleccionar Operador
                <select
                    value={seleccion}
                    onChange={(e) => setSeleccion(e.target.value)}
                >
                    <option value="">Seleccioná un Operador</option>
                    {operadores
                        .filter(
                            (o) =>
                                String(o.id) === seleccion ||
                                o.nombreFantasia
                                    .toLocaleLowerCase("es")
                                    .includes(busqueda.toLocaleLowerCase("es")),
                        )
                        .map((o) => (
                            <option key={o.id} value={o.id}>
                                {o.nombreFantasia}
                            </option>
                        ))}
                </select>
            </label>
            {!operadores.length && (
                <p role="status">No hay Operadores registrados.</p>
            )}
            {operador && (
                <EditarOperador
                    key={operador.id}
                    operador={operador}
                    alGuardar={alGuardar}
                />
            )}
        </Tarjeta>
    );
}
function Gestion2FA({
    cuentas,
    alGuardar,
}: {
    cuentas: CuentaAdministrable[];
    alGuardar: (id: number, habilitado: boolean) => void;
}) {
    const [busqueda, setBusqueda] = useState("");
    const [seleccion, setSeleccion] = useState("");
    const permitidas = cuentas.filter(
        (c) => c.rol === "OPERADOR" || c.rol === "PRODUCTOR",
    );
    const cuenta = permitidas.find((c) => String(c.id) === seleccion);
    return (
        <Tarjeta
            id="seguridad"
            titulo="Segundo factor (2FA)"
            ayuda="Configuración por cuenta de Operador o Productor. El 2FA de Administradores es obligatorio. "
        >
            <label className={styles.campo}>
                Buscar cuenta
                <input
                    type="search"
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                />
            </label>
            <label className={styles.campo}>
                Seleccionar cuenta
                <select
                    value={seleccion}
                    onChange={(e) => setSeleccion(e.target.value)}
                >
                    <option value="">Seleccioná una cuenta</option>
                    {permitidas
                        .filter(
                            (c) =>
                                String(c.id) === seleccion ||
                                c.username
                                    .toLocaleLowerCase("es")
                                    .includes(busqueda.toLocaleLowerCase("es")),
                        )
                        .map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.username} ·{" "}
                                {c.rol === "OPERADOR"
                                    ? "Operador"
                                    : "Productor"}
                            </option>
                        ))}
                </select>
            </label>
            {!permitidas.length && (
                <p role="status">No hay cuentas de Operadores o Productores.</p>
            )}
            {cuenta && (
                <Editar2FA
                    key={cuenta.id}
                    cuenta={cuenta}
                    alGuardar={alGuardar}
                />
            )}
        </Tarjeta>
    );
}

export default function PanelAdministrador() {
    const [datos, setDatos] = useState<DatosPanel>(datosEjemplo);
    function actualizarOperador(cambio: CambioOperador) {
        setDatos((anteriores) => ({
            ...anteriores,
            operadores: anteriores.operadores.map((operador) =>
                operador.id !== cambio.id
                    ? operador
                    : {
                          ...operador,
                          disponible: cambio.disponible,
                          locales: operador.locales.map((local) => ({
                              ...local,
                              finContrato: cambio.locales.find(
                                  (nuevo) => nuevo.id === local.id,
                              )!.finContrato,
                          })),
                      },
            ),
        }));
    }
    function actualizar2FA(id: number, habilitado: boolean) {
        setDatos((anteriores) => ({
            ...anteriores,
            cuentas: anteriores.cuentas.map((cuenta) =>
                cuenta.id !== id
                    ? cuenta
                    : { ...cuenta, twoFactorEnabled: habilitado },
            ),
        }));
    }
    return (
        <main className="contenedor-pagina">
            <div className={styles.panel}>
                <EncabezadoPagina
                    titulo="Administración"
                    cantidad={6}
                    subtitulo="configuraciones de la aplicación"
                />
                <p className={`${styles.mensaje} ${styles.exito}`}>
                    <strong>Vista de diseño con datos de ejemplo.</strong> Los
                    cambios solo se aplican a esta pantalla y se reinician al
                    recargar.
                </p>
                <nav
                    className={styles.navegacion}
                    aria-label="Secciones de administración"
                >
                    <a href="#ordenamiento">Configuración general</a>
                    <a href="#operadores">Operadores</a>
                    <a href="#seguridad">Seguridad</a>
                </nav>
                <div className={styles.grilla}>
                    {ajustes.map((ajuste) => (
                        <Ajuste
                            key={ajuste.clave}
                            ajuste={ajuste}
                            inicial={datos.configuracion[ajuste.clave]}
                        />
                    ))}
                    <GestionOperadores
                        operadores={datos.operadores}
                        alGuardar={actualizarOperador}
                    />
                    <Gestion2FA
                        cuentas={datos.cuentas}
                        alGuardar={actualizar2FA}
                    />
                </div>
            </div>
        </main>
    );
}
