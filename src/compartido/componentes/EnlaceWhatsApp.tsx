"use client";

import { useSyncExternalStore, type ComponentPropsWithoutRef } from "react";
import { crearEnlaceWhatsApp, esDispositivoMovil } from "@/compartido/whatsapp";

type Props = Omit<ComponentPropsWithoutRef<"a">, "href" | "target" | "rel"> & {
    numero: string;
    mensaje: string;
};

const suscribir = () => () => {};
const obtenerEstadoServidor = () => false;

export default function EnlaceWhatsApp({ numero, mensaje, ...props }: Props) {
    const movil = useSyncExternalStore(suscribir, esDispositivoMovil, obtenerEstadoServidor);

    return <a {...props} href={crearEnlaceWhatsApp(mensaje, numero, movil)} target="_blank" rel="noopener noreferrer" />;
}
