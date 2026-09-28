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
import Image from "next/image";
// import HojasDecorativas from "../../../../compartido/HojasDecorativas";
import type { DatosAltaPublicacionOperador } from "../../validarAltaPublicacionOperador";
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
type Formulario = Omit<DatosAltaPublicacionOperador, "precio" | "fotografia"> & { precio: string; fotografia: string };
type NuevaPublicacionProps = {
    operadorId: number;
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
        <TextField select label={nombre} value={valor || ""} onChange={(evento) => cambiar(Number(evento.target.value))} size="small" fullWidth required disabled={deshabilitado} className={drawerStyles.selectMui}>
            <MenuItem value="" disabled className={drawerStyles.opcionSelect}>Seleccioná {nombre.toLowerCase()}</MenuItem>
            {opciones.map((opcion) => <MenuItem key={opcion.id} value={opcion.id} className={drawerStyles.opcionSelect}>{opcion.nombre}</MenuItem>)}
        </TextField>
    );
}

export default function NuevaPublicacion({ operadorId, abierto, alCerrar, alCrear }: NuevaPublicacionProps) {
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
        disponibilidad: true,
        precio: "",
        fotografia: "",
    });
    const [errores, setErrores] = useState<string[]>([]);
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const inputFotoRef = useRef<HTMLInputElement>(null);
    const lecturaFotoRef = useRef(0);

    useEffect(() => {
        let activo = true;
        fetch("/api/publicaciones")
            .then(async (respuesta) => {
                if (!respuesta.ok) throw new Error("No se pudieron cargar los datos del formulario.");
                return respuesta.json() as Promise<Catalogos>;
            })
            .then((resultado) => { if (activo) setCatalogos(resultado); })
            .catch(() => { if (activo) setErrores(["No se pudieron cargar los datos del formulario."]); })
            .finally(() => { if (activo) setCargando(false); });
        return () => { activo = false; };
    }, []);

    function actualizar(cambio: Partial<Formulario>) {
        setDatos((actuales) => ({ ...actuales, ...cambio }));
        setErrores([]);
    }

    function cambiarPrecio(cantidad: number) {
        const precioActual = Number(datos.precio || "0");
        if (!Number.isInteger(precioActual)) return;
        const nuevoPrecio = Math.min(9999999999, Math.max(0, precioActual + cantidad));
        actualizar({ precio: String(nuevoPrecio) });
    }

    async function seleccionarFotografia(evento: ChangeEvent<HTMLInputElement>) {
        const lecturaActual = ++lecturaFotoRef.current;
        const archivo = evento.target.files?.[0];
        if (!archivo) { actualizar({ fotografia: "" }); return; }
        if (!["image/png", "image/jpeg", "image/webp"].includes(archivo.type) || archivo.size > 2_000_000) {
            actualizar({ fotografia: "" });
            setErrores(["La fotografía debe ser PNG, JPEG o WebP y pesar menos de 2 MB."]);
            evento.target.value = "";
            return;
        }
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
        }
    }

    function borrarFotografia() {
        lecturaFotoRef.current += 1;
        actualizar({ fotografia: "" });
        if (inputFotoRef.current) inputFotoRef.current.value = "";
    }

    async function enviarFormulario(evento: FormEvent<HTMLFormElement>) {
        evento.preventDefault();
        if (guardando) return;
        setErrores([]);
        setGuardando(true);
        try {
            const respuesta = await fetch("/api/publicaciones", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(datos),
            });
            const resultado = await respuesta.json();
            if (!respuesta.ok) {
                setErrores(resultado.errores ?? ["No se pudo guardar la publicación."]);
                return;
            }
            alCrear(resultado.mensaje ?? "Publicación creada correctamente.");
        } catch {
            setErrores(["No se pudo conectar con el servidor."]);
        } finally {
            setGuardando(false);
        }
    }

    const variedades = catalogos?.variedades.filter((item) => item.especieId === datos.especieId) ?? [];
    const presentaciones = catalogos?.presentaciones.filter((item) => item.variedadId === datos.variedadId) ?? [];
    const categorias = catalogos?.categorias.filter((item) => item.especieId === null || item.especieId === datos.especieId) ?? [];
    const deshabilitado = cargando || guardando || !catalogos;

    return (
        <Drawer anchor={esWeb ? "right" : "bottom"} open={abierto} onClose={() => { if (!guardando) alCerrar(); }} slotProps={{ paper: { className: drawerStyles.panel, role: "dialog", "aria-modal": true, "aria-labelledby": "titulo-nueva-publicacion" } }}>
            {/* <HojasDecorativas variante="fondo" className={drawerStyles.hojasDrawer} /> */}
            <div className={drawerStyles.asa} aria-hidden="true" />
            <header className={drawerStyles.encabezado}>
                <h1 id="titulo-nueva-publicacion" className={drawerStyles.titulo}>Nueva publicación</h1>
                <button className={drawerStyles.cerrar} type="button" onClick={alCerrar} disabled={guardando} aria-label="Cerrar alta">
                    <CloseIcon fontSize="small" />
                </button>
            </header>

            <form className={drawerStyles.formulario} onSubmit={enviarFormulario}>
                <div className={drawerStyles.cuerpo}>
                    {cargando && <p className={drawerStyles.ayuda} role="status">Cargando los datos del formulario...</p>}

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

                    {errores.length > 0 && <div role="alert" className={drawerStyles.error}>{errores.map((error, indice) => <p key={indice}>{error}</p>)}</div>}

                    <div className={drawerStyles.campo}>
                        <label className={drawerStyles.etiqueta} htmlFor="nueva-publicacion-precio">Precio en pesos</label>
                        <div className={drawerStyles.controlesPrecio}>
                            <button className={drawerStyles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(-10)} disabled={guardando} aria-label="Disminuir precio en 10">−</button>
                            <input className={drawerStyles.entrada} id="nueva-publicacion-precio" type="text" inputMode="numeric" maxLength={10} placeholder="Ingresar precio aquí" value={datos.precio} onChange={(evento) => actualizar({ precio: evento.target.value.replace(/\D/g, "") })} disabled={guardando} />
                            <button className={drawerStyles.ajustarPrecio} type="button" onClick={() => cambiarPrecio(10)} disabled={guardando} aria-label="Aumentar precio en 10">+</button>
                        </div>
                        <small className={drawerStyles.ayuda}>Dejalo vacío si el producto no tiene precio.</small>
                    </div>

                    <label className={drawerStyles.disponibilidad} htmlFor="nueva-publicacion-disponibilidad" data-disponible={datos.disponibilidad} data-guardando={guardando}>
                        <span className={drawerStyles.textoDisponibilidad}>
                            <span className={drawerStyles.etiqueta}>Disponibilidad</span>
                            <span className={drawerStyles.estadoDisponibilidad}>{datos.disponibilidad ? "Disponible" : "No disponible"}</span>
                        </span>
                        <Switch className={drawerStyles.interruptorDisponibilidad} checked={datos.disponibilidad} onChange={(_, seleccionado) => actualizar({ disponibilidad: seleccionado })} disabled={guardando} slotProps={{ input: { id: "nueva-publicacion-disponibilidad", role: "switch", "aria-label": "Publicación disponible" } }} />
                    </label>

                    <div className={drawerStyles.seccionFoto}>
                        <div className={drawerStyles.marcoFoto}>
                            {datos.fotografia ? <Image className={drawerStyles.imagenFoto} src={datos.fotografia} alt="Vista previa de la fotografía" fill sizes="(min-width: 768px) 480px, 100vw" unoptimized /> : <div className={drawerStyles.sinFoto}><PhotoCameraOutlinedIcon aria-hidden="true" /><span>Sin foto</span></div>}
                            {datos.fotografia && <button className={`${drawerStyles.botonFoto} ${drawerStyles.borrarFoto}`} type="button" onClick={borrarFotografia} disabled={guardando}><DeleteOutlinedIcon fontSize="small" /> Borrar foto</button>}
                            <button className={drawerStyles.botonFoto} type="button" onClick={() => inputFotoRef.current?.click()} disabled={guardando}><PhotoCameraOutlinedIcon fontSize="small" /> Editar foto</button>
                            <input ref={inputFotoRef} className={drawerStyles.inputFoto} type="file" accept="image/png,image/jpeg,image/webp" capture={esWeb ? undefined : "environment"} onChange={seleccionarFotografia} disabled={guardando} aria-label="Fotografía" />
                        </div>
                    </div>
                </div>
                <div className={drawerStyles.pie}>
                    <button className={drawerStyles.cancelar} type="button" onClick={alCerrar} disabled={guardando}>Cancelar</button>
                    <button className={drawerStyles.guardar} type="submit" disabled={deshabilitado}>{guardando ? "Guardando..." : "Confirmar"}</button>
                </div>
            </form>
        </Drawer>
    );
}
