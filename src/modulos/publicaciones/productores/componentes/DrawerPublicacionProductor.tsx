"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import SelectorFecha from "@/compartido/componentes/SelectorFecha";
import Switch from "@mui/material/Switch";
import OutlinedInput from "@mui/material/OutlinedInput";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import HideImageOutlinedIcon from "@mui/icons-material/HideImageOutlined";
import PhotoLibraryOutlinedIcon from "@mui/icons-material/PhotoLibraryOutlined";
import ImagenPublicacion from "../../componentes/ImagenPublicacion";
import { AvisoVigenciaFoto } from "../../componentes/AvisoVigenciaFoto";
import { AvisoVigenciaPublicacion } from "../../componentes/AvisoVigenciaPublicacion";
import { ConfirmModal } from "../../../../compartido/componentes/ConfirmModal";
import UbicacionesEdicionProductor from "./UbicacionesEdicionProductor";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, esEntradaPrecioPublicacion } from "../../precio-publicacion";
import estilosAcciones from "../../componentes/formulario-publicacion/formulario-publicacion.module.css";
import CampoComentario from "../../componentes/CampoComentario";
import FotoPublicacionAmpliada from "../../componentes/FotoPublicacionAmpliada";
import estilosFoto from "../../componentes/FotoPublicacionAmpliada.module.css";

import { useEdicionPublicacionProductor, type ParametrosEdicionProductor } from "../hooks/useEdicionPublicacionProductor";
import CampoCatalogoPublicacion from "../../componentes/formulario-publicacion/CampoCatalogoPublicacion";
import UbicacionesConsultaProductor from "./UbicacionesConsultaProductor";

type Props = ParametrosEdicionProductor & { mostrarAvisoFoto?: boolean };

