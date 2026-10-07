import TarjetaConfiguracion from "./tarjetaConfiguracion";
import ConfiguracionAjustePrecios from "./ConfiguracionAjustePrecios";

interface ContenedorConfiguracionProps {
    configuracion: Record<string, string | null>;
}

export default function ContenedorConfiguracion({ configuracion }: ContenedorConfiguracionProps) {
    const contenido = (
        <div className="flex flex-col gap-6">
            <TarjetaConfiguracion
                titulo="Ordenamiento de resultados"
                descripcion="Mostrá u ocultá las opciones para ordenar las publicaciones. La búsqueda y los filtros siguen disponibles."
                valorInicial={configuracion.ordenamiento}
                tipo="checkbox"
                label="Habilitar ordenamiento"
            />
            <ConfiguracionAjustePrecios valorInicial={configuracion.incremento_precio ?? null} />
            <TarjetaConfiguracion
                titulo="Lista Inteligente"
                descripcion="Enlace al recurso externo de la UAM."
                valorInicial={configuracion.lista}
                tipo="url"
                label="URL de la Lista Inteligente"
            />
            <TarjetaConfiguracion
                titulo="Vigencia de fotografías"
                descripcion="Indicá cuántos días se considera vigente una fotografía."
                valorInicial={configuracion.fotografias}
                tipo="number"
                label="Período de vigencia (días)"
            />
        </div>
    );
    return contenido; 
}
