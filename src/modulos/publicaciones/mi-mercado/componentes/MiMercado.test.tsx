import {
  render,
  act,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { PublicacionParaEditar } from "../../operadores/componentes/DrawerEditarPublicacion";
import type { CambiosPublicacionOperador } from "../../operadores/modificar-publicacion";
import MiMercado, {
  type Publicacion,
} from "./MiMercado";

type DrawerMockProps = {
  abierto: boolean;
  alCerrar: () => void;
  alEliminar?: () => void;
  alGuardar: (publicacionOperadorId: number, cambios: CambiosPublicacionOperador, fotoNueva: File | null) => void | Promise<void>;
  publicacion: PublicacionParaEditar | null;
  modoInicial?: "consulta" | "edicion";
  eliminando?: boolean;
  actualizando?: boolean;
  errorConsulta?: string;
  children?: ReactNode;
};

const mocks = vi.hoisted(() => ({
  refrescar: vi.fn(),
  reemplazar: vi.fn(),
  solicitud: vi.fn(),
  drawer: vi.fn<(props: DrawerMockProps) => void>(),
  cargarPublicaciones: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refrescar, replace: mocks.reemplazar }) }));
vi.mock("../acciones", () => ({ cargarPublicacionesMiMercado: mocks.cargarPublicaciones }));

vi.mock("../../operadores/componentes/DrawerEditarPublicacion", () => ({
  default: (props: DrawerMockProps) => {
    mocks.drawer(props);
    if (!props.abierto || !props.publicacion) return null;

    return (
      <div role="dialog" aria-label="Publicación seleccionada" data-modo={props.modoInicial} data-pais={props.publicacion.paisId} data-actualizando={Boolean(props.actualizando)}>
        <span>{props.publicacion.especie}</span>
        {props.errorConsulta && <p role="alert">{props.errorConsulta}</p>}
        <button type="button" onClick={props.alCerrar}>Cerrar consulta</button>
        {props.alEliminar && <button type="button" onClick={props.alEliminar} disabled={props.eliminando}>Eliminar desde consulta</button>}
        {props.children}
      </div>
    );
  },
}));

vi.mock("../../../../compartido/componentes/ConfirmModal", () => ({
  ConfirmModal: ({ abierto, alConfirmar, alCancelar, procesando }: {
    abierto: boolean;
    alConfirmar: () => void;
    alCancelar: () => void;
    procesando: boolean;
  }) => abierto ? (
    <div role="alertdialog" aria-label="Confirmar eliminación">
      <button type="button" onClick={alConfirmar} disabled={procesando}>Confirmar baja</button>
      <button type="button" onClick={alCancelar} disabled={procesando}>Cancelar baja</button>
    </div>
  ) : null,
}));

vi.mock("../../operadores/componentes/NuevaPublicacion", () => ({
  default: ({
    abierto,
    alCerrar,
    alCrear,
    operadorId,
  }: {
    abierto: boolean;
    alCerrar: () => void;
    alCrear: (mensaje: string) => void;
    operadorId: number;
  }) => abierto ? (
    <div role="dialog" aria-label="Nueva publicación" data-operador={operadorId}>
      <button type="button" onClick={alCerrar}>Cerrar alta</button>
      <button type="button" onClick={() => alCrear("Publicación creada correctamente.")}>Guardar alta simulada</button>
    </div>
  ) : null,
}));

vi.mock("./TarjetaPublicacion", () => ({
  default: ({
    pub,
    operadorId,
    incrementoPrecio,
    alConsultar,
  }: {
    pub: Publicacion;
    operadorId: number;
    incrementoPrecio: number;
    alConsultar?: (publicacion: Publicacion) => void;
  }) => (
    <div
      data-testid={`publicacion-${pub.id}`}
      data-operador={operadorId}
      data-incremento={incrementoPrecio}
    >
      {pub.presentacion.variedad.nombreVariedad}
      <button type="button" onClick={() => alConsultar?.(pub)}>Consultar publicación {pub.id}</button>
    </div>
  ),
}));

