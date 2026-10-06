import TarjetaConfiguracion from "./tarjetaConfiguracion";

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
            <TarjetaConfiguracion
                titulo="Ajuste rápido de precios"
                descripcion="Importe en pesos para los controles de aumento y disminución rápida de precios."
                valorInicial={configuracion.incremento}
                tipo="number"
                label="Importe de ajuste ($)"
            />
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