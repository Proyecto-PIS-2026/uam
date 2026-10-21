"use client";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import Drawer from "@mui/material/Drawer";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import type { OpcionesEdicionPublicacion } from "../../operadores/consultas-edicion-publicacion";
import { ordenarOpcionesPorNombre } from "../../operadores/ordenar-opciones";
import UbicacionesEdicionProductor, { type UbicacionEdicionProductor } from "../../productores/UbicacionesEdicionProductor";
import type { PublicacionMiMercadoProductor } from "../consultas-mi-mercado-productor";
import styles from "../../operadores/componentes/DrawerEditarPublicacion.module.css";

type Props = {
    publicacion: PublicacionMiMercadoProductor;
    opciones: OpcionesEdicionPublicacion;
    alCerrar: () => void;
    alGuardar: (publicacion: PublicacionMiMercadoProductor) => void;
};

type Borrador = {
    precio: string;
    presentacionId: number;
    categoriaId: number;
    calibreId: number;
    foto: string | null;
    archivo: File | null;
    vistaPrevia: string | null;
    ubicaciones: UbicacionEdicionProductor[];
};

type Opcion = { id: number; nombre: string };

function Campo({ nombre, valor, opciones, nombreActual, cambiar, deshabilitado = false }: {
    nombre: string;
    valor: number;
    opciones: Opcion[];
    nombreActual: string;
    cambiar?: (id: number) => void;
    deshabilitado?: boolean;
}) {
    return <TextField select label={nombre} value={valor} onChange={(evento) => cambiar?.(Number(evento.target.value))}
        size="small" fullWidth required disabled={deshabilitado} className={styles.selectMui}
        slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } }}>
        {!opciones.some((opcion) => opcion.id === valor) && <MenuItem value={valor} disabled>{nombreActual}</MenuItem>}
        {ordenarOpcionesPorNombre(opciones).map((opcion) => <MenuItem key={opcion.id} value={opcion.id}>{opcion.nombre}</MenuItem>)}
    </TextField>;
}

