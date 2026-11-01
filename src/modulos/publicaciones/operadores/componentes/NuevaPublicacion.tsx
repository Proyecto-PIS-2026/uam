"use client";

import { fetchConSesion } from "@/modulos/identidad-acceso/autenticacion/cliente-sesion";

import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNotificacionToast } from "@/compartido/componentes/NotificacionToast";
import DrawerDeslizable from "@/compartido/componentes/DrawerDeslizable";
import MenuItem from "@mui/material/MenuItem";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import OutlinedInput from "@mui/material/OutlinedInput";
import useMediaQuery from "@mui/material/useMediaQuery";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import Image from "next/image";
import { compararPaisesPorPrioridad } from "@/compartido/prioridad-paises";
import { compararEspeciesPorPrioridad } from "@/compartido/prioridad-especies";
import type { DatosAltaPublicacionOperador } from "../../validarAltaPublicacionOperador";
import { ordenarOpcionesPorNombre } from "../ordenar-opciones";
import { AYUDA_PRECIO_PUBLICACION, MAXIMO_DIGITOS_PRECIO, MAXIMO_PRECIO_PUBLICACION, PRECIO_PUBLICACION_INVALIDO, esEntradaPrecioPublicacion, normalizarPrecioPublicacion, precioPublicacionValido } from "../../precio-publicacion";
import drawerStyles from "./DrawerEditarPublicacion.module.css";

type Opcion = { id: number; nombre: string };
type OpcionRelacionada = Opcion & { especieId?: number | null; variedadId?: number };
type Catalogos = {
    especies: Opcion[];
    variedades: OpcionRelacionada[];
    presentaciones: OpcionRelacionada[];
    categorias: OpcionRelacionada[];
    calibres: Opcion[];
    paises: Opcion[];
};
type Formulario = Omit<DatosAltaPublicacionOperador, "precio" | "cantidadUnidades" | "fotografia" | "variedadId" | "presentacionId" | "categoriaId" | "calibreId" | "paisId"> & { precio: string; cantidadUnidades: string; fotografia: string; variedadId: number; presentacionId: number; categoriaId: number; calibreId: number; paisId: number };
type NuevaPublicacionProps = {
    operadorId: number;
    incrementoPrecio?: number;
    disponibilidadInicial?: boolean;
    abierto: boolean;
    alCerrar: () => void;
    alCrear: (mensaje: string) => void;
};

function CampoSelect({ nombre, valor, opciones, cambiar, deshabilitado = false }: {
    nombre: string;
    valor: number;
    opciones: Opcion[];
    cambiar: (id: number) => void;
    deshabilitado?: boolean;
}) {
    return (
        <TextField select label={nombre} value={valor || ""} onChange={(evento) => cambiar(Number(evento.target.value))} size="small" fullWidth required={nombre === "Especie"} disabled={deshabilitado} className={drawerStyles.selectMui}
            slotProps={{ select: { MenuProps: { slotProps: { paper: { sx: { maxHeight: "min(20rem, 50dvh)", overflowY: "auto" } } } } } }}>
            <MenuItem value="" disabled={nombre === "Especie"} className={drawerStyles.opcionSelect}>{nombre === "Especie" ? "Seleccioná especie" : "Sin especificar"}</MenuItem>
            {opciones.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={drawerStyles.opcionSelect}>{opcion.nombre}</MenuItem>)}
        </TextField>
    );
}

