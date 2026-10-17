"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import Drawer from "@mui/material/Drawer";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import Image from "next/image";
import { ordenarOpcionesPorNombre } from "../operadores/ordenar-opciones";
import styles from "../operadores/componentes/DrawerEditarPublicacion.module.css";
import LeafletLocationPicker from "./LeafletLocationPicker";
import type { UbicacionSeleccionada } from "./LeafletLocationPicker";

type Opcion = { id: number; nombre: string };
type Catalogos = {
    especies: Opcion[];
    variedades: (Opcion & { especieId: number })[];
    presentaciones: (Opcion & { variedadId: number })[];
    categorias: (Opcion & { especieId: number | null })[];
    calibres: Opcion[];
    paises: Opcion[];
};
type Formulario = {
    productorId: number; especieId: number; variedadId: number; presentacionId: number; calibreId: number;
    categoriaId: number; paisId: number; latitud: number | null; longitud: number | null; departamento: string | null; nombreLugar: string | null; disponibilidad: boolean;
    precio: string; cantidad: string; fotografia: string;
};

function formularioInicial(productorId: number): Formulario {
    return {
        productorId,
        especieId: 0,
        variedadId: 0,
        presentacionId: 0,
        calibreId: 0,
        categoriaId: 0,
        paisId: 0,
        latitud: null,
        longitud: null,
        departamento: null,
        nombreLugar: null,
        disponibilidad: true,
        precio: "",
        cantidad: "",
        fotografia: "",
    };
}

function opciones<T extends Opcion>(opciones: T[]) {
    return ordenarOpcionesPorNombre(opciones);
}

function Campo({ nombre, valor, opciones: lista, cambiar, deshabilitado = false }: {
    nombre: string; valor: number; opciones: Opcion[]; cambiar: (id: number) => void; deshabilitado?: boolean;
}) {
    return <TextField select label={nombre} value={valor || ""} onChange={(evento) => cambiar(Number(evento.target.value))}
        size="small" fullWidth required disabled={deshabilitado} className={styles.selectMui}
        slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } }}>
        <MenuItem value="" disabled>Seleccioná {nombre.toLowerCase()}</MenuItem>
        {lista.map((opcion) => <MenuItem key={opcion.id} value={opcion.id}>{opcion.nombre}</MenuItem>)}
    </TextField>;
}

export default function AltaPublicacionProductor({ productorId }: { productorId: number }) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
    const [abierto, setAbierto] = useState(false);
    const [errores, setErrores] = useState<string[]>([]);
    const [mensaje, setMensaje] = useState("");

    useEffect(() => {
        fetch("/api/publicaciones/productor").then(async (respuesta) => {
            if (!respuesta.ok) throw new Error("No se pudieron cargar los datos.");
            return respuesta.json() as Promise<Catalogos>;
        }).then((datos) => setCatalogos({
            ...datos,
            especies: opciones(datos.especies),
            variedades: opciones(datos.variedades),
            presentaciones: opciones(datos.presentaciones),
            categorias: opciones(datos.categorias),
            calibres: opciones(datos.calibres),
            paises: opciones(datos.paises),
        })).catch((error) => setErrores([error instanceof Error ? error.message : "No se pudieron cargar los datos."]));
    }, []);

    return <main className="contenedor-pagina flex-1 py-10">
        <h1 className="mb-4 text-3xl font-bold">Alta de publicación de Productor</h1>
        {errores.length > 0 && <div role="alert" className={styles.error}>{errores.map((error) => <p key={error}>{error}</p>)}</div>}
        {!catalogos ? <p role="status">Cargando datos...</p> : <>
            <button type="button" className={styles.guardar} onClick={() => { setErrores([]); setMensaje(""); setAbierto(true); }} disabled={!productorId}>Agregar producto</button>
            {mensaje && <p role="status">{mensaje}</p>}
        </>}
        {catalogos && productorId > 0 && <DrawerProductor key={productorId} catalogos={catalogos} productorId={productorId} abierto={abierto} esWeb={esWeb}
            alCerrar={() => setAbierto(false)} alCrear={(texto) => { setAbierto(false); setMensaje(texto); }} />}
    </main>;
}