export default function DrawerPublicacionProductor({ publicacion: recibida, alCerrar, alGuardar, alEliminada, mostrarAvisoFoto = false }: Props) {
    const esWeb = useMediaQuery("(min-width: 768px)");
    const {
        estado, setEstado, vigente, edicion, publicacion,
        borrador, editando, ocupado, cargando, confirmando,
        fotoVisible, tieneFoto, abierto, tituloId, variedad,
        especie, variedades, envases, kilos, categorias,
        nombreEnvase, disponible, fechaFormateada, solicitarCierre, cambiar,
        cambiarEspecie, cambiarVariedad, escribirCantidadUnidades, cancelarEdicion, seleccionarFoto,
        comenzarEdicion, guardar, eliminar, cancelarEliminacion,
    } = useEdicionPublicacionProductor({ publicacion: recibida, alCerrar, alGuardar, alEliminada });
    const panelRef = useRef<HTMLDivElement>(null);
    const contenidoRef = useRef<HTMLDivElement>(null);
    const fotoRef = useRef<HTMLInputElement>(null);
    const galeriaRef = useRef<HTMLInputElement>(null);
    const reemplazoFoto = <div className={estilosAcciones.sinFoto}><HideImageOutlinedIcon aria-hidden="true" /><span>Sin foto disponible</span></div>;

    useEffect(() => {
        if (abierto && contenidoRef.current) contenidoRef.current.scrollTop = 0;
    }, [abierto, estado.id, esWeb]);

    useLayoutEffect(() => {
        if (abierto && document.activeElement === document.body) {
            panelRef.current?.focus({ preventScroll: true });
        }
    }, [abierto, editando, estado.guardando]);

    return <>
        <DrawerDeslizable anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={solicitarCierre} arrastreDeshabilitado={ocupado || confirmando}
            slotProps={{ paper: { ref: panelRef, tabIndex: -1, className: estilosAcciones.panel, role: "dialog", "aria-modal": true, "aria-labelledby": tituloId } }} transitionDuration={{ enter: 400, exit: 400 }} ModalProps={{ keepMounted: true }}>
            {publicacion && especie && <>
                <header className={estilosAcciones.encabezado}>
                    <div className={estilosAcciones.bloqueSuperior}>
                        <h2 className={estilosAcciones.titulo} id={tituloId}>{editando ? "Editar publicación" : "Consulta de publicación"}</h2>
                        <div className={estilosAcciones.informacionDetallada}>
                            <span className={estilosAcciones.nombreInformacion}>Actualización</span>
                            <time dateTime={publicacion.fecha} className={estilosAcciones.valorInformacion}>{fechaFormateada}</time>
                        </div>
                    </div>
                    <button className={estilosAcciones.cerrar} type="button" onClick={solicitarCierre} disabled={ocupado} aria-label={editando ? "Cerrar edición" : "Cerrar consulta"}><CloseIcon fontSize="small" /></button>
                </header>
                <form className={estilosAcciones.formulario} onSubmit={guardar} aria-busy={ocupado || cargando}>
                    <div ref={contenidoRef} className={estilosAcciones.cuerpo}>
                        <div className={estilosAcciones.campo}>
                            <label className={estilosAcciones.etiqueta} htmlFor={`publicacion-productor-${publicacion.id}-precio`}>Precio en pesos</label>
                            <OutlinedInput color="secondary" className={estilosAcciones.entrada} size="small" id={`publicacion-productor-${publicacion.id}-precio`} slotProps={{ input: { inputMode: "numeric", maxLength: MAXIMO_DIGITOS_PRECIO } }}
                                value={borrador?.precio ?? (publicacion.precio === null ? "" : String(Number(publicacion.precio)))} placeholder={editando ? "Ingresar precio aquí" : "Consultar precio"} readOnly={!editando} disabled={!editando || ocupado}
                                onChange={(evento) => esEntradaPrecioPublicacion(evento.target.value) && cambiar({ precio: evento.target.value })} />
                            {editando && <small className={estilosAcciones.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small>}
                        </div>
                        <div className={estilosAcciones.campo}>
                            <label className={estilosAcciones.etiqueta} htmlFor={`publicacion-productor-${publicacion.id}-unidades`}>Unidades{nombreEnvase ? ` (${nombreEnvase})` : ""}</label>
                            <OutlinedInput color="secondary" className={estilosAcciones.entrada} size="small" id={`publicacion-productor-${publicacion.id}-unidades`} slotProps={{ input: { inputMode: "numeric", maxLength: 10 } }}
                                value={borrador?.cantidadUnidades ?? publicacion.cantidadUnidades ?? ""} placeholder={editando ? "Ingresar cantidad aquí" : "-"} readOnly={!editando} disabled={!editando || ocupado}
                                onChange={(evento) => escribirCantidadUnidades(evento.target.value)} />
                        </div>
                        <div className={estilosAcciones.campo}>
                            <label className={estilosAcciones.etiqueta} htmlFor={`publicacion-productor-${publicacion.id}-vigencia`}>
                                Fecha de vigencia
                            </label>
                            <SelectorFecha
                                className={estilosAcciones.entrada}
                                id={`publicacion-productor-${publicacion.id}-vigencia`}
                                labelAccesible="Fecha de vigencia"
                                value={borrador?.fechaVigencia ?? publicacion.fechaVigencia ?? ""}
                                readOnly={!editando}
                                disabled={!editando || ocupado}
                                onChange={(fechaVigencia) => cambiar({ fechaVigencia })}
                            />
                            <AvisoVigenciaPublicacion estado={publicacion.estadoVigencia} fechaVigencia={publicacion.fechaVigencia} />
                        </div>
                        <CampoComentario
                            id={`publicacion-productor-${publicacion.id}-comentario`}
                            valor={borrador?.comentario ?? publicacion.comentario ?? ""}
                            alCambiar={(comentario) => cambiar({ comentario })}
                            editando={editando}
                            deshabilitado={ocupado}
                            clases={{ campo: estilosAcciones.campo, etiqueta: estilosAcciones.etiqueta, entrada: estilosAcciones.entrada, ayuda: estilosAcciones.ayuda }}
                        />
                        <div className={estilosAcciones.seccionFoto}>
                            {mostrarAvisoFoto && <AvisoVigenciaFoto estado={publicacion.estadoFoto} />}
                            <div className={estilosAcciones.marcoFoto}>
                                <ImagenPublicacion key={publicacion.id} src={fotoVisible} alt={editando ? "Vista previa de la fotografía" : `Foto de ${especie.nombreEspecie}`} fill sizes="(min-width: 768px) 480px, 100vw" loading="eager" unoptimized className={estilosAcciones.imagenFoto} reemplazo={reemplazoFoto}
                                    onLoad={() => setEstado((actual) => ({ ...actual, fotoPreparada: true }))} onError={() => setEstado((actual) => ({ ...actual, fotoPreparada: true }))} />
                                {!editando && tieneFoto && <button type="button" className={estilosFoto.ampliarFoto} aria-label={`Ampliar foto de ${especie.nombreEspecie}`} onClick={() => setEstado((actual) => ({ ...actual, fotoAmpliada: true }))} />}
                                {editando && <>
                                    {tieneFoto && <button type="button" className={`${estilosAcciones.botonFoto} ${estilosAcciones.borrarFoto}`} onClick={() => cambiar({ foto: null, archivo: null, vistaPrevia: null })} disabled={ocupado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                                    <button type="button" className={estilosAcciones.botonFoto} onClick={() => fotoRef.current?.click()} disabled={ocupado}><PhotoCameraOutlinedIcon fontSize="small" aria-hidden="true" /> {esWeb ? "Editar foto" : "Cámara"}</button>
                                    {!esWeb && <button type="button" className={`${estilosAcciones.botonFoto} ${estilosAcciones.botonGaleria}`} onClick={() => galeriaRef.current?.click()} disabled={ocupado}><PhotoLibraryOutlinedIcon fontSize="small" aria-hidden="true" /> Galería</button>}
                                    <input ref={fotoRef} className={estilosAcciones.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFoto} disabled={ocupado} aria-label="Fotografía" />
                                    {!esWeb && <input ref={galeriaRef} className={estilosAcciones.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFoto} disabled={ocupado} aria-label="Fotografía desde galería" />}
                                </>}
                            </div>
                        </div>
                        <div className={estilosAcciones.accionesPublicacion} data-editando={editando}>
                            <label className={estilosAcciones.disponibilidad} htmlFor={editando ? `publicacion-productor-${publicacion.id}-disponibilidad` : undefined} data-disponible={disponible} data-guardando={ocupado} data-editando={editando}>
                                {editando ? <>
                                    <span className={estilosAcciones.textoDisponibilidad}><span className={estilosAcciones.etiqueta}>Disponibilidad</span><span className={estilosAcciones.estadoDisponibilidad}>{disponible ? "Disponible" : "No disponible"}</span></span>
                                    <Switch className={estilosAcciones.interruptorDisponibilidad} checked={Boolean(disponible)} onChange={(_, valor) => cambiar({ disponible: valor })} disabled={ocupado} slotProps={{ input: { id: `publicacion-productor-${publicacion.id}-disponibilidad`, role: "switch", "aria-label": "Publicación disponible" } }} />
                                </> : <span className={`${estilosAcciones.estadoDisponibilidad} ${estilosAcciones.estadoDisponibilidadConsulta}`}>{disponible ? "Disponible" : "No disponible"}</span>}
                            </label>
                        </div>
                        <div className={estilosAcciones.datosProducto} data-editando={editando}>
                            <CampoCatalogoPublicacion nombre="Especie" valor={borrador?.especieId ?? especie.id} opciones={edicion?.opciones.especies ?? []} nombreActual={especie.nombreEspecie} cambiar={cambiarEspecie} deshabilitado={!editando || ocupado} enConsulta={!editando} priorizarEspecies />
                            <CampoCatalogoPublicacion nombre="Variedad" valor={borrador?.variedadId ?? variedad?.id ?? 0} opciones={variedades} nombreActual={variedad?.nombreVariedad ?? ""} cambiar={cambiarVariedad} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <CampoCatalogoPublicacion nombre="Empaquetado" valor={borrador?.envaseId ?? publicacion.envase?.id ?? 0} opciones={envases} nombreActual={publicacion.envase?.nombreEnvase ?? ""} cambiar={(id) => cambiar({ envaseId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <CampoCatalogoPublicacion nombre="Kilos del empaquetado" valor={borrador?.kilosId ?? publicacion.kilos?.id ?? 0} opciones={kilos.map((opcion) => ({ ...opcion, nombre: `${opcion.nombre} kg` }))} nombreActual={publicacion.kilos?.valor ? `${publicacion.kilos.valor} kg` : ""} cambiar={(id) => cambiar({ kilosId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <CampoCatalogoPublicacion nombre="País de origen" valor={borrador?.paisId ?? publicacion.paisId ?? 0} opciones={edicion?.opciones.paises ?? []} nombreActual={publicacion.pais || ""} cambiar={(id) => cambiar({ paisId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} priorizarUruguay />
                            <CampoCatalogoPublicacion nombre="Categoría" valor={borrador?.categoriaId ?? publicacion.categoria?.id ?? 0} opciones={categorias} nombreActual={publicacion.categoria?.nombreCategoria ?? ""} cambiar={(id) => cambiar({ categoriaId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                            <CampoCatalogoPublicacion nombre="Calibre" valor={borrador?.calibreId ?? publicacion.calibre?.id ?? 0} opciones={edicion?.opciones.calibres ?? []} nombreActual={publicacion.calibre?.nombreCalibre ?? ""} cambiar={(id) => cambiar({ calibreId: id })} deshabilitado={!editando || ocupado} enConsulta={!editando} />
                        </div>
                        {borrador ? <UbicacionesEdicionProductor ubicaciones={borrador.ubicaciones} deshabilitado={ocupado} alCambiar={(ubicaciones) => cambiar({ ubicaciones })} /> : <UbicacionesConsultaProductor publicacion={publicacion} />}
                    </div>
                    <div className={estilosAcciones.pie} data-acciones-modal>
                        {editando ? <>
                            <button className={estilosAcciones.cancelar} type="button" onClick={cancelarEdicion} disabled={ocupado}>Cancelar</button>
                            <button className={estilosAcciones.guardar} type="submit" disabled={ocupado}>{estado.guardando ? "Guardando..." : "Confirmar"}</button>
                        </> : <>
                            <button className={`${estilosAcciones.cancelar} ${estilosAcciones.eliminar}`} type="button" disabled={ocupado || cargando} onClick={() => { setEstado((actual) => ({ ...actual, confirmacionPara: vigente })); }}>Eliminar</button>
                            <button className={estilosAcciones.guardar} type="button" disabled={cargando || ocupado || confirmando} onClick={comenzarEdicion}>Editar</button>
                        </>}
                    </div>
                </form>
                <ConfirmModal abierto={confirmando} titulo="Eliminar publicación" descripcion={`¿Querés eliminar la publicación de ${especie.nombreEspecie}? Esta acción no se puede deshacer.`} textoConfirmar="Sí, eliminar" procesando={estado.eliminando} alCancelar={cancelarEliminacion} alConfirmar={() => void eliminar()} />
                <FotoPublicacionAmpliada abierta={abierto && !editando && estado.fotoAmpliada && tieneFoto} alCerrar={() => setEstado((actual) => ({ ...actual, fotoAmpliada: false }))} src={fotoVisible} nombre={especie.nombreEspecie} reemplazo={reemplazoFoto} />
            </>}
        </DrawerDeslizable>
    </>;
}
