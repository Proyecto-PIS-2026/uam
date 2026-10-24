import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TarjetaPublicacion from "./TarjetaPublicacion";
import type { Publicacion } from "../tipos";
import { actualizarPrecio, incrementarPrecio } from "../acciones";

vi.mock("../acciones", () => ({
  actualizarPrecio: vi.fn(),
  incrementarPrecio: vi.fn(),
}));

vi.mock("next/image", async () => {
    const { createElement } = await import("react");
    return {
        default: ({src, alt, onLoad, onError, style}: {
            src: string;
            alt: string;
            onLoad?: React.ReactEventHandler<HTMLImageElement>;
            onError?: React.ReactEventHandler<HTMLImageElement>;
            style?: React.CSSProperties;
        }) => createElement("img", {src, alt, onLoad, onError, style})
    };
});

function crearPublicacion(): Publicacion {
  return {
    id: 1,
    publicacionOperadorId: 1,
    version: 1,
    paisId: 44,
    foto: null,
    precio: "100",
    fecha: "2026-10-03T15:00:00.000Z",
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacion: {
      id: 1,
      nombrePresentacion: "Caja",
      variedad: {
        id: 1,
        nombreVariedad: "Red Delicious",
        especie: {
          id: 10,
          nombreEspecie: "Manzana",
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
      codigoCalibre: "A",
      nombreCalibre: "Grande",
    },
  };
}

describe("TarjetaPublicacion", () => {
  beforeEach(() => {
      vi.resetAllMocks();
      vi.mocked(incrementarPrecio).mockImplementation(async (_id, delta) => ({ publicacionEliminada: false, precio: 100 + delta, version: 2, fecha: "2026-10-10T16:30:00Z" }));
      vi.mocked(actualizarPrecio).mockImplementation(async (_id, precio) => ({
          publicacionEliminada: false, precio, version: 2,
          fecha: "2026-10-10T16:30:00Z",
      }));
  });

  it("muestra los datos principales de la publicación", () => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    expect(
      screen.getByText("Manzana · Red Delicious"),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Cat\.\s*Primera/),
    ).toBeInTheDocument();

    expect(screen.getByText(/Grande/)).toBeInTheDocument();
    expect(screen.getByText(/Caja/)).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("muestra no disponible cuando la publicación no está disponible", () => {
    const pub = crearPublicacion();
    pub.publicacionDisponible = false;

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText("No disponible"),
    ).toBeInTheDocument();
  });

  it("no muestra la variedad cuando es guion", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "-";

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();

    expect(
      screen.queryByText("Manzana · -"),
    ).not.toBeInTheDocument();
  });

  it("no muestra la variedad cuando está vacía", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "";

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("no muestra la variedad cuando contiene solamente espacios", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "   ";

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("muestra guion cuando faltan calibre categoría y presentación", () => {
    const pub = crearPublicacion();

    pub.calibre.nombreCalibre = "";
    pub.categoria.nombreCategoria = "";
    pub.presentacion.nombrePresentacion = "";

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText(/Cat\.\s*-/),
    ).toBeInTheDocument();
  });

  it("muestra la fotografía propia de la publicación cuando existe", () => {
    const pub = crearPublicacion();
    pub.foto = "/producto.jpg";
    pub.presentacion.variedad.especie.fotoEspecie = "/especie.jpg";
    render(<TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />);
    fireEvent.load(screen.getByAltText("Manzana · Red Delicious"));
    expect(screen.getByRole("img", { name: "Manzana · Red Delicious" })).toHaveAttribute("src", expect.stringContaining("/producto.jpg"));
  });

  it("muestra el reemplazo si la URL de la foto ya no existe", () => {
    const pub = crearPublicacion();
    pub.foto = "/api/publicaciones/imagenes/1/foto-perdida.jpg";
    render(<TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />);
    fireEvent.error(screen.getByAltText("Manzana · Red Delicious"));
    expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Manzana · Red Delicious" })).not.toBeInTheDocument();
  });

  it("muestra sin fotografía aunque la especie tenga una imagen", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie =
      "/especie.jpg";

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Manzana" })).not.toBeInTheDocument();
  });

  it("muestra sin fotografía cuando no existe ninguna imagen", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie = null;

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText("Sin fotografía"),
    ).toBeInTheDocument();
  });

  it("muestra sin precio cuando el precio es nulo", () => {
    const pub = crearPublicacion();
    pub.precio = null;

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText("Sin precio"),
    ).toBeInTheDocument();
  });

  it("aumenta el precio con el botón", async () => {
    const alPrecioActualizado = vi.fn();
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
        alPrecioActualizado={alPrecioActualizado}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Aumentar precio",
      }),
    );

    await waitFor(() => expect(screen.getByText("$110")).toBeInTheDocument());

    expect(incrementarPrecio).toHaveBeenCalledWith(
      1,
      10,
      37,
    );
    expect(alPrecioActualizado).toHaveBeenCalledExactlyOnceWith(1, 110, "2026-10-10T16:30:00Z", 2);
  });

  it("recarga la página sin mostrar error si otra persona eliminó la publicación", async () => {
    vi.mocked(incrementarPrecio).mockResolvedValueOnce({ publicacionEliminada: true });
    const alPublicacionEliminada = vi.fn();
    render(<TarjetaPublicacion puedeModificar={true} pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} alPublicacionEliminada={alPublicacionEliminada} />);

    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));

    await waitFor(() => expect(alPublicacionEliminada).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra un error si falla el servidor al guardar el precio", async () => {
    vi.mocked(incrementarPrecio).mockRejectedValueOnce(
      new Error("No se pudo guardar el precio."),
    );
    render(
      <TarjetaPublicacion
        puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "No se pudo guardar el precio.",
      );
    });
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("conserva la fecha confirmada y revierte el precio si falla el siguiente cambio", async () => {
    const fechaGuardada = "2026-10-10T17:15:00Z";
    let confirmarPrimero: () => void = () => undefined;
    vi.mocked(incrementarPrecio)
      .mockImplementationOnce(() => new Promise<Awaited<ReturnType<typeof incrementarPrecio>>>((resolve) => {
        confirmarPrimero = () => resolve({ publicacionEliminada: false, precio: 110, version: 2, fecha: fechaGuardada });
      }))
      .mockRejectedValueOnce(new Error("No se pudo guardar el segundo cambio."));
    const alPrecioActualizado = vi.fn();
    render(<TarjetaPublicacion puedeModificar={true} pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} alPrecioActualizado={alPrecioActualizado} />);

    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));
    expect(screen.getByRole("button", { name: "Aumentar precio" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Disminuir precio" })).toBeEnabled();
    expect(screen.getByTitle("Editar precio")).toBeDisabled();
    expect(alPrecioActualizado).not.toHaveBeenCalled();

    await act(async () => confirmarPrimero());
    expect(alPrecioActualizado).toHaveBeenCalledExactlyOnceWith(1, 110, fechaGuardada, 2);
    expect(screen.getByRole("button", { name: "Aumentar precio" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar el segundo cambio."));
    expect(incrementarPrecio).toHaveBeenNthCalledWith(1, 1, 10, 37);
    expect(incrementarPrecio).toHaveBeenNthCalledWith(2, 1, 10, 37);
    expect(screen.getByText("$110")).toBeInTheDocument();
    expect(alPrecioActualizado).toHaveBeenCalledOnce();
  });

  it("disminuye el precio con el botón", async () => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disminuir precio",
      }),
    );

    await waitFor(() => expect(screen.getByText("$90")).toBeInTheDocument());

    expect(incrementarPrecio).toHaveBeenCalledWith(
      1,
      -10,
      37,
    );
  });

  it("no permite disminuir el precio hasta cero", () => {
    const pub = crearPublicacion();
    pub.precio = "5";

    render(
      <TarjetaPublicacion
        puedeModificar={true}
        pub={pub}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Disminuir precio" }));

    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(incrementarPrecio).not.toHaveBeenCalled();
  });

  it("permite editar manualmente el precio", async () => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    fireEvent.change(input, {
      target: {
        value: "150",
      },
    });

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    await waitFor(() => expect(screen.getByText("$150")).toBeInTheDocument());

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      150,
      37,
      1,
    );
  });

  it.each(["0", "00", "125,5", "125.5", "+125", "1e3"])("rechaza el precio inválido %s al escribirlo", (precioDecimal) => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    fireEvent.change(input, {
      target: {
        value: precioDecimal,
      },
    });

    expect(input).toHaveValue("100");

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("cancela la edición manual con Escape", () => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    fireEvent.change(input, {
      target: {
        value: "500",
      },
    });

    fireEvent.keyDown(input, {
      key: "Escape",
    });

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it.each(["blur", "Enter"])("guarda null al confirmar un precio manual vacío con %s", async (accion) => {
    const alPrecioActualizado = vi.fn();
    const alConsultar = vi.fn();
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
        alPrecioActualizado={alPrecioActualizado}
        alConsultar={alConsultar}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    fireEvent.change(input, {
      target: {
        value: "",
      },
    });

    expect(input).toHaveValue("");

    if (accion === "blur") fireEvent.blur(input);
    else fireEvent.keyDown(input, { key: "Enter" });

    await waitFor(() => expect(alPrecioActualizado).toHaveBeenCalledExactlyOnceWith(1, null, "2026-10-10T16:30:00Z", 2));
    expect(actualizarPrecio).toHaveBeenCalledExactlyOnceWith(1, null, 37, 1);
    expect(screen.getByText("Sin precio")).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole("button", { name: "Ver detalle de Manzana · Red Delicious" })[0]);
    expect(alConsultar).toHaveBeenCalledWith(expect.objectContaining({ precio: null, version: 2 }));
  });

  it("edita un precio nulo como vacío y permite aumentarlo con el incremento configurado", async () => {
    const pub = { ...crearPublicacion(), precio: null };
    vi.mocked(incrementarPrecio).mockResolvedValueOnce({ publicacionEliminada: false, precio: 10, version: 2, fecha: pub.fecha });
    render(<TarjetaPublicacion puedeModificar pub={pub} incrementoPrecio={10} operadorId={37} />);
    fireEvent.click(screen.getByTitle("Editar precio"));
    expect(screen.getByRole("textbox", { name: "Editar precio" })).toHaveValue("");
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editar precio" }), { key: "Enter" });
    expect(actualizarPrecio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Disminuir precio" }));
    expect(incrementarPrecio).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));
    await waitFor(() => expect(screen.getByTitle("Editar precio")).toBeEnabled());
    expect(incrementarPrecio).toHaveBeenCalledExactlyOnceWith(1, 10, 37);
    expect(screen.getByText("$10")).toBeInTheDocument();
  });

  it("restaura el precio anterior cuando falla el guardado de null", async () => {
    vi.mocked(actualizarPrecio).mockRejectedValueOnce(new Error("No se pudo quitar el precio."));
    render(<TarjetaPublicacion puedeModificar pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />);
    fireEvent.click(screen.getByTitle("Editar precio"));
    const input = screen.getByRole("textbox", { name: "Editar precio" });
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo quitar el precio."));
    expect(screen.getByText("$100")).toBeInTheDocument();
  });

  it("impide escribir un precio manual negativo", () => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    fireEvent.change(input, {
      target: {
        value: "-50",
      },
    });

    expect(input).toHaveValue("100");

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("impide escribir un precio manual no numérico", () => {
    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={crearPublicacion()}
        incrementoPrecio={10}
        operadorId={37}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    fireEvent.change(input, {
      target: {
        value: "abc",
      },
    });

    expect(input).toHaveValue("100");

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("no guarda el precio cuando no se modificó", () => {
    render(
      <TarjetaPublicacion puedeModificar={true} pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />,
    );

    fireEvent.click(screen.getByTitle("Editar precio"));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editar precio" }), { key: "Enter" });

    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("impide escribir precios de más de diez dígitos", () => {
    render(
      <TarjetaPublicacion puedeModificar={true} pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />,
    );

    fireEvent.click(screen.getByTitle("Editar precio"));
    const input = screen.getByRole("textbox", { name: "Editar precio" });
    fireEvent.change(input, { target: { value: "10000000000" } });

    expect(input).toHaveValue("100");

    fireEvent.keyDown(input, { key: "Enter" });

    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it.each([
    { elemento: "fotografía", indice: 0 },
    { elemento: "flecha", indice: 1 },
  ])("consulta la publicación al seleccionar la $elemento", ({ indice }) => {
    const pub = crearPublicacion();
    const alConsultar = vi.fn();

    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={pub}
        incrementoPrecio={10}
        operadorId={37}
        alConsultar={alConsultar}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Ver detalle de Manzana · Red Delicious",
      })[indice],
    );

    expect(alConsultar).toHaveBeenCalledWith(pub);
    expect(alConsultar).toHaveBeenCalledTimes(1);
  });

  it("consulta la publicación al seleccionar su información", () => {
    const pub = crearPublicacion();
    const alConsultar = vi.fn();

    render(
      <TarjetaPublicacion puedeModificar={true}
        pub={pub}
        incrementoPrecio={10}
        operadorId={37}
        alConsultar={alConsultar}
      />,
    );

    fireEvent.click(screen.getByText("Manzana · Red Delicious"));

    expect(alConsultar).toHaveBeenCalledWith(pub);
  });

  it("conserva el precio nulo al consultar una publicación sin precio", () => {
    const pub = crearPublicacion();
    pub.precio = null;
    const alConsultar = vi.fn();

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} alConsultar={alConsultar} />,
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Ver detalle de Manzana · Red Delicious",
      })[0],
    );

    expect(alConsultar).toHaveBeenCalledWith(expect.objectContaining({ precio: null }));
  });

  it("consulta con el precio actualizado desde la tarjeta", async () => {
    const pub = crearPublicacion();
    const alConsultar = vi.fn();

    render(
      <TarjetaPublicacion puedeModificar={true} pub={pub} incrementoPrecio={10} operadorId={37} alConsultar={alConsultar} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Aumentar precio",
      }),
    );

    await waitFor(() => expect(screen.getByText("$110")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Manzana · Red Delicious"));

    expect(alConsultar).toHaveBeenCalledWith({ ...pub, precio: "110", version: 2, fecha: "2026-10-10T16:30:00Z" });
  });

  it("permite consultar la publicación mientras se guarda el precio", async () => {
      let finalizarGuardado: () => void = () => undefined;
      vi.mocked(incrementarPrecio).mockImplementationOnce(
          () =>
              new Promise<Awaited<ReturnType<typeof incrementarPrecio>>>((resolve) => {
                  finalizarGuardado = () =>
                      resolve({ publicacionEliminada: false, precio: 110, version: 2, fecha: "2026-10-10T16:30:00Z" });
              })
      );
      const alConsultar = vi.fn();
      render(
          <TarjetaPublicacion puedeModificar={true}
              pub={crearPublicacion()}
              incrementoPrecio={10}
              operadorId={37}
              alConsultar={alConsultar}
          />
      );
      fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));
      fireEvent.click(screen.getByText("Manzana · Red Delicious"));
      expect(alConsultar).toHaveBeenCalledWith(expect.objectContaining({ precio: "110" }));
      finalizarGuardado();
      await waitFor(() => {expect(incrementarPrecio).toHaveBeenCalledOnce()});
  });
  it("deshabilita los cambios de precio sin permiso de modificar", () => {
    render(<TarjetaPublicacion puedeModificar={false} pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />);

    expect(screen.getByRole("button", { name: "Aumentar precio" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Disminuir precio" })).toBeDisabled();
    expect(screen.getByTitle("Editar precio")).toBeDisabled();
    fireEvent.click(screen.getByTitle("Editar precio"));
    expect(screen.queryByRole("textbox", { name: "Editar precio" })).not.toBeInTheDocument();
  });

  it("envía la versión al comenzar la edición y muestra el precio actual si hay conflicto", async () => {
    const pub = crearPublicacion();
    const propiedades = { puedeModificar: true, incrementoPrecio: 10, operadorId: 37 };
    const vista = render(<TarjetaPublicacion {...propiedades} pub={pub} />);
    fireEvent.click(screen.getByTitle("Editar precio"));
    fireEvent.change(screen.getByRole("textbox", { name: "Editar precio" }), { target: { value: "150" } });
    vista.rerender(<TarjetaPublicacion {...propiedades} pub={{ ...pub, precio: "120", version: 2 }} />);
    vi.mocked(actualizarPrecio).mockResolvedValueOnce({ publicacionEliminada: false, conflicto: true, precio: 120, version: 2, fecha: pub.fecha });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editar precio" }), { key: "Enter" });
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("cambió en otra sesión"));
    expect(actualizarPrecio).toHaveBeenCalledExactlyOnceWith(1, 150, 37, 1);
    expect(screen.getByText("$120")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("$120")).toBeInTheDocument();
  });

  it("aplica los incrementos a partir del precio recibido por una actualización remota", async () => {
    const propiedades = { puedeModificar: true, incrementoPrecio: 10, operadorId: 37 };
    const vista = render(<TarjetaPublicacion {...propiedades} pub={crearPublicacion()} />);
    vista.rerender(<TarjetaPublicacion {...propiedades} pub={{ ...crearPublicacion(), precio: "200", version: 5 }} />);
    vi.mocked(incrementarPrecio).mockResolvedValueOnce({ publicacionEliminada: false, precio: 210, version: 6, fecha: "2026-10-16T12:00:00Z" });
    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));
    await waitFor(() => expect(screen.getByText("$210")).toBeInTheDocument());
    expect(incrementarPrecio).toHaveBeenCalledExactlyOnceWith(1, 10, 37);
  });

  it("acumula tres clics rápidos sin perder incrementos", async () => {
    let confirmar!: () => void;
    vi.mocked(incrementarPrecio)
      .mockImplementationOnce(() => new Promise((resolve) => { confirmar = () => resolve({ publicacionEliminada: false, precio: 110, version: 2, fecha: "2026-10-16T12:00:00Z" }); }))
      .mockResolvedValueOnce({ publicacionEliminada: false, precio: 130, version: 3, fecha: "2026-10-16T12:00:01Z" });
    render(<TarjetaPublicacion pub={crearPublicacion()} puedeModificar={true} incrementoPrecio={10} operadorId={37} />);
    const boton = screen.getByRole("button", { name: "Aumentar precio" });
    fireEvent.click(boton);
    fireEvent.click(boton);
    fireEvent.click(boton);
    expect(screen.getByText("$130")).toBeInTheDocument();
    await act(async () => confirmar());
    expect(incrementarPrecio).toHaveBeenNthCalledWith(1, 1, 10, 37);
    expect(incrementarPrecio).toHaveBeenNthCalledWith(2, 1, 20, 37);
    expect(screen.getByText("$130")).toBeInTheDocument();
  });

});
