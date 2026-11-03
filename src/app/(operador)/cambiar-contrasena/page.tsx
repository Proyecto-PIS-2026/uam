import FormularioCambiarContrasena from "@/modulos/usuarios/operadores/componentes/cambiar-contrasena/FormularioCambiarContrasena";
import { requerirOperador } from "@/modulos/identidad-acceso/autorizacion/controles";

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Cambiar contraseña | UAM",
};

export default async function Page() {
    await requerirOperador();

    return (
        <main className="contenedor-pagina flex flex-1 items-start justify-center">
            <section className="w-full max-w-md secciones-pagina">
                <h1 className="titulo-pagina-plano">Cambiar contraseña</h1>
                <FormularioCambiarContrasena />
            </section>
        </main>
    );
}
