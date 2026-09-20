import ListadoPublicaciones from "@/modulos/consulta-mercado/listadoPublicaciones";
import {
  consultarPublicaciones,
  consultarPublicacionesAgrupadas,
} from "@/modulos/consulta-mercado/acciones/publicaciones";

type propiedadesPagina = {
  searchParams: Promise<{ agrupar?: string | string[] }>;
};

export default async function PaginaPublicaciones({
  searchParams,
}: propiedadesPagina) {
  const parametros = await searchParams;
  const agruparPorOperador = parametros.agrupar === "true";
  let listado;

  if (agruparPorOperador) {
    const resultado = await consultarPublicacionesAgrupadas();
    listado = (
      <ListadoPublicaciones
        agruparPorOperador={true}
        operadores={resultado.operadores}
      />
    );
  } else {
    const resultado = await consultarPublicaciones();
    listado = (
      <ListadoPublicaciones
        agruparPorOperador={false}
        publicaciones={resultado.publicaciones}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Publicaciones</h1>
        <form action="/publicaciones" method="get">
          <button
            type="submit"
            name="agrupar"
            value={agruparPorOperador ? "false" : "true"}
            className="rounded-md bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            {agruparPorOperador ? "Ver sin agrupar" : "Agrupar por operador"}
          </button>
        </form>
      </div>

      {listado}
    </main>
  );
}
