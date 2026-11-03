import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { obtenerSegundoFactorPendiente } from "@/modulos/identidad-acceso/autenticacion/segundo-factor";
import { obtenerTokenSegundoFactor } from "@/modulos/identidad-acceso/autenticacion/cookie-segundo-factor";
import { obtenerUriVinculacion } from "@/modulos/identidad-acceso/autenticacion/segundo-factor-criptografia";
import FormularioSegundoFactor from "./formularioSegundoFactor";

export const metadata = { title: "Verificación en dos pasos | UAM", robots: { index: false, follow: false } };

export default async function Page() {
    const pendiente = await obtenerSegundoFactorPendiente(await obtenerTokenSegundoFactor());
    if (!pendiente || (pendiente.vinculacion && !pendiente.secreto)) redirect("/iniciar-sesion?segundoFactor=vencido");
    const qr = pendiente.secreto ? await QRCode.toDataURL(obtenerUriVinculacion(pendiente.secreto, pendiente.correo), { width: 256, margin: 4 }) : null;
    return (
        <main className="contenedor-pagina flex flex-1 items-start justify-center">
            <section className="w-full max-w-md secciones-pagina">
                <h1 className="titulo-pagina-plano">{pendiente.vinculacion ? "Configurá la verificación en dos pasos" : "Verificá tu identidad"}</h1>
                <FormularioSegundoFactor {...pendiente} qr={qr} />
            </section>
        </main>
    );
}
