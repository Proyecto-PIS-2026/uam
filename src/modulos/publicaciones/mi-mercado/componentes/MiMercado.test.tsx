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
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refrescar, replace: mocks.reemplazar }) }));

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
    operadorId,
  }: {
    abierto: boolean;
    alCerrar: () => void;
    operadorId: number;
  }) => abierto ? (
    <div role="dialog" aria-label="Nueva publicación" data-operador={operadorId}>
      <button type="button" onClick={alCerrar}>Cerrar alta</button>
    </div>
  ) : null,
}));

vi.mock("./TarjetaPublicacion", () => ({
  default: ({
    pub,
    incrementoPrecio,
    alConsultar,
  }: {
    pub: Publicacion;
    incrementoPrecio: number;
    alConsultar?: (publicacion: Publicacion) => void;
  }) => (
    <div
      data-testid={`publicacion-${pub.id}`}
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

describe("MiMercado", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.solicitud.mockReset();
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

    await act(async () => {
      await propsIniciales.alGuardar(13, cambios, archivo);
    });

    expect(mocks.solicitud).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/52", { method: "PATCH", body: expect.any(FormData) });
    const solicitud = mocks.solicitud.mock.lastCall;
    if (!solicitud) throw new Error("No se envió la modificación.");
    const cuerpo = solicitud[1].body as FormData;
    expect(cuerpo.get("cambios")).toBe(JSON.stringify(cambios));
    expect(cuerpo.get("fotografia")).toMatchObject({ name: "pera.webp", type: "image/webp" });
    expect(mocks.refrescar).toHaveBeenCalledOnce();
    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toHaveAttribute("data-modo", "consulta");
    expect(screen.getByRole("dialog", { name: "Publicación seleccionada" })).toHaveAttribute("data-actualizando", "true");

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

  it("borra la publicación seleccionada y cierra la consulta después del éxito", async () => {
    mocks.solicitud.mockResolvedValue({
      ok: true,
      json: async () => ({ mensaje: "Publicación eliminada." }),
    });
    renderMiMercado([crearPublicacion(52, 10, "Manzana")]);
    fireEvent.click(screen.getByRole("button", { name: "Consultar publicación 52" }));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar desde consulta" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar baja" }));

    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Publicación seleccionada" })).not.toBeInTheDocument());
    expect(mocks.solicitud).toHaveBeenCalledExactlyOnceWith("/api/publicaciones/52", { method: "DELETE" });
    expect(screen.queryByTestId("publicacion-52")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Publicación eliminada.");
    expect(mocks.refrescar).toHaveBeenCalledOnce();
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
      screen.getByText("2 publicaciones"),
    ).toBeInTheDocument();
  });


  it("muestra publicación en singular cuando existe una sola", () => {
    renderMiMercado([
      crearPublicacion(1, 10, "Manzana"),
    ]);

    expect(
      screen.getByText("1 publicación"),
    ).toBeInTheDocument();
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
