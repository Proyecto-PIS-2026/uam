"use client";

import { fetchConSesion } from "@/modulos/identidad-acceso/autenticacion/cliente-sesion";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "../precio-publicacion";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import OutlinedInput from "@mui/material/OutlinedInput";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import Image from "next/image";
import { compararEspeciesPorPrioridad } from "@/compartido/prioridad-especies";
import { ordenarOpcionesPorNombre } from "../operadores/ordenar-opciones";
import styles from "../operadores/componentes/DrawerEditarPublicacion.module.css";
import UbicacionesEdicionProductor, { type UbicacionEdicionProductor } from "./UbicacionesEdicionProductor";
import { validarUbicacionesProductor } from "./ubicaciones-productor";
import CampoComentario from "../componentes/CampoComentario";

type Opcion = { id: number; nombre: string };
type Catalogos = {
    especies: Opcion[];
    variedades: (Opcion & { especieId: number })[];
    envases: Opcion[];
    kilos: Opcion[];
    categorias: (Opcion & { especieId: number | null })[];
    calibres: Opcion[];
    paises: Opcion[];
};
type Formulario = {
    productorId: number; especieId: number; variedadId: number; envaseId: number; kilosId: number; calibreId: number;
    categoriaId: number; paisId: number; ubicaciones: UbicacionEdicionProductor[]; disponibilidad: boolean;
    precio: string; cantidad: string; comentario: string; fotografia: string; fechaVigencia: string;
};

type PropsDrawer = {
    productorId: number;
    disponibilidadInicial?: boolean;
    abierto: boolean;
    alCerrar: () => void;
    alCrear: (mensaje: string) => void;
};

function formularioInicial(productorId: number, disponibilidadInicial: boolean): Formulario {
    return {
        productorId,
        especieId: 0,
        variedadId: 0,
        envaseId: 0,
        kilosId: 0,
        calibreId: 0,
        categoriaId: 0,
        paisId: 0,
        ubicaciones: [],
        disponibilidad: disponibilidadInicial,
        precio: "",
        cantidad: "",
        comentario: "",
        fotografia: "",
        fechaVigencia: "",
    };
}

function opciones<T extends Opcion>(opciones: T[]) {
    return ordenarOpcionesPorNombre(opciones);
}

async function cargarCatalogos() {
    const respuesta = await fetchConSesion("/api/publicaciones/productor");
    if (!respuesta.ok) throw new Error("No se pudieron cargar los datos.");
    const datos = await respuesta.json() as Catalogos;
    return {
        ...datos,
        especies: [...datos.especies].sort((primera, segunda) => compararEspeciesPorPrioridad(primera.nombre, segunda.nombre)),
        variedades: opciones(datos.variedades),
        envases: opciones(datos.envases),
        kilos: opciones(datos.kilos),
        categorias: opciones(datos.categorias),
        calibres: opciones(datos.calibres),
        paises: opciones(datos.paises),
    };
}

function useCatalogosPublicacion() {
    const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(true);
    const [intento, setIntento] = useState(0);
    const solicitudPendiente = useRef(true);

    useEffect(() => {
        let activo = true;
        cargarCatalogos()
            .then((resultado) => {
                if (activo) {
                    setCatalogos(resultado);
                    setError("");
                }
            })
            .catch(() => {
                if (activo) setError("No se pudieron cargar las opciones de la publicación. Volvé a intentarlo.");
            })
            .finally(() => {
                if (activo) {
                    solicitudPendiente.current = false;
                    setCargando(false);
                }
            });
        return () => { activo = false; };
    }, [intento]);

    function reintentar() {
        if (solicitudPendiente.current) return;
        solicitudPendiente.current = true;
        setCargando(true);
        setIntento((actual) => actual + 1);
    }

    return { catalogos, error, cargando, reintentar };
}

function Campo({ nombre, valor, opciones: lista, cambiar, deshabilitado = false }: {
    nombre: string; valor: number; opciones: Opcion[]; cambiar: (id: number) => void; deshabilitado?: boolean;
}) {
    return <TextField select label={nombre} value={valor || ""} onChange={(evento) => cambiar(Number(evento.target.value))}
        size="small" fullWidth required={nombre === "Especie"} disabled={deshabilitado} className={styles.selectMui}
        slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } }}>
        <MenuItem value="" disabled={nombre === "Especie"}>{nombre === "Especie" ? "Seleccioná especie" : "Sin especificar"}</MenuItem>
        {lista.map((opcion) => <MenuItem key={opcion.id} value={opcion.id}>{opcion.nombre}</MenuItem>)}
    </TextField>;
}

