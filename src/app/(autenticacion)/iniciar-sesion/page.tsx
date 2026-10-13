import FormularioInicioSesion from "./formularioInicioSesion";

export const metadata = {
    title: "Iniciar sesión | UAM",
};

export default function Page() {
    return (
        <main className="contenedor-pagina flex flex-1 items-start justify-center py-10">
            <section className="w-full max-w-md">
                <h1 className="mb-6 text-3xl font-bold">Iniciar sesión</h1>
                <FormularioInicioSesion />
            </section>
        </main>
    );
}