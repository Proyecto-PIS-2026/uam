"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import EncabezadoPagina from "@/compartido/componentes/EncabezadoPagina";
import AvisoErrorToast from "@/compartido/componentes/AvisoErrorToast";
import obtenerPublicacionesProductores from "@/modulos/consulta-mercado/acciones/consultar-publicaciones-productor";
import type { PublicacionProductorListado } from "@/modulos/consulta-mercado/consultas/consultas-publicaciones-productor";
import type { OrdenConsulta } from "@/modulos/consulta-mercado/filtros/filtros-consulta";
import { useActualizacionesPublicaciones } from "../../publicaciones/tiempo-real/useActualizacionesPublicaciones";
import ContenedorPublicaciones from "./ContenedorPublicaciones";

type Props = {
    publicaciones: PublicacionProductorListado[];
    especie?: string;
    esAdmin?: boolean;
    ordenInicial?: OrdenConsulta;
    ordenamientoHabilitado?: boolean;
};

export default function MercadoProduccion({ publicaciones, ...opciones }: Props) {
    const [datos, setDatos] = useState(publicaciones);
    const [error, setError] = useState("");
    const [cargando, setCargando] = useState(false);
    const montado = useRef(true);
    const origen = useRef(publicaciones);
    const enCurso = useRef<Promise<boolean> | null>(null);
    const pendiente = useRef(false);

    const actualizar = useCallback((): Promise<boolean> => {
        if (!montado.current) return Promise.resolve(false);
        pendiente.current = true;
        if (enCurso.current) return enCurso.current;
        setCargando(true);
        setError("");
        const cargar = async () => {
            let actualizado = false;
            try {
                while (pendiente.current && montado.current) {
                    pendiente.current = false;
                    try {
                        const resultado = await obtenerPublicacionesProductores();
                        if (!montado.current) return false;
                        setDatos(resultado.publicaciones);
                        setError("");
                        actualizado = true;
                    } catch {
                        actualizado = false;
                        if (montado.current) setError("No se pudieron actualizar las publicaciones. Intentá nuevamente.");
                    }
                }
                return actualizado;
            } finally {
                enCurso.current = null;
                if (montado.current) setCargando(false);
            }
        };
        enCurso.current = cargar();
        return enCurso.current;
    }, []);

    useActualizacionesPublicaciones(actualizar, { tipo: "PRODUCTOR" });

    useEffect(() => {
        montado.current = true;
        return () => { montado.current = false; pendiente.current = false };
    }, []);

    useEffect(() => {
        if (origen.current !== publicaciones) {
            origen.current = publicaciones;
            void actualizar();
        }
    }, [publicaciones, actualizar]);

    return (
        <div className="secciones-pagina" aria-busy={cargando}>
            <EncabezadoPagina
                titulo="Mercado Producción"
                cantidad={datos.length}
                subtitulo={datos.length === 1 ? "publicación en la plataforma" : "publicaciones en la plataforma"}
            />
            <AvisoErrorToast mensaje={error} cerrarAlCorregir={false} />
            {error && <button type="button" className="boton-secundario" disabled={cargando} onClick={() => void actualizar()}>Reintentar</button>}
            <ContenedorPublicaciones publicaciones={datos} {...opciones} conservarFiltrosAlActualizar />
        </div>
    );
}