export default function AltaPublicacionProductor({ productorId }: { productorId: number }) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const { catalogos, error, cargando, reintentar } = useCatalogosPublicacion();
    const [abierto, setAbierto] = useState(false);
    const { notificar } = useNotificacionToast();

    useEffect(() => {
        if (error && !cargando) notificar(error, "error");
    }, [error, cargando, notificar]);

    return <main className="contenedor-pagina secciones-pagina flex-1">
        <header className="encabezado-pagina"><h1 className="titulo-pagina">Alta de publicación de Productor</h1></header>
        <button type="button" className={styles.guardar} onClick={() => { setAbierto(true); }} disabled={cargando || !catalogos || !productorId} aria-busy={cargando}>Agregar producto</button>
        {error && <button type="button" className={styles.cancelar} style={{ flex: "0 0 auto", gap: "var(--espacio-inline)" }} onClick={() => { reintentar(); }} disabled={cargando} aria-busy={cargando}><RefreshIcon fontSize="small" />Reintentar carga</button>}
        {productorId > 0 && <DrawerProductor key={productorId} catalogos={catalogos} cargando={cargando} productorId={productorId} abierto={abierto} esWeb={esWeb}
            alCerrar={() => setAbierto(false)} alCrear={(texto) => { setAbierto(false); notificar(texto, "success"); }} />}
    </main>;
}

export function DrawerAltaPublicacionProductor({ productorId, disponibilidadInicial = true, abierto, alCerrar, alCrear }: PropsDrawer) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const { catalogos, error, cargando, reintentar } = useCatalogosPublicacion();

    return <DrawerProductor key={productorId} catalogos={catalogos} cargando={cargando} errorCarga={error} alReintentarCarga={reintentar} productorId={productorId} disponibilidadInicial={disponibilidadInicial} abierto={abierto} esWeb={esWeb} alCerrar={alCerrar} alCrear={alCrear} />;
}

