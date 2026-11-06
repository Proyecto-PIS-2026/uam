import FormularioInicioSesion from "./formularioInicioSesion";
import { estaHabilitadoCambioContrasena } from "@/modulos/identidad-acceso/cambio-contrasena/configuracion";
import { requerirSinSesion } from "@/modulos/identidad-acceso/autorizacion/controles";

export const metadata = {
    title: "Iniciar sesión | UAM",
};

const mensajesSegundoFactor: Record<string, string> = {
    cancelado: "Cancelaste la verificación en dos pasos. No se inició sesión.",
    vencido: "Se terminó el tiempo para completar la verificación en dos pasos. Iniciá sesión nuevamente para comenzar.",
    bloqueado: "Alcanzaste el límite de intentos. Tu ingreso quedó bloqueado durante 5 minutos. Después podrás iniciar sesión nuevamente.",
};

export default async function Page({ searchParams }: { searchParams: Promise<{ segundoFactor?: string }> }) {
    await requerirSinSesion();
    const { segundoFactor } = await searchParams;
    const recuperacionHabilitada = await estaHabilitadoCambioContrasena();
    const mensaje = segundoFactor ? mensajesSegundoFactor[segundoFactor] : undefined;
    return (
        <main className="contenedor-pagina flex flex-1 items-start justify-center">
            <section className="w-full max-w-md secciones-pagina">
                <h1 className="titulo-pagina-plano">Iniciar sesión</h1>
                {mensaje && <p role="status" className="text-sm">{mensaje}</p>}
                <FormularioInicioSesion recuperacionHabilitada={recuperacionHabilitada} />
            </section>
        </main>
    );
}
