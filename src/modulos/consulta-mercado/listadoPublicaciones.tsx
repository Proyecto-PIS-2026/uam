import type {
  publicacionListado,
  operadorListado,
} from "./acciones/publicaciones";

type propiedadesListadoPublicaciones =
  | {
      agruparPorOperador: false;
      publicaciones: publicacionListado[];
    }
  | {
      agruparPorOperador: true;
      operadores: operadorListado[];
    };

const clasesLista = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3";

// TODO: Cuando este pronta TarjetaPublicacion, importarla, reemplazar las dos
// instancias de VistaProvisoriaPublicacion y eliminar esta vista provisional.
function VistaProvisoriaPublicacion({
  publicacion,
  mostrarOperador,
}: {
  publicacion: publicacionListado;
  mostrarOperador: boolean;
}) {
  return (
    <div className="border p-4">
      <p className="font-semibold">
        {publicacion.especie} - {publicacion.variedad}
      </p>
      <p>{publicacion.presentacion}</p>
      <p>Precio: {publicacion.precio}</p>
      {mostrarOperador && <p>{publicacion.operador.nombreFantasia}</p>}
    </div>
  );
}

export default function ListadoPublicaciones(
  propiedades: propiedadesListadoPublicaciones,
) {
  if (propiedades.agruparPorOperador) {
    if (propiedades.operadores.length === 0) {
      return <p role="status">No hay publicaciones que coincidan con la búsqueda.</p>;
    }

    return (
      <div className="space-y-6">
        {propiedades.operadores.map((operador) => (
          <section
            key={operador.id}
            aria-labelledby={`operador-${operador.id}`}
          >
            <h2
              id={`operador-${operador.id}`}
              className="mb-3 border-b pb-2 text-lg font-semibold"
            >
              {operador.nombreFantasia}
            </h2>

            <ul className={clasesLista}>
              {operador.publicaciones.map((publicacion) => (
                <li key={publicacion.id}>
                  <VistaProvisoriaPublicacion
                    publicacion={{
                      ...publicacion,
                      operador: {
                        id: operador.id,
                        nombreFantasia: operador.nombreFantasia,
                        fotoPerfil: operador.fotoPerfil,
                      },
                    }}
                    mostrarOperador={false}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    );
  }

  if (propiedades.publicaciones.length === 0) {
    return <p role="status">No hay publicaciones que coincidan con la búsqueda.</p>;
  }

  return (
    <ul className={clasesLista}>
      {propiedades.publicaciones.map((publicacion) => (
        <li key={publicacion.id}>
          <VistaProvisoriaPublicacion
            publicacion={publicacion}
            mostrarOperador
          />
        </li>
      ))}
    </ul>
  );
}
