"use client";
import Link from "next/link";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import styles from "./FormularioAltaUsuario.module.css";
import { useState, useEffect, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import BotonVolver from "@/compartido/BotonVolver";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import { altaOperador } from "@/modulos/usuarios/operadores/altaOperador";
import { altaProductor } from "@/modulos/usuarios/productores/altaProductor";

import type { NaveOpcion } from "@/modulos/usuarios/operadores/consultas-naves";
const ROLES_VALIDOS = ["operador", "productor", "administrador"];
const propiedadesMenuSelect = { select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } } as const;

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
    const [rolCreado, setRolCreado] = useState("");
    const [idUsuarioCreado, setIdUsuarioCreado] = useState<number | null>(null);

    useEffect(() => {
    if (!mensajeExito) return;
    
    const ocultar = setTimeout(() => setMensajeVisible(false), 3500);
    const borrar = setTimeout(() => setMensajeExito(""), 4000);
    return () => {
        clearTimeout(ocultar);
        clearTimeout(borrar);
    };
    }, [mensajeExito]);

    function limpiarFormulario() {
        setNombreUsuario("");
        setContraseña("");
        setConfirmacionContraseña("");
        setCodigoPais("+598");
        setNombre("");
        settelefono("");
        setLocales([
            { numeroLocal: "", nave: "", contrato: "", mostrarContrato: false }
        ]);
        setErrores([]);
        setMensajeExito("");
        setMensajeVisible(false);
    }

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

                limpiarFormulario();
                setMensajeExito(resultado.mensaje);
                setMensajeVisible(true);
                setIdUsuarioCreado(resultado.id);
                setRolCreado("operador");
                setMostrarPopup(true);
                return;
            }

            if (rol === "productor") {
                const resultado = await altaProductor({
                    rol,
                    nombreUsuario,
                    contraseña,
                    confirmacionContraseña: confirmacioncontraseña,
                    nombre,
                    codigoPais,
                    telefono,
                });

                if (!resultado.esValido) {
                    setErrores(resultado.errores);
                    return;
                }

                limpiarFormulario();
                setMensajeExito(resultado.mensaje);
                setMensajeVisible(true);
                setIdUsuarioCreado(resultado.id);
                setRolCreado("productor");
                setMostrarPopup(true);
                return;
            }
            // Pendiente: administrador
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
        <section className="contenedor-pagina secciones-pagina">
            <BotonVolver href="/administracion#usuarios">Volver al panel administrativo</BotonVolver>
            <EncabezadoPagina
                titulo="Alta de usuario"
                subtitulo="Registrar un nuevo usuario en la plataforma"
            />

            <form onSubmit={handleSubmit} className={styles.formulario}>
                <div className={styles.grilla}>
                    <TextField
                        id="rol"
                        select
                        label="Rol del usuario"
                        value={rol}
                        onChange={(e) => setRol(e.target.value)}
                        required
                        fullWidth
                        size="small"
                        className={styles.control}
                        slotProps={propiedadesMenuSelect}
                    >
                        <MenuItem value="" disabled className={styles.opcionSelect}>Seleccionar un rol</MenuItem>
                        <MenuItem value="operador" className={styles.opcionSelect}>Operador</MenuItem>
                        <MenuItem value="productor" className={styles.opcionSelect}>Productor</MenuItem>
                        <MenuItem value="administrador" className={styles.opcionSelect}>Administrador</MenuItem>
                    </TextField>
                    <TextField
                        id="nombreUsuario"
                        label="Nombre de Usuario"
                        value={nombreUsuario}
                        required
                        onChange={(e) => setNombreUsuario(e.target.value)}
                        placeholder="Ingresar nombre de usuario"
                        autoComplete="username"
                        fullWidth
                        size="small"
                        className={styles.control}
                    />
                    <TextField
                        id="contraseña"
                        label="Contraseña"
                        type="password"
                        value={contraseña}
                        required
                        onChange={(e) => setContraseña(e.target.value)}
                        placeholder="Ingresar contraseña"
                        autoComplete="new-password"
                        fullWidth
                        size="small"
                        slotProps={{ htmlInput: { minLength: 8 } }}
                        className={styles.control}
                    />
                    <TextField
                        id="confirmacionContraseña"
                        label="Confirmación de Contraseña"
                        type="password"
                        value={confirmacioncontraseña}
                        required
                        onChange={(e) => setConfirmacionContraseña(e.target.value)}
                        placeholder="Ingresar confirmación de contraseña"
                        autoComplete="new-password"
                        fullWidth
                        size="small"
                        slotProps={{ htmlInput: { minLength: 8 } }}
                        className={styles.control}
                    />
                </div>

                {(rol === "operador" || rol === "productor") && (
                    <>
                        <TextField
                            id="nombre"
                            label="Nombre"
                            value={nombre}
                            required
                            onChange={(e) => setNombre(e.target.value)}
                            placeholder="Ingresar nombre"
                            fullWidth
                            size="small"
                            className={styles.control}
                        />
                        <div className={styles.filaTelefono}>
                            <TextField
                                id="codigoPais"
                                select
                                label="Código de país"
                                value={codigoPais}
                                onChange={(e) => setCodigoPais(e.target.value)}
                                fullWidth
                                size="small"
                                className={styles.control}
                                slotProps={propiedadesMenuSelect}
                            >
                                <MenuItem value="+598" className={styles.opcionSelect}>+598 (Uruguay)</MenuItem>
                                <MenuItem value="+54" className={styles.opcionSelect}>+54 (Argentina)</MenuItem>
                                <MenuItem value="+55" className={styles.opcionSelect}>+55 (Brasil)</MenuItem>
                                <MenuItem value="+56" className={styles.opcionSelect}>+56 (Chile)</MenuItem>
                                <MenuItem value="+595" className={styles.opcionSelect}>+595 (Paraguay)</MenuItem>
                            </TextField>
                            <TextField
                                id="numero"
                                label="Número de teléfono (WhatsApp)"
                                type="tel"
                                value={telefono}
                                required
                                onChange={(e) => settelefono(e.target.value)}
                                placeholder="Ej: 99123456"
                                fullWidth
                                size="small"
                                className={styles.control}
                            />
                        </div>

                        {rol === "operador" && <section className={styles.locales} aria-labelledby="titulo-locales">
                            <div className={styles.encabezadoLocales}>
                                <div>
                                    <h2 id="titulo-locales" className={styles.subtitulo}>Locales</h2>
                                    <p className={styles.ayuda}>Agregá al menos un local para el operador.</p>
                                </div>
                                <button type="button" onClick={agregarLocal} className={styles.botonSecundario}>
                                    + Agregar local
                                </button>
                            </div>
                            {locales.map((local, index) => (
                                <div key={index} className={styles.local}>
                                    <div className={styles.encabezadoLocal}>
                                        <h3 className={styles.tituloLocal}>Local {index + 1}</h3>
                                        <button
                                            type="button"
                                            onClick={() => eliminarLocal(index)}
                                            disabled={index === 0}
                                            className={styles.botonEliminar}
                                        >
                                            Eliminar local
                                        </button>
                                    </div>
                                    <div className={styles.grillaLocal}>
                                        <TextField
                                            id={`numero-local-${index}`}
                                            label="Número de local"
                                            placeholder="Número de local"
                                            value={local.numeroLocal}
                                            required
                                            onChange={(e) => actualizarLocal(index, "numeroLocal", e.target.value)}
                                            fullWidth
                                            size="small"
                                            className={styles.control}
                                        />
                                        <TextField
                                            id={`nave-${index}`}
                                            select
                                            label="Nave"
                                            value={local.nave}
                                            required
                                            onChange={(e) => actualizarLocal(index, "nave", e.target.value)}
                                            fullWidth
                                            size="small"
                                            className={styles.control}
                                            slotProps={propiedadesMenuSelect}
                                        >
                                            <MenuItem value="" disabled className={styles.opcionSelect}>Seleccionar nave</MenuItem>
                                            {naves.map((nave) => (
                                                <MenuItem key={nave.id} value={nave.id} className={styles.opcionSelect}>
                                                    {nave.nombre}
                                                </MenuItem>
                                            ))}
                                        </TextField>
                                        {local.mostrarContrato ? (
                                            <div className={styles.contrato}>
                                                <TextField
                                                    id={`contrato-${index}`}
                                                    label="Fin de contrato"
                                                    type="date"
                                                    value={local.contrato}
                                                    onChange={(e) => actualizarLocal(index, "contrato", e.target.value)}
                                                    fullWidth
                                                    size="small"
                                                    slotProps={{ inputLabel: { shrink: true } }}
                                                    className={styles.control}
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setLocales(locales.map((l, i) =>
                                                        i === index ? { ...l, contrato: "", mostrarContrato: false } : l
                                                    ))}
                                                    className={styles.botonSecundario}
                                                >
                                                    Eliminar fecha
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setLocales(locales.map((l, i) =>
                                                    i === index ? { ...l, mostrarContrato: true } : l
                                                ))}
                                                className={styles.botonSecundario}
                                            >
                                                + Agregar fin de contrato
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </section>}
                    </>
                )}

                {mensajeExito && (
                    <p
                        className={`text-sm text-green-600 transition-opacity duration-500 ${mensajeVisible ? "opacity-100" : "opacity-0"}`}
                        role="status"
                    >
                        {mensajeExito}
                    </p>
                )}
                {errores.length > 0 && (
                    <ul className={styles.errores} role="alert">
                        {errores.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                )}
                <div className={styles.acciones}>
                    <button
                        type="button"
                        onClick={limpiarFormulario}
                        className={styles.botonSecundario}
                    >
                        Limpiar
                    </button>
                    <button type="submit" disabled={enviando} className={styles.botonConfirmar}>
                        {enviando ? "Registrando..." : "Registrar usuario"}
                    </button>
                </div>
            </form>

            {mostrarPopup && (rolCreado === "operador" || rolCreado === "productor") && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-surface p-[var(--padding-panel)] shadow-xl">
                        <h2 className="text-xl font-bold text-foreground">
                            {rolCreado === "operador"
                                ? "Operador creado satisfactoriamente"
                                : "Productor creado satisfactoriamente"}
                        </h2>

                        <p className="mt-3 text-sm text-muted-foreground">
                            ¿Desea precargar productos para este usuario?
                        </p>

                        <div className={`${styles.acciones} mt-[var(--espacio-secciones)]`}>
                            <button
                                type="button"
                                onClick={() => setMostrarPopup(false)}
                                className={styles.botonSecundario}
                            >
                                Ahora no
                            </button>
                            {idUsuarioCreado !== null && (
                                <Link
                                    href={
                                        rolCreado === "operador"
                                            ? `/gestion-operadores/${idUsuarioCreado}`
                                            : `/gestion-productores/${idUsuarioCreado}`
                                    }
                                    className={styles.botonConfirmar}
                                >
                                    Precargar productos
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
