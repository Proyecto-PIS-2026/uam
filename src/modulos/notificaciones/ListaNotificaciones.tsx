"use client";

import { useState, useTransition } from "react";
import { Alert, Button, CircularProgress, IconButton, MenuItem, TextField } from "@mui/material";
import DoneIcon from "@mui/icons-material/Done";
import NotificationsNoneIcon from "@mui/icons-material/NotificationsNone";
import { listarNotificaciones, modificarNotificaciones } from "./acciones";
import EncabezadoPagina from "@/compartido/EncabezadoPagina";
import EstadoVacio from "@/compartido/componentes/EstadoVacio";
import estilos from "./ListaNotificaciones.module.css";

type Notificacion = Awaited<ReturnType<typeof listarNotificaciones>>[number];

export default function ListaNotificaciones({ notificaciones, onModificar = modificarNotificaciones }: {
    notificaciones: Notificacion[];
    onModificar?: (accion: "leer", id?: number) => Promise<void>;
}) {
    const [pendiente, iniciarTransicion] = useTransition();
    const [error, setError] = useState("");
    const [orden, setOrden] = useState("recientes");
    function ejecutar(accion: "leer", id?: number) {
        setError("");
        iniciarTransicion(async () => {
            try { await onModificar(accion, id); }
            catch { setError("No se pudo completar la operación. Intentá nuevamente."); }
        });
    }
    const sinLeer = notificaciones.filter((n) => !n.vista).length;
    const ordenadas = [...notificaciones].sort((a, b) => {
        const diferencia = a.fecha && b.fecha ? Date.parse(b.fecha) - Date.parse(a.fecha) : 0;
        const comparacion = diferencia || b.id - a.id;
        return orden === "recientes" ? comparacion : -comparacion;
    });
    return (
        <main className="flex-1 bg-background text-foreground">
          <div className="contenedor-pagina">
           <section className="secciones-pagina">
            <EncabezadoPagina titulo="Notificaciones" subtitulo="Consultá las novedades y los avisos de tu cuenta" />
            {error && <Alert severity="error">{error}</Alert>}
            <div aria-live="polite" aria-busy={pendiente}>
                {notificaciones.length === 0 ? <EstadoVacio titulo="No tenés notificaciones." descripcion="Cuando recibas nuevos avisos, los vas a encontrar acá." icono={<NotificationsNoneIcon />} nivelTitulo={2} anunciar={false} /> : (
                  <div className={estilos.panel}>
                   <div className={estilos.barra}>
                    <p className={estilos.resumen}>{sinLeer === 0 ? "Estás al día" : `${sinLeer} sin leer`}</p>
                    <div className={estilos.acciones}>
                        <TextField select label="Ordenar por" size="small" className={estilos.orden} value={orden} onChange={(evento) => setOrden(evento.target.value)}>
                            <MenuItem value="recientes">Más recientes primero</MenuItem>
                            <MenuItem value="antiguas">Más antiguas primero</MenuItem>
                        </TextField>
                <Button startIcon={<DoneIcon />} disabled={pendiente || sinLeer === 0} onClick={() => ejecutar("leer")}>Marcar todas como leídas</Button>
                {pendiente && <CircularProgress size={24} aria-label="Actualizando notificaciones" />}
                    </div>
                   </div>
                    <ul className={estilos.lista}>
                        {ordenadas.map((n) => (
                            <li key={n.id} className={`${estilos.fila} ${n.vista ? "" : estilos.sinLeer}`}>
                                    <div className={estilos.icono}><NotificationsNoneIcon aria-hidden="true" /></div>
                                    <div className={estilos.contenido}>
                                        <div className={estilos.tituloFila}>
                                            <h2>{n.titulo}</h2>
                                            <span className={estilos.estado}>{n.vista ? "Leída" : "Sin leer"}</span>
                                        </div>
                                        <p className={estilos.mensaje}>{n.descripcion}</p>
                                        {n.fecha && <time dateTime={n.fecha} className={estilos.fecha}>
                                            {new Intl.DateTimeFormat("es-UY", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Montevideo" }).format(new Date(n.fecha))}
                                        </time>}
                                    </div>
                                    <div className={estilos.accionesFila}>
                                    <IconButton aria-label={`Marcar como leída: ${n.titulo}`} disabled={pendiente || n.vista} onClick={() => ejecutar("leer", n.id)}><DoneIcon /></IconButton>
                                    </div>
                            </li>
                        ))}
                    </ul>
                  </div>
                )}
            </div>
           </section>
          </div>
        </main>
    );
}