function DrawerProductor({ catalogos, cargando, errorCarga = "", alReintentarCarga, productorId, disponibilidadInicial = true, abierto, esWeb, alCerrar, alCrear }: {
    catalogos: Catalogos | null; cargando: boolean; errorCarga?: string; alReintentarCarga?: () => void; productorId: number; disponibilidadInicial?: boolean; abierto: boolean; esWeb: boolean; alCerrar: () => void; alCrear: (mensaje: string) => void;
}) {
    const { notificar } = useNotificacionToast();
    const [datos, setDatos] = useState<Formulario>(() => formularioInicial(productorId, disponibilidadInicial));
    const [errores, setErrores] = useState<string[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [leyendoFoto, setLeyendoFoto] = useState(false);
    const fotoInput = useRef<HTMLInputElement>(null);
    const galeriaInput = useRef<HTMLInputElement>(null);
    const [reinicioUbicaciones, setReinicioUbicaciones] = useState(0);
    const variedades = catalogos?.variedades.filter((item) => item.especieId === datos.especieId) ?? [];
    const categorias = catalogos?.categorias.filter((item) => item.especieId === null || item.especieId === datos.especieId) ?? [];
    const deshabilitado = cargando || guardando || !catalogos;

    useEffect(() => {
        if (abierto && errorCarga && !cargando) notificar(errorCarga, "error");
    }, [abierto, errorCarga, cargando, notificar]);
    const cambiar = (cambio: Partial<Formulario>) => { setDatos((actual) => ({ ...actual, ...cambio })); setErrores([]); };
    function limpiarFormulario() {
        setDatos(formularioInicial(productorId, disponibilidadInicial));
        setErrores([]);
        setReinicioUbicaciones((actual) => actual + 1);
        if (fotoInput.current) fotoInput.current.value = "";
        if (galeriaInput.current) galeriaInput.current.value = "";
    }
    function cancelar() {
        limpiarFormulario();
        alCerrar();
    }
    async function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0]; if (!archivo) return;
        if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setErrores(["La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB."]); return;
        }
        setLeyendoFoto(true);
        try {
            const fotografia = await new Promise<string>((resolver, rechazar) => { const lector = new FileReader(); lector.onload = () => resolver(String(lector.result)); lector.onerror = () => rechazar(new Error("No se pudo leer la fotografía.")); lector.readAsDataURL(archivo); });
            cambiar({ fotografia });
        } catch { setErrores(["No se pudo leer la fotografía."]); } finally { setLeyendoFoto(false); }
    }
    async function enviar(evento: FormEvent) {
        evento.preventDefault(); if (deshabilitado || leyendoFoto) return; setErrores([]);
        if (!precioPublicacionValido(datos.precio)) {
            setErrores([PRECIO_PUBLICACION_INVALIDO]);
            return;
        }
        const validacionUbicaciones = validarUbicacionesProductor(datos.ubicaciones);
        if (!validacionUbicaciones.esValido) {
            setErrores([validacionUbicaciones.error]);
            return;
        }
        setGuardando(true);
        try {
            const { cantidad, ...datosSinCantidad } = datos;
            const datosParaGuardar = {
                ...datosSinCantidad,
                variedadId: datos.variedadId || null,
                envaseId: datos.envaseId || null,
                kilosId: datos.kilosId || null,
                categoriaId: datos.categoriaId || null,
                calibreId: datos.calibreId || null,
                paisId: datos.paisId || null,
                ubicaciones: validacionUbicaciones.ubicaciones,
                precio: normalizarPrecioPublicacion(datos.precio),
                cantidadUnidades: cantidad === "" ? null : Number(cantidad),
                fechaVigencia: datos.fechaVigencia || null, 
            };
            const respuesta = await fetchConSesion("/api/publicaciones/productor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datosParaGuardar) });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                const mensajes = resultado.errores ?? ["No se pudo guardar la publicación."];
                if (respuesta.status === 400 || respuesta.status === 422) setErrores(mensajes);
                else notificar(mensajes.join(" "), "error");
                return;
            }
            limpiarFormulario();
            alCrear(resultado.mensaje ?? "Publicación creada correctamente.");
        } catch { notificar("No se pudo conectar con el servidor.", "error"); } finally { setGuardando(false); }
    }
    return <><DrawerDeslizable anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={() => { if (!guardando) alCerrar(); }} arrastreDeshabilitado={guardando}
        slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-label": "Nueva publicación de Productor" } }}>
        <header className={styles.encabezado}><h2 className={styles.titulo}>Nueva publicación</h2><button className={styles.cerrar} type="button" onClick={alCerrar} disabled={guardando} aria-label="Cerrar alta"><CloseIcon fontSize="small" /></button></header>
        <form className={styles.formulario} onSubmit={enviar} aria-busy={cargando}><div className={styles.cuerpo}>
            {errorCarga && alReintentarCarga && <button type="button" className={styles.cancelar} style={{ flex: "0 0 auto", gap: "var(--espacio-inline)" }} onClick={() => { alReintentarCarga(); }} disabled={cargando} aria-busy={cargando}><RefreshIcon fontSize="small" />Reintentar carga</button>}
            <div className={styles.datosProducto}>
                <Campo nombre="Especie" valor={datos.especieId} opciones={catalogos?.especies ?? []} cambiar={(id) => cambiar({ especieId: id, variedadId: 0, categoriaId: 0 })} deshabilitado={deshabilitado} />
                <Campo nombre="Variedad" valor={datos.variedadId} opciones={variedades} cambiar={(id) => cambiar({ variedadId: id })} deshabilitado={deshabilitado || !datos.especieId} />
                <Campo nombre="Empaquetado" valor={datos.envaseId} opciones={catalogos?.envases ?? []} cambiar={(id) => cambiar({ envaseId: id })} deshabilitado={deshabilitado} />
                <Campo nombre="Kilos del empaquetado" valor={datos.kilosId} opciones={(catalogos?.kilos ?? []).map((opcion) => ({ ...opcion, nombre: `${opcion.nombre} kg` }))} cambiar={(id) => cambiar({ kilosId: id })} deshabilitado={deshabilitado} />
                <Campo nombre="País de origen" valor={datos.paisId} opciones={catalogos?.paises ?? []} cambiar={(id) => cambiar({ paisId: id })} deshabilitado={deshabilitado} />
                <Campo nombre="Categoría" valor={datos.categoriaId} opciones={categorias} cambiar={(id) => cambiar({ categoriaId: id })} deshabilitado={deshabilitado || !datos.especieId} />
                <Campo nombre="Calibre" valor={datos.calibreId} opciones={catalogos?.calibres ?? []} cambiar={(id) => cambiar({ calibreId: id })} deshabilitado={deshabilitado} />
            </div>
            {abierto && <UbicacionesEdicionProductor key={reinicioUbicaciones} ubicaciones={datos.ubicaciones} deshabilitado={deshabilitado} alCambiar={(ubicaciones) => cambiar({ ubicaciones })} />}
            <div className="grid grid-cols-1 gap-[var(--espacio-controles)] sm:grid-cols-2">
                <div className={styles.campo}><label className={styles.etiqueta} htmlFor="productor-precio">Precio en pesos</label><OutlinedInput color="secondary" className={styles.entrada} size="small" id="productor-precio" slotProps={{ input: { inputMode: "numeric", maxLength: MAXIMO_DIGITOS_PRECIO } }} placeholder="Ingrese precio aqui" value={datos.precio} onChange={(evento) => esEntradaPrecioPublicacion(evento.target.value) && cambiar({ precio: evento.target.value })} disabled={deshabilitado} /><small className={styles.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small></div>
                <div className={styles.campo}><label className={styles.etiqueta} htmlFor="productor-cantidad">Unidades{datos.envaseId ? ` (${catalogos?.envases.find((opcion) => opcion.id === datos.envaseId)?.nombre ?? "-"})` : ""}</label><OutlinedInput color="secondary" className={styles.entrada} size="small" id="productor-cantidad" slotProps={{ input: { inputMode: "numeric", maxLength: 10 } }} placeholder="Ingrese cantidad aqui" value={datos.cantidad} onChange={(evento) => /^\d{0,10}$/.test(evento.target.value) && cambiar({ cantidad: evento.target.value })} disabled={deshabilitado} /><small className={styles.ayuda}>Dejalo vacío si no querés ingresar una cantidad.</small></div>
                <div className={styles.campo}>
                    <label className={styles.etiqueta} htmlFor="productor-fechaVigencia">
                        Fecha de vigencia
                    </label>
                    <OutlinedInput
                        color="secondary"
                        className={styles.entrada}
                        size="small"
                        id="productor-fechaVigencia"
                        type="date"
                        value={datos.fechaVigencia}
                        onChange={(evento) => cambiar({ fechaVigencia: evento.target.value })}
                        disabled={deshabilitado}
                    />
                    <small className={styles.ayuda}>Dejalo vacío si no querés ingresar una fecha de vigencia.</small>
                </div>
                <CampoComentario
                    id="productor-comentario"
                    valor={datos.comentario}
                    alCambiar={(comentario) => cambiar({ comentario })}
                    deshabilitado={deshabilitado}
                    clases={{ campo: styles.campo, etiqueta: styles.etiqueta, entrada: styles.entrada, ayuda: styles.ayuda }}
                />
            </div>
            <label className={styles.disponibilidad} htmlFor="productor-disponibilidad" data-disponible={datos.disponibilidad}><span className={styles.textoDisponibilidad}><span className={styles.etiqueta}>Disponibilidad</span><span className={styles.estadoDisponibilidad}>{datos.disponibilidad ? "Disponible" : "No disponible"}</span></span><Switch checked={datos.disponibilidad} onChange={(_, valor) => cambiar({ disponibilidad: valor })} disabled={deshabilitado} slotProps={{ input: { id: "productor-disponibilidad", role: "switch", "aria-label": "Publicación disponible" } }} /></label>
            <div className={styles.seccionFoto}><div className={styles.marcoFoto}>{datos.fotografia ? <Image className={styles.imagenFoto} src={datos.fotografia} alt="Vista previa de la fotografía" fill unoptimized /> : <div className={styles.sinFoto}><PhotoCameraOutlinedIcon /><span>Sin foto</span></div>}{datos.fotografia && <button type="button" className={`${styles.botonFoto} ${styles.borrarFoto}`} onClick={() => cambiar({ fotografia: "" })} disabled={deshabilitado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                <button type="button" className={styles.botonFoto} onClick={() => fotoInput.current?.click()} disabled={deshabilitado}>{esWeb ? "Editar foto" : "Cámara"}</button>
                {!esWeb && <button type="button" className={`${styles.botonFoto} ${styles.botonGaleria}`} onClick={() => galeriaInput.current?.click()} disabled={deshabilitado}>Galería</button>}
                <input ref={fotoInput} className={styles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={deshabilitado} aria-label="Fotografía" />
                {!esWeb && <input ref={galeriaInput} className={styles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFoto} disabled={deshabilitado} aria-label="Fotografía desde galería" />}
            </div></div>
            {errores.length > 0 && <div role="alert" className={styles.error}>{errores.map((error) => <p key={error}>{error}</p>)}</div>}
        </div><div className={styles.pie}><button className={styles.cancelar} type="button" onClick={cancelar} disabled={guardando}>Cancelar</button><button className={styles.guardar} type="submit" disabled={deshabilitado || leyendoFoto}>{guardando ? "Guardando..." : "Confirmar"}</button></div></form>
    </DrawerDeslizable></>;
}