export default function DrawerEditarPublicacionProductor({ publicacion, opciones, alCerrar, alGuardar }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [borrador, setBorrador] = useState<Borrador>(() => ({
        precio: publicacion.precio === null ? "" : String(Number(publicacion.precio)),
        presentacionId: publicacion.presentacion.id,
        categoriaId: publicacion.categoria.id,
        calibreId: publicacion.calibre.id,
        foto: publicacion.foto,
        archivo: null,
        vistaPrevia: null,
        ubicaciones: publicacion.ubicaciones.map(({ id, nombreUbicacion, urlMaps }) => ({ clave: id, nombreUbicacion, urlMaps })),
    }));
    const [guardando, setGuardando] = useState(false);
    const [errores, setErrores] = useState<string[]>([]);
    const guardandoRef = useRef(false);
    const montadoRef = useRef(true);
    const fotoRef = useRef<HTMLInputElement>(null);
    const galeriaRef = useRef<HTMLInputElement>(null);
    const variedad = publicacion.presentacion.variedad;
    const especie = variedad.especie;
    const presentaciones = opciones.presentaciones.filter((opcion) => opcion.variedadId === variedad.id);
    const categorias = opciones.categorias.filter((opcion) => opcion.especieId === null || opcion.especieId === especie.id);
    const fotoVisible = borrador.vistaPrevia ?? borrador.foto;
    const nombrePresentacion = presentaciones.find((opcion) => opcion.id === borrador.presentacionId)?.nombre ?? publicacion.presentacion.nombrePresentacion;
    const sinFoto = <div className={styles.sinFoto}><PhotoCameraOutlinedIcon /><span>Sin foto</span></div>;

    useEffect(() => {
        montadoRef.current = true;
        return () => { montadoRef.current = false; };
    }, []);

    useEffect(() => () => {
        if (borrador.vistaPrevia) URL.revokeObjectURL(borrador.vistaPrevia);
    }, [borrador.vistaPrevia]);

    function cambiar(cambios: Partial<Borrador>) {
        setBorrador((actual) => ({ ...actual, ...cambios }));
        setErrores([]);
    }

    function cerrar() {
        if (!guardandoRef.current) alCerrar();
    }

    function seleccionarFoto(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        evento.target.value = "";
        if (!archivo || guardandoRef.current) return;
        if (!["image/jpeg", "image/png", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setErrores(["Seleccioná una imagen JPEG, PNG o WebP de hasta 10 MB."]);
            return;
        }
        cambiar({ archivo, vistaPrevia: URL.createObjectURL(archivo) });
    }

    async function guardar(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (guardandoRef.current) return;
        if (borrador.precio !== "" && !/^\d{1,10}$/.test(borrador.precio)) {
            setErrores(["El precio debe ser un número entero de hasta 10 dígitos, sin decimales."]);
            return;
        }
        const formulario = new FormData();
        formulario.set("cambios", JSON.stringify({
            precio: borrador.precio === "" ? null : String(Number(borrador.precio)),
            presentacionId: borrador.presentacionId,
            categoriaId: borrador.categoriaId,
            calibreId: borrador.calibreId,
            foto: borrador.foto,
            ubicaciones: borrador.ubicaciones.map(({ nombreUbicacion, urlMaps }) => ({ nombreUbicacion: nombreUbicacion.trim(), urlMaps: urlMaps.trim() })),
        }));
        if (borrador.archivo) formulario.set("foto", borrador.archivo);
        guardandoRef.current = true;
        setGuardando(true);
        setErrores([]);
        try {
            const respuesta = await fetch(`/api/publicaciones/productor/${publicacion.publicacionProductorId}`, { method: "PATCH", body: formulario });
            const resultado = await respuesta.json();
            if (!montadoRef.current) return;
            if (!respuesta.ok) {
                setErrores(resultado.errores ?? ["No se pudieron guardar los cambios."]);
                return;
            }
            alGuardar(resultado.publicacion);
        } catch {
            if (montadoRef.current) setErrores(["No se pudieron guardar los cambios. Intentá nuevamente."]);
        } finally {
            guardandoRef.current = false;
            if (montadoRef.current) setGuardando(false);
        }
    }

    return <Drawer anchor={esWeb ? "right" : "bottom"} open onClose={cerrar}
        slotProps={{ paper: { className: styles.panel, role: "dialog", "aria-modal": true, "aria-label": "Editar publicación de Productor" } }}>
        <div className={styles.asa} aria-hidden="true" />
        <header className={styles.encabezado}>
            <h2 className={styles.titulo}>Editar publicación</h2>
            <button className={styles.cerrar} type="button" onClick={cerrar} disabled={guardando} aria-label="Cerrar edición"><CloseIcon fontSize="small" /></button>
        </header>
        <form className={styles.formulario} onSubmit={guardar} aria-busy={guardando}>
            <div className={styles.cuerpo}>
                <div className={styles.datosProducto}>
                    <Campo nombre="Especie" valor={especie.id} opciones={[{ id: especie.id, nombre: especie.nombreEspecie }]} nombreActual={especie.nombreEspecie} deshabilitado />
                    <Campo nombre="Variedad" valor={variedad.id} opciones={[{ id: variedad.id, nombre: variedad.nombreVariedad }]} nombreActual={variedad.nombreVariedad} deshabilitado />
                    <Campo nombre="Presentación" valor={borrador.presentacionId} opciones={presentaciones} nombreActual={publicacion.presentacion.nombrePresentacion} cambiar={(id) => cambiar({ presentacionId: id })} deshabilitado={guardando} />
                    <Campo nombre="Categoría" valor={borrador.categoriaId} opciones={categorias} nombreActual={publicacion.categoria.nombreCategoria} cambiar={(id) => cambiar({ categoriaId: id })} deshabilitado={guardando} />
                    <Campo nombre="Calibre" valor={borrador.calibreId} opciones={opciones.calibres} nombreActual={publicacion.calibre.nombreCalibre} cambiar={(id) => cambiar({ calibreId: id })} deshabilitado={guardando} />
                    <Campo nombre="País de origen" valor={publicacion.paisId} opciones={[{ id: publicacion.paisId, nombre: publicacion.pais }]} nombreActual={publicacion.pais} deshabilitado />
                </div>
                <UbicacionesEdicionProductor ubicaciones={borrador.ubicaciones} deshabilitado={guardando} alCambiar={(ubicaciones) => cambiar({ ubicaciones })} />
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <div className={styles.campo}>
                        <label className={styles.etiqueta} htmlFor="edicion-productor-precio">Precio en pesos</label>
                        <input className={styles.entrada} id="edicion-productor-precio" inputMode="numeric" maxLength={10} placeholder="Ingrese precio aquí" value={borrador.precio} onChange={(evento) => /^\d{0,10}$/.test(evento.target.value) && cambiar({ precio: evento.target.value })} disabled={guardando} />
                        <small className={styles.ayuda}>Dejalo vacío si el producto no tiene precio.</small>
                    </div>
                    <div className={styles.campo}>
                        <label className={styles.etiqueta} htmlFor="edicion-productor-cantidad">Cantidad ({nombrePresentacion})</label>
                        <input className={styles.entrada} id="edicion-productor-cantidad" value={publicacion.cantidadUnidades ?? ""} placeholder="Sin cantidad" disabled />
                    </div>
                </div>
                <label className={styles.disponibilidad} htmlFor="edicion-productor-disponibilidad" data-disponible={publicacion.publicacionDisponible} data-editando="false">
                    <span className={styles.textoDisponibilidad}><span className={styles.etiqueta}>Disponibilidad</span><span className={styles.estadoDisponibilidad}>{publicacion.publicacionDisponible ? "Disponible" : "No disponible"}</span></span>
                    <Switch checked={publicacion.publicacionDisponible} disabled slotProps={{ input: { id: "edicion-productor-disponibilidad", role: "switch", "aria-label": "Publicación disponible" } }} />
                </label>
                <div className={styles.seccionFoto}>
                    <div className={styles.marcoFoto}>
                        <ImagenPublicacion key={fotoVisible} src={fotoVisible} alt="Vista previa de la fotografía" fill sizes="(min-width: 768px) 440px, 100vw" unoptimized className={styles.imagenFoto} reemplazo={sinFoto} />
                        {fotoVisible && <button type="button" className={`${styles.botonFoto} ${styles.borrarFoto}`} onClick={() => cambiar({ foto: null, archivo: null, vistaPrevia: null })} disabled={guardando}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                        <button type="button" className={styles.botonFoto} onClick={() => fotoRef.current?.click()} disabled={guardando}>{esWeb ? "Editar foto" : "Cámara"}</button>
                        {!esWeb && <button type="button" className={`${styles.botonFoto} ${styles.botonGaleria}`} onClick={() => galeriaRef.current?.click()} disabled={guardando}>Galería</button>}
                        <input ref={fotoRef} className={styles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={guardando} aria-label="Fotografía" />
                        {!esWeb && <input ref={galeriaRef} className={styles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFoto} disabled={guardando} aria-label="Fotografía desde galería" />}
                    </div>
                </div>
                {errores.length > 0 && <div role="alert" className={styles.error}>{errores.map((error, indice) => <p key={indice}>{error}</p>)}</div>}
            </div>
            <div className={styles.pie}>
                <button className={styles.cancelar} type="button" onClick={cerrar} disabled={guardando}>Cancelar</button>
                <button className={styles.guardar} type="submit" disabled={guardando}>{guardando ? "Guardando..." : "Confirmar"}</button>
            </div>
        </form>
    </Drawer>;
}
