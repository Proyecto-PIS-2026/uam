"use client";
import Link from "next/link";
import styles from "./FormularioAltaUsuario.module.css";
import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import { altaOperador } from "@/modulos/usuarios/operadores/altaOperador";
import type { NaveOpcion } from "./obtenerNaves";
const ROLES_VALIDOS = ["operador", "productor", "administrador"];

export default function FormularioAltaUsuario({ naves }: { naves: NaveOpcion[] }) {
    const searchParams = useSearchParams();    
    const rolInicial = searchParams.get("rol") ?? "";
    const [rol, setRol] = useState(ROLES_VALIDOS.includes(rolInicial) ? rolInicial : "");
    const [nombreUsuario, setNombreUsuario] = useState("");
    const [contraseña, setContraseña] = useState("");
    const [confirmacioncontraseña, setConfirmacionContraseña] = useState("");
    const [nombre, setNombre] = useState("");
    const [telefono, settelefono] = useState("");
    const [locales, setLocales] = useState([
        { numeroLocal: "", nave: "", contrato: "", mostrarContrato: false }
    ]);
    const [codigoPais, setCodigoPais] = useState("+598");
    const [mensajeExito, setMensajeExito] = useState("");
    const [errores, setErrores] = useState<string[]>([]);
    const [enviando, setEnviando] = useState(false);
    const [mensajeVisible, setMensajeVisible] = useState(false);
    const [mostrarPopup, setMostrarPopup] = useState(false);

    useEffect(() => {
    if (!mensajeExito) return;
    
    const ocultar = setTimeout(() => setMensajeVisible(false), 3500);
    const borrar = setTimeout(() => setMensajeExito(""), 4000);
    return () => {
        clearTimeout(ocultar);
        clearTimeout(borrar);
    };
    }, [mensajeExito]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setErrores([]);
        setEnviando(true);

        try {
            if (rol === "operador") {
                const resultado = await altaOperador({
                    rol,
                    nombreUsuario,
                    contraseña,
                    confirmacionContraseña: confirmacioncontraseña,
                    nombre,
                    codigoPais,
                    telefono,
                    locales: locales.map((local) => ({
                        numeroLocal: local.numeroLocal,
                        naveId: Number(local.nave),
                        contrato: local.contrato,
                    })),
                });

                if (!resultado.esValido) {
                    setErrores(resultado.errores);
                    return;
                }

                setNombreUsuario("");
                setContraseña("");
                setConfirmacionContraseña("");
                setCodigoPais("+598");
                setNombre("");
                settelefono("");
                setLocales([{ numeroLocal: "", nave: "", contrato: "", mostrarContrato: false }]);

                setMensajeExito(resultado.mensaje);
                setMensajeVisible(true);
                setMostrarPopup(true);
                return;
            }

            // Pendiente: productor y administrador
            setErrores(["Esta alta todavía no está disponible para el rol seleccionado."]);
        } finally {
            setEnviando(false);
        }
    }

    function agregarLocal() {
        setLocales([
            ...locales,
            { numeroLocal: "", nave: "", contrato: "", mostrarContrato: false }
        ]);
    }

    function actualizarLocal(index: number, campo: "numeroLocal" | "nave" | "contrato", valor: string) {
        setLocales(locales.map((l, i) => (i === index ? { ...l, [campo]: valor } : l)));
    }       
        
    function eliminarLocal(index: number) {
        if (locales.length === 1) {
            return;
        }

        setLocales(locales.filter((_, i) => i !== index));
    }

    return (
        <section className="contenedor-pagina flex flex-col gap-6">
            <EncabezadoPagina
                titulo="Alta de usuario"
                subtitulo="Registrar un nuevo usuario en la plataforma"
            />

            <form onSubmit={handleSubmit} className={styles.formulario}>
                <div className={styles.campo}>
                    <label htmlFor="rol" className={styles.label}>
                        Rol del usuario<span className="text-red-500">*</span>
                    </label>
                    <select
                        id="rol"
                        value={rol}
                        onChange={(e) => setRol(e.target.value)}
                        required
                        className={styles.control}
                    >
                        <option value="" disabled>
                            Seleccionar un rol
                        </option>
                        <option value="operador">Operador</option>
                        <option value="productor">Productor</option>
                        <option value="administrador">Administrador</option>
                    </select>
                </div>

                <div className={styles.campo}>
                    <label htmlFor="nombreUsuario" className={styles.label}>
                        Nombre de Usuario<span className="text-red-500">*</span>
                    </label>
                    <input
                        id="nombreUsuario"
                        type="text"
                        value={nombreUsuario}
                        required
                        onChange={(e) => setNombreUsuario(e.target.value)}
                        placeholder="Ingresar nombre de usuario"
                        className={styles.control}
                    />
                </div>

                <div className={styles.campo}>
                    <label htmlFor="contraseña" className={styles.label}>
                        Contraseña<span className="text-red-500">*</span>
                    </label>
                    <input
                        id="contraseña"
                        type="password"
                        value={contraseña}
                        required
                        minLength={8}
                        onChange={(e) => setContraseña(e.target.value)}
                        placeholder="Ingresar contraseña"
                        className={styles.control}
                    />
                </div>

                <div className={styles.campo}>
                    <label htmlFor="confirmacionContraseña" className={styles.label}>
                        Confirmación de Contraseña<span className="text-red-500">*</span>
                    </label>
                    <input
                        id="confirmacionContraseña"
                        type="password"
                        value={confirmacioncontraseña}
                        required
                        minLength={8}
                        onChange={(e) => setConfirmacionContraseña(e.target.value)}
                        placeholder="ingresar confirmación de contraseña"
                        className={styles.control}
                    />
                </div>
                
                {rol === "operador" && (
                <>
                    <div className={styles.campo}>
                        <label htmlFor="nombre" className={styles.label}>
                            Nombre<span className="text-red-500">*</span>
                        </label>
                        <input
                            id="nombre"
                            type="text"
                            value={nombre}
                            required
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ingresar nombre"
                            className={styles.control}
                        />
                    </div>

                    <div className={styles.campo}>
                        <label htmlFor="numero" className={styles.label}>
                            Numero de Teléfono (whatsApp)<span className="text-red-500">*</span>
                        </label>
                        <div className="flex gap-2">
                            <select
                                value={codigoPais}
                                onChange={(e) => setCodigoPais(e.target.value)}
                                aria-label="Código de país"
                                className={`${styles.control} w-44`}
                            >
                                <option value="+598">+598 (Uruguay)</option>
                                <option value="+54">+54 (Argentina)</option>
                                <option value="+55">+55 (Brasil)</option>
                                <option value="+56">+56 (Chile)</option>
                                <option value="+595">+595 (Paraguay)</option>
                            </select>
                            <input
                                id="numero"
                                type="tel"
                                value={telefono}
                                required
                                onChange={(e) => settelefono(e.target.value)}
                                placeholder="Ej: 99123456"
                                className={styles.control}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-3">
                        <label htmlFor="locales" className={styles.label}>
                            Locales <span className="text-red-500">(Mínimo 1)</span>
                        </label>
                        {locales.map((local, index) => (
                            <div
                                key={index}
                                className={styles.local}
                            >

                                <h3 className="text-sm font-semibold text-foreground lg:hidden">
                                    Local {index + 1}
                                </h3>

                                <input
                                    type="text"
                                    placeholder="Número de local"
                                    value={local.numeroLocal}
                                    required
                                    onChange={(e) => actualizarLocal(index, "numeroLocal", e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary lg:w-1/4"
                                />

                                <select
                                    value={local.nave}
                                    required
                                    onChange={(e) => actualizarLocal(index, "nave", e.target.value)}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-primary lg:w-1/4"
                                >
                                    <option value="" disabled>Seleccionar nave</option>
                                    {naves.map((nave) => (
                                        <option key={nave.id} value={nave.id}>
                                            {nave.nombre}
                                        </option>
                                    ))}
                                </select>

                                {local.mostrarContrato ? (
                                    <div className="flex w-full flex-col gap-2 lg:w-1/3 lg:flex-row">
                                        <input
                                            type="date"
                                            value={local.contrato}
                                            onChange={(e) =>
                                                actualizarLocal(index, "contrato", e.target.value)
                                            }
                                            className={`${styles.control} min-w-0`}
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setLocales(locales.map((l, i) =>
                                                    i === index
                                                        ? { ...l, contrato: "", mostrarContrato: false }
                                                        : l
                                                ))
                                            }
                                            className={styles.botonSecundario}
                                        >
                                            Eliminar fecha
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setLocales(locales.map((l, i) =>
                                                i === index
                                                    ? { ...l, mostrarContrato: true }
                                                    : l
                                            ))
                                        }
                                        className={styles.botonSecundario}
                                    >
                                        + Agregar fin de contrato
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => eliminarLocal(index)}
                                    disabled={index === 0}
                                    className={`${styles.botonSecundario} ${
                                        index === 0 ? "invisible" : ""
                                    }`}
                                >
                                    Eliminar local
                                </button>
                            </div>
                        ))}

                        <button
                            type="button"
                            onClick={agregarLocal}
                            className={styles.botonSecundario}
                        >
                            + Agregar local
                        </button>
                    </div>
                </>
                )}

                {mensajeExito && (
                    <p
                        className={`text-sm text-green-600 transition-opacity duration-500 ${
                            mensajeVisible ? "opacity-100" : "opacity-0"
                        }`}
                        role="status"
                    >
                        {mensajeExito}
                    </p>
                )}
                {errores.length > 0 && (
                        <ul className="text-sm text-red-500">
                            {errores.map((error) => (
                                <li key={error}>{error}</li>
                            ))}
                        </ul>
                )}
                <div className="flex justify-end gap-3 pt-6">
                    <button
                        type="button"
                            onClick={() => {
                                setNombreUsuario("");
                                setContraseña("");
                                setConfirmacionContraseña("");
                                setNombre("");
                                settelefono("");
                                setCodigoPais("+598");
                                setErrores([]);
                                setMensajeExito("");
                                setLocales([{ numeroLocal: "", nave: "", contrato: "", mostrarContrato: false }]);
                            }}
                        className={styles.botonSecundario}
                    >
                        Limpiar
                    </button>

                    <button
                        type="submit"
                        disabled={enviando}
                        className={styles.botonConfirmar}
                    >
                        {enviando ? "Registrando..." : "Registrar usuario"}
                    </button>
                </div>
            </form>

            {mostrarPopup && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
            <h2 className="text-xl font-bold text-foreground te">
                Operador creado satisfactoriamente
            </h2>

            <p className="mt-3 text-sm text-muted-foreground">
                ¿Desea precargar productos para este operador?
            </p>

            <div className="mt-6 flex justify-end gap-3">
                <button
                    type="button"
                    onClick={() => setMostrarPopup(false)}
                    className={styles.botonSecundario}
                >
                    Ahora no
                </button>

                <Link
                    href="/precargar-productos"
                    className={styles.botonConfirmar}
                >
                    Precargar productos
                </Link>
            </div>
        </div>
    </div>
)}
        </section>
    );
}
