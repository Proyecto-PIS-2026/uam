"use client";

import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import Link from "next/link";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import styles from "./FormularioAltaUsuario.module.css";
import { useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import BotonVolver from "@/compartido/BotonVolver";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import { altaOperador } from "@/modulos/usuarios/operadores/altaOperador";
import { altaProductor } from "@/modulos/usuarios/productores/altaProductor";
import SelectorFotoPerfil, { argumentosFotoPerfil, type CambioFotoPerfil } from "@/modulos/usuarios/componentes/SelectorFotoPerfil";

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
    const { notificar } = useNotificacionToast();
    const [errores, setErrores] = useState<string[]>([]);
    const [enviando, setEnviando] = useState(false);
    const envioEnCurso = useRef(false);
    const [foto, setFoto] = useState<CambioFotoPerfil>(undefined);
    const [mostrarPopup, setMostrarPopup] = useState(false);
    const ahoraNoRef = useRef<HTMLButtonElement>(null);
    const [rolCreado, setRolCreado] = useState("");
    const [idUsuarioCreado, setIdUsuarioCreado] = useState<number | null>(null);

    function limpiarFormulario() {
        setFoto(undefined);
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
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (envioEnCurso.current) return;
        envioEnCurso.current = true;
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
                }, ...argumentosFotoPerfil(foto));

                if (!resultado.esValido) {
                    setErrores(resultado.errores);
                    return;
                }

                limpiarFormulario();
                notificar(resultado.mensaje, "success");
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
                }, ...argumentosFotoPerfil(foto));

                if (!resultado.esValido) {
                    setErrores(resultado.errores);
                    return;
                }

                limpiarFormulario();
                notificar(resultado.mensaje, "success");
                setIdUsuarioCreado(resultado.id);
                setRolCreado("productor");
                setMostrarPopup(true);
                return;
            }
            // Pendiente: administrador
            setErrores(["Esta alta todavía no está disponible para el rol seleccionado."]);
        } catch {
            notificar("No se pudo registrar el usuario. Intentá de nuevo.", "error");
        } finally {
            envioEnCurso.current = false;
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
        if (campo === "numeroLocal" && !/^[0-9]*$/.test(valor)) return;
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
                        disabled={enviando}
                        id="rol"
                        select
                        label="Rol del usuario"
                        value={rol}
                        onChange={(e) => { setRol(e.target.value); setFoto(undefined); }}
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
                        disabled={enviando}
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
                        disabled={enviando}
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
                        disabled={enviando}
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
                        <SelectorFotoPerfil key={rol} cambio={foto} alCambiar={setFoto} alError={(mensaje) => notificar(mensaje, "error")} deshabilitado={enviando} />
                        <TextField
                            disabled={enviando}
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
                                disabled={enviando}
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
                                disabled={enviando}
                                id="numero"
                                label="Número de teléfono (WhatsApp)"
                                type="tel"
                                value={telefono}
                                required
                                onChange={(e) => settelefono(e.target.value.replace(/\D/g, ""))}
                                slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
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
                                <button type="button" onClick={agregarLocal} className={styles.botonSecundario} disabled={enviando}>
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
                                            disabled={enviando || index === 0}
                                            className={styles.botonEliminar}
                                        >
                                            Eliminar local
                                        </button>
                                    </div>
                                    <div className={styles.grillaLocal}>
                                        <TextField
                                            disabled={enviando}
                                            id={`numero-local-${index}`}
                                            label="Número de local"
                                            placeholder="Número de local"
                                            type="text"
                                            value={local.numeroLocal}
                                            required
                                            slotProps={{ htmlInput: { inputMode: "numeric", pattern: "[0-9]*" } }}
                                            onChange={(e) => actualizarLocal(index, "numeroLocal", e.target.value)}
                                            fullWidth
                                            size="small"
                                            className={styles.control}
                                        />
                                        <TextField
                                            disabled={enviando}
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
                                                    disabled={enviando}
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
                                                    disabled={enviando}
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
                                                disabled={enviando}
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

                {errores.length > 0 && (
                    <ul className={styles.errores} role="alert">
                        {errores.map((error) => <li key={error}>{error}</li>)}
                    </ul>
                )}
                <div className={styles.acciones}>
                    <button
                        type="button"
                        onClick={limpiarFormulario}
                        disabled={enviando}
                        className={styles.botonSecundario}
                    >
                        Limpiar
                    </button>
                    <button type="submit" disabled={enviando} className={styles.botonConfirmar}>
                        {enviando ? "Registrando..." : "Registrar usuario"}
                    </button>
                </div>
            </form>

            <Dialog
                open={mostrarPopup && (rolCreado === "operador" || rolCreado === "productor")}
                onClose={() => setMostrarPopup(false)}
                maxWidth={false}
                aria-labelledby="titulo-usuario-creado"
                aria-describedby="descripcion-usuario-creado"
                slotProps={{
                    paper: { sx: { m: 2, width: "calc(100% - 32px)", maxWidth: "28rem", p: "var(--padding-panel)" } },
                    transition: { onEntered: () => ahoraNoRef.current?.focus() },
                }}
            >
                <h2 id="titulo-usuario-creado" className={styles.subtitulo}>
                    {rolCreado === "operador"
                        ? "Operador creado satisfactoriamente"
                        : "Productor creado satisfactoriamente"}
                </h2>

                <p id="descripcion-usuario-creado" className={styles.descripcionPopup}>
                    ¿Desea precargar productos para este usuario?
                </p>

                <div className={`${styles.acciones} mt-[var(--espacio-secciones)]`}>
                    <button
                        ref={ahoraNoRef}
                        type="button"
                        autoFocus
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
            </Dialog>
        </section>
    );
}
