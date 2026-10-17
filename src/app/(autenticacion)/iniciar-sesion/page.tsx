import FormularioInicioSesion from "./formularioInicioSesion";

export const metadata = {
    title: "Iniciar sesión | UAM",
};

export default function Page() {
    return (
        <main className="contenedor-pagina flex flex-1 items-start justify-center">
            <section className="w-full max-w-md secciones-pagina">
                <h1 className="text-3xl font-bold">Iniciar sesión</h1>
                <FormularioInicioSesion />
            </section>
        </main>
    );
}