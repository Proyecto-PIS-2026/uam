import Imagen from "next/image";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/publicaciones";
import estilos from "./TarjetaPublicacionConOperador.module.css";

const formatoPrecio = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

type PropiedadesTarjetaPublicacionConOperador = {
  publicacion: PublicacionListado;
  onClick: () => void;
};

export default function TarjetaPublicacionConOperador({ publicacion, onClick }: PropiedadesTarjetaPublicacionConOperador) {
  const { foto, especie, variedad, categoria, calibre, presentacion, precio } = publicacion;
  const nombreProducto = variedad && variedad !== "-" ? `${especie} ${variedad}` : especie;

  return (
    <button type="button" className={estilos.tarjeta} aria-label={`Ver detalle de ${nombreProducto}`} onClick={onClick}>
      <div className={estilos.contenedorImagen}>
        {foto ? (
          <Imagen src={foto} alt={`Foto de ${nombreProducto}`} fill sizes="(max-width: 639px) 100vw, (max-width: 767px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 234px" className={estilos.imagen}/>
        ) : (
          <div className={estilos.sinFoto}>
            <ImageOutlinedIcon className={estilos.iconoFoto}/>
            <span>Sin foto disponible</span>
          </div>
        )}
      </div>
      <div className={estilos.contenido}>
        <div className={estilos.encabezado}>
          <h3 className={estilos.especie}>{nombreProducto}</h3>
          <p className={estilos.informacion}>{calibre} · Categoría {categoria}</p>
        </div>
        <div className={estilos.filaInferior}>
          <p className={estilos.operador} title={publicacion.operador.nombreFantasia}>{publicacion.operador.nombreFantasia}</p>
          <div className={estilos.contenedorPrecio}>
            <span className={estilos.precio}>{formatoPrecio.format(precio)}</span>
            <span className={estilos.presentacionPrecio}>por {presentacion}</span>
          </div>
        </div>
      </div>
    </button>
  );
}
