import Imagen from "next/image";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import type { PublicacionListado } from "../../../consulta-mercado/acciones/publicaciones";
import estilos from "./TarjetaPublicacionConOperador.module.css";

const formatoPrecio = new Intl.NumberFormat("es-UY", {
  style: "currency",
  currency: "UYU",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export default function TarjetaPublicacionConOperador({ publicacion, onClick }: { publicacion: PublicacionListado; onClick?: () => void; }) {
  const { foto, especie, variedad, categoria, calibre, codigoCalibre, presentacion, precio } = publicacion;
  const operador = publicacion.operador.nombreFantasia;
  const nombreProducto = variedad && variedad !== "-" ? `${especie} — ${variedad}` : especie;

  return (
    <article className={estilos.tarjeta} aria-label={`${especie} — ${operador}`} onClick={onClick}>
      <div className={estilos.contenedorImagen}>
        {foto ? (
          <Imagen src={foto} alt={`Foto de ${nombreProducto}`} fill sizes="(max-width: 380px) 72px, (max-width: 419px) 88px, 96px" className={estilos.imagen}/>
        ) : (
          <div className={estilos.sinFoto}>
            <ImageOutlinedIcon className={estilos.iconoFoto}/>
            <span>Foto</span>
          </div>
        )}
      </div>
      <div className={estilos.contenido}>
        <div className={estilos.encabezado}>
          <p className={estilos.especie} title={nombreProducto}>
            {nombreProducto}
          </p>

          <p className={estilos.operador} title={operador}>
            {operador}
          </p>
        </div>
        <div className={estilos.cuerpo}>
          <div className={estilos.informacion}>
            <div className={estilos.dato}>
              <span className={estilos.etiqueta}>Calibre</span>
              <span className={estilos.chip} title={calibre}>{codigoCalibre ?? calibre}</span>
            </div>

            <div className={estilos.dato}>
              <span className={estilos.etiqueta}>Cat.</span>
              <span className={estilos.chip}>{categoria}</span>
            </div>
          </div>

          <div className={estilos.contenedorPrecio}>
            <span className={estilos.precio}>{formatoPrecio.format(precio)}</span>
            <span className={estilos.presentacionPrecio} title={`por ${presentacion}`}>
              por {presentacion}
            </span>
          </div>
        </div>

      </div>
    </article>
  );
}