function DrawerProductor({ catalogos, productorId, abierto, esWeb, alCerrar, alCrear }: {
    catalogos: Catalogos; productorId: number; abierto: boolean; esWeb: boolean; alCerrar: () => void; alCrear: (mensaje: string) => void;
}) {
    const [datos, setDatos] = useState<Formulario>(() => formularioInicial(productorId));
    const [errores, setErrores] = useState<string[]>([]);
    const [guardando, setGuardando] = useState(false);
    const [leyendoFoto, setLeyendoFoto] = useState(false);
    const [fotoInput, setFotoInput] = useState<HTMLInputElement | null>(null);
    const [mapaAbierto, setMapaAbierto] = useState(false);
    const variedades = catalogos.variedades.filter((item) => item.especieId === datos.especieId);
    const presentaciones = catalogos.presentaciones.filter((item) => item.variedadId === datos.variedadId);
    const categorias = catalogos.categorias.filter((item) => item.especieId === null || item.especieId === datos.especieId);
    const cambiar = (cambio: Partial<Formulario>) => { setDatos((actual) => ({ ...actual, ...cambio })); setErrores([]); };
    function cancelar() {
        setDatos(formularioInicial(productorId));
        setErrores([]);
        setMapaAbierto(false);
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
        evento.preventDefault(); if (guardando || leyendoFoto) return; setErrores([]); setGuardando(true);
        try {
            const { cantidad, ...datosSinCantidad } = datos;
            const datosParaGuardar = {
                ...datosSinCantidad,
                cantidadUnidades: cantidad === "" ? null : Number(cantidad),
            };
            const respuesta = await fetch("/api/publicaciones/productor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(datosParaGuardar) });
            const resultado = await respuesta.json();
            if (!respuesta.ok) { setErrores(resultado.errores ?? ["No se pudo guardar la publicación."]); return; }
            alCrear(resultado.mensaje ?? "Publicación creada correctamente.");
        } catch { setErrores(["No se pudo conectar con el servidor."]); } finally { setGuardando(false); }
    }
    return <Drawer anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={() => { if (!guardando) alCerrar(); }}
        slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-label": "Nueva publicación de Productor" } }}>
        <div className={styles.asa} aria-hidden="true" /><header className={styles.encabezado}><h2 className={styles.titulo}>Nueva publicación</h2><button className={styles.cerrar} type="button" onClick={alCerrar} disabled={guardando} aria-label="Cerrar alta"><CloseIcon fontSize="small" /></button></header>
        <form className={styles.formulario} onSubmit={enviar}><div className={styles.cuerpo}>
            <div className={styles.datosProducto}>
                <Campo nombre="Especie" valor={datos.especieId} opciones={catalogos.especies} cambiar={(id) => cambiar({ especieId: id, variedadId: 0, presentacionId: 0, categoriaId: 0 })} deshabilitado={guardando} />
                <Campo nombre="Variedad" valor={datos.variedadId} opciones={variedades} cambiar={(id) => cambiar({ variedadId: id, presentacionId: 0 })} deshabilitado={guardando || !datos.especieId} />
                <Campo nombre="Presentación" valor={datos.presentacionId} opciones={presentaciones} cambiar={(id) => cambiar({ presentacionId: id })} deshabilitado={guardando || !datos.variedadId} />
                <Campo nombre="Categoría" valor={datos.categoriaId} opciones={categorias} cambiar={(id) => cambiar({ categoriaId: id })} deshabilitado={guardando || !datos.especieId} />
                <Campo nombre="Calibre" valor={datos.calibreId} opciones={catalogos.calibres} cambiar={(id) => cambiar({ calibreId: id })} deshabilitado={guardando} />
                <Campo nombre="País de origen" valor={datos.paisId} opciones={catalogos.paises} cambiar={(id) => cambiar({ paisId: id })} deshabilitado={guardando} />
            </div>
            <div className={styles.campo}>
                <button type="button" className={styles.guardar} onClick={() => setMapaAbierto(true)} disabled={guardando}>
                    {datos.latitud === null || datos.longitud === null ? "Seleccionar ubicación de retiro" : "Cambiar ubicación"}
                </button>
                {datos.departamento && <small className={styles.ayuda}>{datos.nombreLugar ? `${datos.nombreLugar}, ` : ""}{datos.departamento}</small>}
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div className={styles.campo}><label className={styles.etiqueta} htmlFor="productor-precio">Precio en pesos</label><input className={styles.entrada} id="productor-precio" inputMode="numeric" maxLength={10} placeholder="Ingrese precio aqui" value={datos.precio} onChange={(evento) => /^\d{0,10}$/.test(evento.target.value) && cambiar({ precio: evento.target.value })} disabled={guardando} /><small className={styles.ayuda}>Dejalo vacío si el producto no tiene precio.</small></div>
                <div className={styles.campo}><label className={styles.etiqueta} htmlFor="productor-cantidad">Cantidad (kg)</label><input className={styles.entrada} id="productor-cantidad" inputMode="numeric" maxLength={10} placeholder="Ingrese cantidad aqui" value={datos.cantidad} onChange={(evento) => /^\d{0,10}$/.test(evento.target.value) && cambiar({ cantidad: evento.target.value })} disabled={guardando} /><small className={styles.ayuda}>Dejalo vacío si no querés ingresar una cantidad.</small></div>
            </div>
            <label className={styles.disponibilidad} htmlFor="productor-disponibilidad" data-disponible={datos.disponibilidad}><span className={styles.textoDisponibilidad}><span className={styles.etiqueta}>Disponibilidad</span><span className={styles.estadoDisponibilidad}>{datos.disponibilidad ? "Disponible" : "No disponible"}</span></span><Switch checked={datos.disponibilidad} onChange={(_, valor) => cambiar({ disponibilidad: valor })} disabled={guardando} slotProps={{ input: { id: "productor-disponibilidad", role: "switch", "aria-label": "Publicación disponible" } }} /></label>
            <div className={styles.seccionFoto}><div className={styles.marcoFoto}>{datos.fotografia ? <Image className={styles.imagenFoto} src={datos.fotografia} alt="Vista previa de la fotografía" fill unoptimized /> : <div className={styles.sinFoto}><PhotoCameraOutlinedIcon /><span>Sin foto</span></div>}{datos.fotografia && <button type="button" className={`${styles.botonFoto} ${styles.borrarFoto}`} onClick={() => cambiar({ fotografia: "" })} disabled={guardando}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}<button type="button" className={styles.botonFoto} onClick={() => fotoInput?.click()} disabled={guardando}>{esWeb ? "Editar foto" : "Cámara"}</button><input ref={setFotoInput} className={styles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={guardando} aria-label="Fotografía" /></div></div>
            {errores.length > 0 && <div role="alert" className={styles.error}>{errores.map((error) => <p key={error}>{error}</p>)}</div>}
        </div><div className={styles.pie}><button className={styles.cancelar} type="button" onClick={cancelar} disabled={guardando}>Cancelar</button><button className={styles.guardar} type="submit" disabled={guardando || leyendoFoto || datos.latitud === null || datos.longitud === null}>{guardando ? "Guardando..." : "Confirmar"}</button></div></form>
        <LeafletLocationPicker key={`${datos.latitud ?? "sin"}-${datos.longitud ?? "sin"}`} abierto={mapaAbierto} coordenadas={datos.latitud === null || datos.longitud === null || !datos.departamento ? null : { latitud: datos.latitud, longitud: datos.longitud, departamento: datos.departamento, nombreLugar: datos.nombreLugar }}
            alCerrar={() => setMapaAbierto(false)} alConfirmar={(ubicacion: UbicacionSeleccionada) => { cambiar(ubicacion); setMapaAbierto(false); }} />
    </Drawer>;
}