function crearPublicacion(
  id: number,
  especieId: number,
  nombreEspecie: string,
): Publicacion {
  return {
    id,
    publicacionOperadorId: id,
    paisId: 44,
    foto: null,
    precio: "100",
    fecha: "2026-10-03T15:00:00.000Z",
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacion: {
      id,
      nombrePresentacion: "Cajón",
      variedad: {
        id,
        nombreVariedad: `Variedad ${id}`,
        especie: {
          id: especieId,
          nombreEspecie,
          fotoEspecie: null,
        },
      },
    },
    categoria: {
      id: 1,
      nombreCategoria: "Primera",
    },
    calibre: {
      id: 1,
      codigoCalibre: "M",
      nombreCalibre: "Mediano",
    },
  };
}

function crearPublicacionConPrecio(
  id: number,
  especieId: number,
  nombreEspecie: string,
  precio: string,
): Publicacion {
  const publicacion = crearPublicacion(id, especieId, nombreEspecie);
  publicacion.precio = precio;
  return publicacion;
}

function renderMiMercado(
  publicaciones: Publicacion[],
  incrementoPrecio = 5,
) {
  return render(
    <MiMercado
      operadorId={9}
      publicaciones={publicaciones}
      incrementoPrecio={incrementoPrecio}
      opcionesEdicion={{ especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [] }}
    />,
  );
}

function obtenerPropsDrawer(): DrawerMockProps {
  const props = mocks.drawer.mock.lastCall?.[0];
  if (!props) throw new Error("La consulta de la publicación no se renderizó.");
  return props;
}

function idsTarjetas() {
  return screen.getAllByTestId(/^publicacion-/).map((tarjeta) => tarjeta.getAttribute("data-testid"));
}

function elegirOrden(nombre: "A-Z" | "Z-A" | "Menor Precio" | "Mayor Precio") {
  fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
  fireEvent.click(screen.getByRole("button", { name: nombre }));
}

