import EstadoError from "@/compartido/componentes/EstadoError";

export const metadata = {
    title: "Página no encontrada | UAM",
};

export default function PaginaNoEncontrada() {
    return (
        <EstadoError
            mensaje="404: Página no encontrada. La dirección no existe o el contenido ya no está disponible."
        />
    );
}