export default function NuevaPublicacion({ operadorId, incrementoPrecio = 10, disponibilidadInicial = true, abierto, alCerrar, alCrear }: NuevaPublicacionProps) {
    const { notificar } = useNotificacionToast();
    const esWeb = useMediaQuery("(min-width: 768px)");
    const [catalogos, setCatalogos] = useState<Catalogos | null>(null);
    const [datos, setDatos] = useState<Formulario>({
        operadorId,
        especieId: 0,
        variedadId: 0,
        presentacionId: 0,
        calibreId: 0,
        categoriaId: 0,
        paisId: 0,
        disponibilidad: disponibilidadInicial,
        precio: "",
        cantidadUnidades: "",
        fotografia: "",
    });
    const [errores, setErrores] = useState<string[]>([]);
    const [errorCarga, setErrorCarga] = useState("");
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [leyendoFoto, setLeyendoFoto] = useState(false);
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const inputGaleriaRef = useRef<HTMLInputElement>(null);
    const lecturaFotoRef = useRef(0);

    useEffect(() => {
        let activo = true;
        fetchConSesion("/api/publicaciones")
            .then(async (respuesta) => {
                if (!respuesta.ok) throw new Error("No se pudieron cargar los datos del formulario.");
                return respuesta.json() as Promise<Catalogos>;
            })
            .then((resultado) => {
                if (!activo) return;
                setCatalogos({
                    especies: [...resultado.especies].sort((primera, segunda) => compararEspeciesPorPrioridad(primera.nombre, segunda.nombre)),
                    variedades: ordenarOpcionesPorNombre(resultado.variedades),
                    presentaciones: ordenarOpcionesPorNombre(resultado.presentaciones),
                    categorias: ordenarOpcionesPorNombre(resultado.categorias),
                    calibres: ordenarOpcionesPorNombre(resultado.calibres),
                    paises: [...resultado.paises].sort((primero, segundo) => compararPaisesPorPrioridad(primero.nombre, segundo.nombre)),
                });
            })
            .catch(() => { if (activo) setErrorCarga("No se pudieron cargar los datos del formulario."); })
            .finally(() => { if (activo) setCargando(false); });
        return () => { activo = false; };
    }, []);

    useEffect(() => {
        if (abierto && errorCarga) notificar(errorCarga, "error");
    }, [abierto, errorCarga, notificar]);

    function actualizar(cambio: Partial<Formulario>) {
        setDatos((actuales) => ({ ...actuales, ...cambio }));
        setErrores([]);
    }

    function cambiarPrecio(cantidad: number) {
        const precioActual = Number(datos.precio || "0");
        if (!Number.isInteger(precioActual)) return;
        const nuevoPrecio = Math.min(MAXIMO_PRECIO_PUBLICACION, precioActual + cantidad);
        actualizar({ precio: nuevoPrecio <= 0 ? "" : String(nuevoPrecio) });
    }

    async function seleccionarFotografia(evento: ChangeEvent<HTMLInputElement>) {
        const archivo = evento.target.files?.[0];
        if (!archivo) return;
        const lecturaActual = ++lecturaFotoRef.current;
        if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type) || archivo.size === 0 || archivo.size > 10 * 1024 * 1024) {
            setLeyendoFoto(false);
            setErrores(["La fotografía debe ser PNG, JPEG o WebP y pesar hasta 10 MB."]);
            evento.target.value = "";
            return;
        }
        setLeyendoFoto(true);
        try {
            const fotografia = await new Promise<string>((resolver, rechazar) => {
                const lector = new FileReader();
                lector.onload = () => resolver(String(lector.result));
                lector.onerror = () => rechazar(new Error("No se pudo leer la fotografía."));
                lector.readAsDataURL(archivo);
            });
            if (lecturaActual !== lecturaFotoRef.current) return;
            actualizar({ fotografia });
        } catch {
            if (lecturaActual === lecturaFotoRef.current) setErrores(["No se pudo leer la fotografía."]);
        } finally {
            if (lecturaActual === lecturaFotoRef.current) setLeyendoFoto(false);
        }
    }

    function borrarFotografia() {
        lecturaFotoRef.current += 1;
        setLeyendoFoto(false);
        actualizar({ fotografia: "" });
        if (inputFotoRef.current) inputFotoRef.current.value = "";
        if (inputGaleriaRef.current) inputGaleriaRef.current.value = "";
    }

    async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (deshabilitado || leyendoFoto) return;
        setErrores([]);
        if (!precioPublicacionValido(datos.precio)) {
            setErrores([PRECIO_PUBLICACION_INVALIDO]);
            return;
        }
        setGuardando(true);
        try {
            const datosProcesados = {
                ...datos,
                variedadId: datos.variedadId || null,
                presentacionId: datos.presentacionId || null,
                categoriaId: datos.categoriaId || null,
                calibreId: datos.calibreId || null,
                paisId: datos.paisId || null,
                precio: normalizarPrecioPublicacion(datos.precio),
                cantidadUnidades: datos.cantidadUnidades.trim() !== ""
                    ? parseInt(datos.cantidadUnidades, 10)
                    : null
            };
            const respuesta = await fetchConSesion("/api/publicaciones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datosProcesados),
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                const mensajes = resultado.errores ?? ["No se pudo guardar la publicación."];
                if (respuesta.status === 400 || respuesta.status === 422) setErrores(mensajes);
                else notificar(mensajes.join(" "), "error");
                return;
            }
            alCrear(resultado.mensaje ?? "Publicación creada correctamente.");
        } catch {
            notificar("No se pudo conectar con el servidor.", "error");
        } finally {
            setGuardando(false);
        }
    }

    const variedades = catalogos?.variedades.filter((item) => item.especieId === datos.especieId) ?? [];
    const presentaciones = catalogos?.presentaciones.filter((item) => item.variedadId === datos.variedadId) ?? [];
    const categorias = catalogos?.categorias.filter((item) => item.especieId === null || item.especieId === datos.especieId) ?? [];
    const deshabilitado = cargando || guardando || !catalogos;

    return (
        <>
        <DrawerDeslizable anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={() => { if (!guardando) alCerrar(); }} arrastreDeshabilitado={guardando} slotProps={{ paper: { className: drawerStyles.panel, role: "dialog", "aria-modal": true, "aria-labelledby": "titulo-nueva-publicacion" } }}>
            <header className={drawerStyles.encabezado}>
                <h1 id="titulo-nueva-publicacion" className={drawerStyles.titulo}>Nueva publicación</h1>
                <button className={drawerStyles.cerrar} type="button" onClick={alCerrar} disabled={guardando} aria-label="Cerrar alta">
                    <CloseIcon fontSize="small" />
                </button>
            </header>

            <form className={drawerStyles.formulario} onSubmit={enviarFormulario} aria-busy={cargando}>
                <div className={drawerStyles.cuerpo}>
                    <div className={drawerStyles.datosProducto}>
                        <div className={drawerStyles.campo}>
                            <CampoSelect nombre="Especie" valor={datos.especieId} opciones={catalogos?.especies ?? []} cambiar={(especieId) => actualizar({ especieId, variedadId: 0, presentacionId: 0, categoriaId: 0 })} deshabilitado={deshabilitado} />
                        </div>
                        <div className={drawerStyles.campo}>
                            <CampoSelect nombre="Variedad" valor={datos.variedadId} opciones={variedades} cambiar={(variedadId) => actualizar({ variedadId, presentacionId: 0 })} deshabilitado={deshabilitado || !datos.especieId} />
                        </div>
                        <div className={drawerStyles.campo}>
                            <CampoSelect nombre="Presentación" valor={datos.presentacionId} opciones={presentaciones} cambiar={(presentacionId) => actualizar({ presentacionId })} deshabilitado={deshabilitado || !datos.variedadId} />
                        </div>
                        <div className={drawerStyles.campo}>
                            <CampoSelect nombre="País de origen" valor={datos.paisId} opciones={catalogos?.paises ?? []} cambiar={(paisId) => actualizar({ paisId })} deshabilitado={deshabilitado} />
                        </div>
                        <div className={drawerStyles.campo}>
                            <CampoSelect nombre="Categoría" valor={datos.categoriaId} opciones={categorias} cambiar={(categoriaId) => actualizar({ categoriaId })} deshabilitado={deshabilitado || !datos.especieId} />
                        </div>
                        <div className={drawerStyles.campo}>
                            <CampoSelect nombre="Calibre" valor={datos.calibreId} opciones={catalogos?.calibres ?? []} cambiar={(calibreId) => actualizar({ calibreId })} deshabilitado={deshabilitado} />
                        </div>
                    </div>

                    <div className={drawerStyles.campo}>
                        <label className={drawerStyles.etiqueta} htmlFor="nueva-publicacion-precio">Precio en pesos</label>
                        <div className={drawerStyles.controlesPrecio}>
                            <button className={drawerStyles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-incrementoPrecio)} disabled={deshabilitado} aria-label={`Disminuir precio en ${incrementoPrecio}`}><RemoveIcon aria-hidden="true" fontSize="inherit" /></button>
                            <OutlinedInput color="secondary" className={drawerStyles.entrada} size="small" id="nueva-publicacion-precio" type="text" slotProps={{ input: { inputMode: "numeric", maxLength: MAXIMO_DIGITOS_PRECIO } }} placeholder="Ingresar precio aquí" value={datos.precio} onChange={(evento) => { if (esEntradaPrecioPublicacion(evento.target.value)) actualizar({ precio: evento.target.value }); }} disabled={deshabilitado} />
                            <button className={drawerStyles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(incrementoPrecio)} disabled={deshabilitado} aria-label={`Aumentar precio en ${incrementoPrecio}`}><AddIcon aria-hidden="true" fontSize="inherit" /></button>
                        </div>
                        <small className={drawerStyles.ayuda}>{AYUDA_PRECIO_PUBLICACION}</small>
                    </div>

                    {(() => {
                        const presentacionSeleccionada = catalogos?.presentaciones.find(p => p.id === datos.presentacionId);
                        const textoPresentacion = presentacionSeleccionada ? ` (${presentacionSeleccionada.nombre})` : "";

                        return (
                            <div className={drawerStyles.campo}>
                                <label className={drawerStyles.etiqueta} htmlFor="nueva-publicacion-cantidadUnidades">
                                    Unidades {textoPresentacion}
                                </label>
                                <div className={drawerStyles.controlesPrecio} data-editando={false}>
                                    <OutlinedInput color="secondary" className={drawerStyles.entrada} size="small" id="nueva-publicacion-cantidadUnidades" type="text" slotProps={{ input: { inputMode: "numeric", maxLength: 10 } }} placeholder="Ingresar cantidad aquí" value={datos.cantidadUnidades}
                                        onChange={(evento) => {
                                            const valorOriginal = evento.target.value;
                                            if (valorOriginal === "") {
                                                actualizar({ cantidadUnidades: "" });
                                                return;
                                            }
                                            if (/\D/.test(valorOriginal)) return;
                                            const valorLimpio = String(Number(valorOriginal));
                                            if (Number(valorLimpio) > 2147483647) return;
                                            actualizar({ cantidadUnidades: valorLimpio });
                                        }} disabled={deshabilitado}
                                    />
                                </div>
                                <small className={drawerStyles.ayuda}>Dejalo vacío si no quieres ingresar una cantidad.</small>
                            </div>
                        );
                    })()}

                    {errores.length > 0 && <div role="alert" className={drawerStyles.error}>{errores.map((error, indice) => <p key={indice}>{error}</p>)}</div>}

                    <label className={drawerStyles.disponibilidad} htmlFor="nueva-publicacion-disponibilidad" data-disponible={datos.disponibilidad} data-guardando={guardando}>
                        <span className={drawerStyles.textoDisponibilidad}>
                            <span className={drawerStyles.etiqueta}>Disponibilidad</span>
                            <span className={drawerStyles.estadoDisponibilidad}>{datos.disponibilidad ? "Disponible" : "No disponible"}</span>
                        </span>
                        <Switch className={drawerStyles.interruptorDisponibilidad} checked={datos.disponibilidad} onChange={(_, seleccionado) => actualizar({ disponibilidad: seleccionado })} disabled={deshabilitado} slotProps={{ input: { id: "nueva-publicacion-disponibilidad", role: "switch", "aria-label": "Publicación disponible" } }} />
                    </label>

                    <div className={drawerStyles.seccionFoto}>
                        <div className={drawerStyles.marcoFoto}>
                            {datos.fotografia ? <Image className={drawerStyles.imagenFoto} src={datos.fotografia} alt="Vista previa de la fotografía" fill sizes="(min-width: 768px) 480px, 100vw" unoptimized /> : <div className={drawerStyles.sinFoto}><PhotoCameraOutlinedIcon aria-hidden="true" /><span>Sin foto</span></div>}
                            {datos.fotografia && <button className={`${drawerStyles.botonFoto} ${drawerStyles.borrarFoto}`} type="button" onClick={borrarFotografia} disabled={deshabilitado}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                            <button className={drawerStyles.botonFoto} type="button" onClick={() => inputFotoRef.current?.click()} disabled={deshabilitado}><PhotoCameraOutlinedIcon fontSize="small" /> {esWeb ? "Editar foto" : "Cámara"}</button>
                            {!esWeb && <button className={`${drawerStyles.botonFoto} ${drawerStyles.botonGaleria}`} type="button" onClick={() => inputGaleriaRef.current?.click()} disabled={deshabilitado}>Galería</button>}
                            <input ref={inputFotoRef} className={drawerStyles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFotografia} disabled={deshabilitado} aria-label="Fotografía" />
                            {!esWeb && <input ref={inputGaleriaRef} className={drawerStyles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" onChange={seleccionarFotografia} disabled={deshabilitado} aria-label="Fotografía desde galería" />}
                        </div>
                    </div>
                </div>
                <div className={drawerStyles.pie}>
                    <button className={drawerStyles.cancelar} type="button" onClick={alCerrar} disabled={guardando}>Cancelar</button>
                    <button className={drawerStyles.guardar} type="submit" disabled={deshabilitado || leyendoFoto}>{guardando ? "Guardando..." : "Confirmar"}</button>
                </div>
            </form>
        </DrawerDeslizable>
        </>
    );
}