describe("MiMercado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.solicitud.mockReset();
    mocks.cargarPublicaciones.mockReset();
    vi.stubGlobal("fetch", mocks.solicitud);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("abre la consulta de la tarjeta con sus IDs reales, país y precio nulo", () => {
    const publicacion = crearPublicacion(52, 10, "Manzana");
    publicacion.publicacionOperadorId = 13;
    publicacion.precio = null;
    renderMiMercado([publicacion]);

    expect(screen.queryByRole("dialog", { name: "Publicación seleccionada" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));

    const drawer = screen.getByRole("dialog", { name: "Publicación seleccionada" });
    expect(drawer).toHaveAttribute("data-modo", "consulta");
    expect(drawer).toHaveAttribute("data-pais", "44");
    expect(mocks.drawer).toHaveBeenLastCalledWith(expect.objectContaining({
      abierto: true,
      modoInicial: "consulta",
      publicacion: expect.objectContaining({
        publicacionId: 52,
        publicacionOperadorId: 13,
        especieId: 10,
        variedadId: 52,
        presentacionId: 52,
        categoriaId: 1,
        calibreId: 1,
        paisId: 44,
        precio: null,
      }),
    }));

    fireEvent.click(within(drawer).getByRole("button", { name: "Cerrar consulta" }));
    expect(screen.queryByRole("dialog", { name: "Publicación seleccionada" })).not.toBeInTheDocument();
    expect(screen.getByTestId("publicacion-52")).toBeInTheDocument();
    expect(screen.getByTestId("publicacion-52")).toHaveAttribute("data-operador", "9");
  });

  it("permite cancelar la baja sin cerrar la consulta ni enviar una solicitud", () => {
    renderMiMercado([crearPublicacion(52, 10, "Manzana")]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar desde consulta" }));

    expect(screen.getByRole("alertdialog", { name: "Confirmar eliminación" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar baja" }));

    expect(screen.queryByRole("alertdialog", { name: "Confirmar eliminación" })).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toBeInTheDocument();
    expect(screen.getByTestId("publicacion-52")).toBeInTheDocument();
    expect(mocks.solicitud).not.toHaveBeenCalled();
  });

  it("guarda con fotografía y mantiene la consulta hasta recibir los datos actualizados", async () => {
    const publicacion = crearPublicacion(52, 10, "Manzana");
    publicacion.publicacionOperadorId = 13;
    const listadoInicial = [publicacion];
    const { rerender } = renderMiMercado(listadoInicial);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));

    mocks.solicitud.mockResolvedValue({
      ok: true,
      json: async () => ({ mensaje: "Publicación actualizada.", publicacionId: 52, publicacionOperadorId: 13 }),
    });
    const cambios: CambiosPublicacionOperador = {
      precio: "150",
      foto: null,
      presentacionId: 22,
      categoriaId: 2,
      calibreId: 2,
      paisId: 55,
      disponible: false,
    };
    const archivo = new File(["fotografía"], "pera.webp", { type: "image/webp" });
    const propsIniciales = obtenerPropsDrawer();

    const actualizada = crearPublicacion(52, 20, "Pera");
    actualizada.publicacionOperadorId = 13;
    actualizada.precio = "150.00";
    actualizada.foto = "/api/publicaciones/imagenes/52/pera.webp";
    actualizada.paisId = 55;
    actualizada.publicacionDisponible = false;
    actualizada.presentacion.id = 22;
    actualizada.presentacion.variedad.id = 23;
    actualizada.presentacion.variedad.nombreVariedad = "Williams";
    actualizada.categoria = { id: 2, nombreCategoria: "II" };
    actualizada.calibre = { id: 2, codigoCalibre: "G", nombreCalibre: "Grande" };
    mocks.cargarPublicaciones.mockResolvedValue([actualizada]);

    await act(async () => {
      await propsIniciales.alGuardar(13, cambios, archivo);
    });

    expect(mocks.solicitud).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/52?operadorId=9", { method: "PATCH", body: expect.any(FormData) });
    const solicitud = mocks.solicitud.mock.lastCall;
    if (!solicitud) throw new Error("No se envió la modificación.");
    const cuerpo = solicitud[1].body as FormData;
    expect(cuerpo.get("cambios")).toBe(JSON.stringify(cambios));
    expect(cuerpo.get("fotografia")).toMatchObject({ name: "pera.webp", type: "image/webp" });
    expect(mocks.cargarPublicaciones).toHaveBeenCalledExactlyOnceWith(9);
    expect(mocks.refrescar).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toHaveAttribute("data-modo", "consulta");
    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toHaveAttribute("data-actualizando", "false");
    expect(screen.getByTestId("publicacion-52")).toHaveTextContent("Williams");
    expect(obtenerPropsDrawer().publicacion).toEqual(expect.objectContaining({ especie: "Pera", precio: "150.00", paisId: 55 }));

    rerender(<MiMercado operadorId={9} publicaciones={[actualizada]} incrementoPrecio={5} opcionesEdicion={{ especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [] }} />);

    const consultaActualizada = screen.getByRole("dialog", { name: "Publicación seleccionada" });
    expect(consultaActualizada).toHaveAttribute("data-actualizando", "false");
    expect(consultaActualizada).toHaveAttribute("data-pais", "55");
    expect(obtenerPropsDrawer().publicacion).toEqual(expect.objectContaining({
      publicacionId: 52,
      publicacionOperadorId: 13,
      especieId: 20,
      variedadId: 23,
      especie: "Pera",
      variedad: "Williams",
      precio: "150.00",
      foto: "/api/publicaciones/imagenes/52/pera.webp",
      presentacionId: 22,
      categoriaId: 2,
      calibreId: 2,
      paisId: 55,
      disponible: false,
    }));
    expect(mocks.solicitud).toHaveBeenCalledOnce();
  });

  it("propaga el error de guardado manteniendo la consulta y los datos originales", async () => {
    const publicacion = crearPublicacion(52, 10, "Manzana");
    publicacion.publicacionOperadorId = 13;
    renderMiMercado([publicacion]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    mocks.solicitud.mockResolvedValue({
      ok: false,
      json: async () => ({ errores: ["No se pudieron guardar los cambios."] }),
    });
    const cambios: CambiosPublicacionOperador = {
      precio: "150", foto: null, presentacionId: 52, categoriaId: 1, calibreId: 1, paisId: 44, disponible: true,
    };
    const propsIniciales = obtenerPropsDrawer();

    await act(async () => {
      await expect(propsIniciales.alGuardar(13, cambios, null)).rejects.toThrow("No se pudieron guardar los cambios.");
    });

    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toHaveAttribute("data-actualizando", "false");
    expect(obtenerPropsDrawer().publicacion).toEqual(expect.objectContaining({ precio: "100", paisId: 44, foto: null }));
    expect(screen.getByTestId("publicacion-52")).toBeInTheDocument();
    expect(mocks.refrescar).not.toHaveBeenCalled();
  });

  it("avisa si se guardó la edición pero falló la recarga del listado", async () => {
    const publicacion = crearPublicacion(52, 10, "Manzana");
    renderMiMercado([publicacion]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    mocks.solicitud.mockResolvedValue({ ok: true, json: async () => ({ mensaje: "Publicación actualizada." }) });
    mocks.cargarPublicaciones.mockRejectedValue(new Error("No se pudo consultar la base de datos"));

    await act(async () => {
      await obtenerPropsDrawer().alGuardar(52, {
        precio: "150", foto: null, presentacionId: 52, categoriaId: 1, calibreId: 1, paisId: 44, disponible: true,
      }, null);
    });

    expect(screen.getAllByText("Los cambios se guardaron, pero no se pudo actualizar el listado. Recargá la página.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("publicacion-52")).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toHaveAttribute("data-actualizando", "false");
    expect(mocks.refrescar).toHaveBeenCalledOnce();
  });

  it("borra la publicación seleccionada y cierra la consulta después del éxito", async () => {
    const restante = crearPublicacion(53, 20, "Pera");
    const recarga: { completar: (publicaciones: Publicacion[]) => void } = { completar: () => {} };
    mocks.solicitud.mockResolvedValue({
      ok: true,
      json: async () => ({ mensaje: "Publicación eliminada." }),
    });
    mocks.cargarPublicaciones.mockReturnValue(new Promise<Publicacion[]>((resolver) => {
      recarga.completar = resolver;
    }));
    renderMiMercado([crearPublicacion(52, 10, "Manzana"), restante]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar desde consulta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

    await waitFor(() => expect(screen.queryByTestId("publicacion-52")).not.toBeInTheDocument());
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await act(async () => { recarga.completar([restante]); });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Publicación eliminada."));
    expect(screen.queryByRole("dialog", { name: "Publicación seleccionada" })).not.toBeInTheDocument();
    expect(mocks.solicitud).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/52?operadorId=9", { method: "DELETE" });
    expect(mocks.cargarPublicaciones).toHaveBeenCalledExactlyOnceWith(9);
    expect(screen.queryByTestId("publicacion-52")).not.toBeInTheDocument();
    expect(screen.getByTestId("publicacion-53")).toBeInTheDocument();
    expect(screen.getAllByText("1 publicación").length).toBeGreaterThan(0);
    expect(mocks.refrescar).toHaveBeenCalledOnce();
  });

  it("mantiene la baja visible y avisa si falla la recarga posterior", async () => {
    mocks.solicitud.mockResolvedValue({ ok: true, json: async () => ({ mensaje: "Publicación eliminada." }) });
    mocks.cargarPublicaciones.mockRejectedValue(new Error("No se pudo consultar la base de datos"));
    renderMiMercado([crearPublicacion(52, 10, "Manzana")]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar desde consulta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Los cambios se guardaron, pero no se pudo actualizar el listado."));
    expect(screen.queryByTestId("publicacion-52")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(mocks.cargarPublicaciones).toHaveBeenCalledExactlyOnceWith(9);
  });

  it("conserva la publicación y su consulta cuando falla la baja", async () => {
    mocks.solicitud.mockResolvedValue({
      ok: false,
      json: async () => ({ errores: ["No se pudo eliminar la publicación."] }),
    });
    renderMiMercado([crearPublicacion(52, 10, "Manzana")]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar desde consulta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

    await waitFor(() => expect(within(screen.getByRole("dialog", { name: "Publicación seleccionada" })).getByRole("alert")).toHaveTextContent("No se pudo eliminar la publicación."));
    expect(screen.getByTestId("publicacion-52")).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog", { name: "Confirmar eliminación" })).not.toBeInTheDocument();
    expect(mocks.refrescar).not.toHaveBeenCalled();
  });

  it("abre y cierra el drawer de alta conservando las tarjetas", () => {
    renderMiMercado([crearPublicacion(1, 10, "Manzana")]);

    expect(screen.queryByRole("dialog", { name: "Nueva publicación" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));

    expect(screen.getByRole("dialog", { name: "Nueva publicación" })).toHaveAttribute("data-operador", "9");
    expect(screen.getByTestId("publicacion-1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cerrar alta" }));

    expect(screen.queryByRole("dialog", { name: "Nueva publicación" })).not.toBeInTheDocument();
    expect(screen.getByTestId("publicacion-1")).toBeInTheDocument();
  });

  it("incorpora una nueva publicación sin recargar la página y conserva los filtros", async () => {
    const inicial = crearPublicacion(1, 10, "Manzana");
    const nueva = crearPublicacion(2, 20, "Pera");
    mocks.cargarPublicaciones.mockResolvedValue([inicial, nueva]);
    renderMiMercado([inicial]);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar publicaciones" }), { target: { value: "Pera" } });
    expect(screen.queryByTestId("publicacion-1")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nueva publicación" }));
    fireEvent.click(screen.getByRole("button", { name: "Guardar alta simulada" }));

    await waitFor(() => expect(screen.getByTestId("publicacion-2")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Publicación creada correctamente.");
    expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toHaveValue("Pera");
    expect(screen.queryByRole("dialog", { name: "Nueva publicación" })).not.toBeInTheDocument();
    expect(mocks.cargarPublicaciones).toHaveBeenCalledExactlyOnceWith(9);
    expect(mocks.refrescar).toHaveBeenCalledOnce();
  });

  it("muestra el listado de publicaciones del operador", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 20, "Pera"),
    ]);

    expect(
      screen.getByTestId("publicacion-1"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("publicacion-2"),
    ).toBeInTheDocument();
  });

  it("muestra los filtros compartidos y agrupa por especie de A a Z desde el inicio", () => {
    renderMiMercado([
      crearPublicacion(1, 20, "Pera"),
      crearPublicacion(2, 30, "Sandía"),
      crearPublicacion(3, 10, "Manzana"),
    ]);

    expect(screen.getByRole("searchbox", { name: "Buscar publicaciones" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Especie" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Precio Mínimo" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Precio Máximo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Más filtros" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ordenar por" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Desagrupar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent)).toEqual(["Manzana", "Pera", "Sandía"]);
  });

  it("filtra al escribir sin distinguir mayúsculas ni tildes y restaura las tarjetas al limpiar", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Banana"),
      crearPublicacion(2, 20, "Sandía"),
      crearPublicacion(3, 30, "Pera"),
    ]);
    const buscador = screen.getByRole("searchbox", { name: "Buscar publicaciones" });

    fireEvent.change(buscador, { target: { value: "SANDIA" } });
    expect(idsTarjetas()).toEqual(["publicacion-2"]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent)).toEqual(["Sandía"]);

    fireEvent.change(buscador, { target: { value: "sin coincidencias" } });
    expect(screen.queryAllByTestId(/^publicacion-/)).toHaveLength(0);
    expect(screen.getByText("No hay publicaciones que coincidan con la búsqueda.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Limpiar filtros" }));
    expect(buscador).toHaveValue("");
    expect(idsTarjetas()).toEqual(["publicacion-1", "publicacion-3", "publicacion-2"]);
  });

  it("combina especie con precio mínimo y máximo sobre las tarjetas del operador", () => {
    renderMiMercado([
      crearPublicacionConPrecio(1, 20, "Pera", "80"),
      crearPublicacionConPrecio(2, 10, "Manzana", "70"),
      crearPublicacionConPrecio(3, 20, "Pera", "20"),
      crearPublicacionConPrecio(4, 10, "Manzana", "150"),
      crearPublicacionConPrecio(5, 20, "Pera", "140"),
    ]);

    fireEvent.mouseDown(screen.getByRole("combobox", { name: "Especie" }));
    fireEvent.click(screen.getByRole("option", { name: "Pera" }));
    expect(idsTarjetas()).toEqual(["publicacion-1", "publicacion-3", "publicacion-5"]);

    fireEvent.change(screen.getByRole("textbox", { name: "Precio Mínimo" }), { target: { value: "30" } });
    expect(idsTarjetas()).toEqual(["publicacion-1", "publicacion-5"]);

    fireEvent.change(screen.getByRole("textbox", { name: "Precio Máximo" }), { target: { value: "90" } });
    expect(idsTarjetas()).toEqual(["publicacion-1"]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent)).toEqual(["Pera"]);
  });

  it("ordena por precio dentro de cada especie y conserva los grupos de A a Z", () => {
    renderMiMercado([
      crearPublicacionConPrecio(1, 20, "Pera", "80"),
      crearPublicacionConPrecio(2, 10, "Manzana", "70"),
      crearPublicacionConPrecio(3, 20, "Pera", "20"),
      crearPublicacionConPrecio(4, 10, "Manzana", "150"),
    ]);

    elegirOrden("Menor Precio");
    expect(screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent)).toEqual(["Manzana", "Pera"]);
    expect(idsTarjetas()).toEqual(["publicacion-2", "publicacion-4", "publicacion-3", "publicacion-1"]);

    elegirOrden("Mayor Precio");
    expect(screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent)).toEqual(["Manzana", "Pera"]);
    expect(idsTarjetas()).toEqual(["publicacion-4", "publicacion-2", "publicacion-1", "publicacion-3"]);
  });

  it("invierte el orden de los grupos al elegir Z-A", () => {
    renderMiMercado([
      crearPublicacion(1, 20, "Pera"),
      crearPublicacion(2, 30, "Sandía"),
      crearPublicacion(3, 10, "Manzana"),
    ]);

    elegirOrden("Z-A");
    expect(screen.getAllByRole("heading", { level: 3 }).map((titulo) => titulo.textContent)).toEqual(["Sandía", "Pera", "Manzana"]);
  });

  it("ordena globalmente las tarjetas desagrupadas por especie o precio", () => {
    renderMiMercado([
      crearPublicacionConPrecio(1, 20, "Pera", "80"),
      crearPublicacionConPrecio(2, 10, "Manzana", "70"),
      crearPublicacionConPrecio(3, 20, "Pera", "20"),
      crearPublicacionConPrecio(4, 10, "Manzana", "150"),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Desagrupar" }));
    expect(screen.getByRole("button", { name: "Agrupar por especie" })).toHaveAttribute("aria-pressed", "false");
    expect(idsTarjetas()).toEqual(["publicacion-2", "publicacion-4", "publicacion-1", "publicacion-3"]);

    elegirOrden("Menor Precio");
    expect(idsTarjetas()).toEqual(["publicacion-3", "publicacion-2", "publicacion-1", "publicacion-4"]);

    elegirOrden("Mayor Precio");
    expect(idsTarjetas()).toEqual(["publicacion-4", "publicacion-1", "publicacion-2", "publicacion-3"]);
  });


  it("muestra las tarjetas directamente cuando no está agrupado", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 20, "Pera"),
    ]);

    const boton = screen.getByRole(
      "button",
      {
        name: "Desagrupar",
      },
    );

    fireEvent.click(boton);

    expect(
      screen.getByTestId("publicacion-1"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("publicacion-2"),
    ).toBeInTheDocument();
  });


  it("agrupa las publicaciones por especie", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 10, "Manzana"),
      crearPublicacion(3, 20, "Pera"),
    ]);

    expect(
      screen.getAllByText("Manzana"),
    ).toHaveLength(1);

    expect(
      screen.getAllByText("Pera"),
    ).toHaveLength(1);

    expect(
      screen.getByText("· 2 publicaciones"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("· 1 publicación"),
    ).toBeInTheDocument();
  });


  it("permite desagrupar y volver a agrupar publicaciones por especie", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 10, "Manzana"),
      crearPublicacion(3, 20, "Pera"),
    ]);

    const botonDesagrupar =
      screen.getByRole(
        "button",
        {
          name: "Desagrupar",
        },
      );

    expect(
      botonDesagrupar,
    ).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(
      botonDesagrupar,
    );


    const botonAgrupar =
      screen.getByRole(
        "button",
        {
          name: "Agrupar por especie",
        },
      );

    expect(
      botonAgrupar,
    ).toHaveAttribute(
      "aria-pressed",
      "false",
    );

    fireEvent.click(
      botonAgrupar,
    );


    expect(
      screen.getByRole(
        "button",
        {
          name: "Desagrupar",
        },
      ),
    ).toBeInTheDocument();
  });


  it("mantiene todas las publicaciones al agrupar por especie", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 10, "Manzana"),
      crearPublicacion(3, 20, "Pera"),
    ]);

    expect(
      screen.getByTestId("publicacion-1"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("publicacion-2"),
    ).toBeInTheDocument();

    expect(
      screen.getByTestId("publicacion-3"),
    ).toBeInTheDocument();
  });


  it("mantiene grupos separados cuando las especies son diferentes", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 20, "Pera"),
    ]);

    expect(
      screen.getByText("Manzana"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Pera"),
    ).toBeInTheDocument();
  });


  it("muestra la cantidad total de publicaciones", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
      crearPublicacion(2, 20, "Pera"),
    ]);

    expect(
      screen.getAllByText("2 publicaciones"),
    ).toHaveLength(2);
  });


  it("muestra publicación en singular cuando existe una sola", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
    ]);

    expect(
      screen.getAllByText("1 publicación"),
    ).toHaveLength(2);
  });


  it("muestra un mensaje cuando el operador no tiene publicaciones", () => {
    renderMiMercado([]);

    expect(
      screen.getByText(
        "No tenés publicaciones",
      ),
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        "Cuando tengas productos publicados aparecerán acá.",
      ),
    ).toBeInTheDocument();
  });


  it("no muestra tarjetas cuando no hay publicaciones", () => {
    renderMiMercado([]);

    expect(
      screen.queryByTestId(
        /^publicacion-/,
      ),
    ).not.toBeInTheDocument();
  });


  it("pasa correctamente incrementoPrecio=15 a las tarjetas", () => {
    renderMiMercado(
      [
        crearPublicacion(1, 10, "Manzana"),
      ],
      15,
    );

    expect(
      screen.getByTestId("publicacion-1"),
    ).toHaveAttribute(
      "data-incremento",
      "15",
    );
  });


  it("pasa correctamente incrementoPrecio=-15 a las tarjetas", () => {
    renderMiMercado(
      [
        crearPublicacion(1, 10, "Manzana"),
      ],
      -15,
    );

    expect(
      screen.getByTestId("publicacion-1"),
    ).toHaveAttribute(
      "data-incremento",
      "-15",
    );
  });


  it("pasa correctamente incrementoPrecio=0 a las tarjetas", () => {
    renderMiMercado(
      [
        crearPublicacion(1, 10, "Manzana"),
      ],
      0,
    );

    expect(
      screen.getByTestId("publicacion-1"),
    ).toHaveAttribute(
      "data-incremento",
      "0",
    );
  });


  it("actualiza las publicaciones cuando cambian las props", () => {
    const { rerender } = render(
      <MiMercado
        operadorId={9}
        publicaciones={[
          crearPublicacion(1, 10, "Manzana"),
        ]}
        incrementoPrecio={5}
        opcionesEdicion={{ especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [] }}
      />,
    );

    expect(
      screen.getByTestId("publicacion-1"),
    ).toBeInTheDocument();

    rerender(
      <MiMercado
        operadorId={9}
        publicaciones={[
          crearPublicacion(2, 20, "Pera"),
        ]}
        incrementoPrecio={5}
        opcionesEdicion={{ especies: [], variedades: [], presentaciones: [], categorias: [], calibres: [], paises: [] }}
      />,
    );

    expect(
      screen.getByTestId("publicacion-2"),
    ).toBeInTheDocument();
  });
});
