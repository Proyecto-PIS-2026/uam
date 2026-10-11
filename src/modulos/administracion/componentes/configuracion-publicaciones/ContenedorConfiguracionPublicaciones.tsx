import ContenedorConfiguracion from "@/modulos/administracion/componentes/configuracion-publicaciones/ListadoConfiguracionesPublicaciones";

interface ContenedorConfiguracionPublicacionesProps {
    configuracion: Record<string, string | null>; 
}

export default function ContenedorConfiguracionPublicaciones({ configuracion }: ContenedorConfiguracionPublicacionesProps) {
    return <ContenedorConfiguracion configuracion={configuracion} />;
}