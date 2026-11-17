"use client";

import { useEffect, useRef, useState } from "react";
import { fetchConSesion } from "../../../identidad-acceso/autenticacion/cliente-sesion";
import { compararEspeciesPorPrioridad } from "../../../../compartido/prioridad-especies";
import { ordenarOpcionesPorNombre } from "../../catalogos/ordenar-opciones";
import type { OpcionEdicion as Opcion, OpcionesEdicionPublicacion as Catalogos } from "../../catalogos/tipos";

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

export function useCatalogosPublicacionProductor() {
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

