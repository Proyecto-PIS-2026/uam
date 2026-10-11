import { redirect } from "next/navigation";
import { obtenerSesion } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { obtenerRutaPrincipal } from "@/modulos/identidad-acceso/autorizacion/rutas";

export default async function Home() {
  const sesion = await obtenerSesion();
  redirect(obtenerRutaPrincipal(sesion?.rol));
}