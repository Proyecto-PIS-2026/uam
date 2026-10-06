import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import TarjetaPublicacion from "./TarjetaPublicacion";
import type { Publicacion } from "./MiMercado";
import { actualizarPrecio } from "../acciones";

vi.mock("../acciones", () => ({
  actualizarPrecio: vi.fn(),
}));

function crearPublicacion(): Publicacion {
  return {
    id: 1,
    publicacionOperadorId: 1,
    paisId: 44,
    foto: null,
    precio: "100",
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
    vi.clearAllMocks();
  });

  it("muestra los datos principales de la publicación", () => {
    render(
      <TarjetaPublicacion
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText("No disponible"),
    ).toBeInTheDocument();
  });

  it("no muestra la variedad cuando es guion", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "-";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("no muestra la variedad cuando contiene solamente espacios", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "   ";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("muestra guion cuando faltan calibre categoría y presentación", () => {
    const pub = crearPublicacion();

    pub.calibre.nombreCalibre = "";
    pub.categoria.nombreCategoria = "";
    pub.presentacion.nombrePresentacion = "";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText(/Cat\.\s*-/),
    ).toBeInTheDocument();
  });

  it("muestra la fotografía propia de la publicación cuando existe", () => {
    const pub = crearPublicacion();

    pub.foto = "/producto.jpg";
    pub.presentacion.variedad.especie.fotoEspecie =
      "/especie.jpg";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByRole("img", {
        name: "Manzana · Red Delicious",
      }),
    ).toHaveAttribute("src", expect.stringContaining("/producto.jpg"));
  });

  it("muestra el reemplazo si la URL de la foto ya no existe", () => {
    const pub = crearPublicacion();
    pub.foto = "/api/publicaciones/imagenes/1/foto-perdida.jpg";
    render(<TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />);

    fireEvent.error(screen.getByRole("img", { name: "Manzana · Red Delicious" }));

    expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Manzana · Red Delicious" })).not.toBeInTheDocument();
  });

  it("muestra sin fotografía aunque la especie tenga una imagen", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie =
      "/especie.jpg";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(screen.getByText("Sin fotografía")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Manzana" })).not.toBeInTheDocument();
  });

  it("muestra sin fotografía cuando no existe ninguna imagen", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie = null;

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText("Sin fotografía"),
    ).toBeInTheDocument();
  });

  it("muestra sin precio cuando el precio es nulo", () => {
    const pub = crearPublicacion();
    pub.precio = null;

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    expect(
      screen.getByText("Sin precio"),
    ).toBeInTheDocument();
  });

  it("aumenta el precio con el botón", async () => {
    const alPrecioActualizado = vi.fn();
    render(
      <TarjetaPublicacion
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

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      110,
      37,
    );
    expect(alPrecioActualizado).toHaveBeenCalledOnce();
  });

  it("recarga la página sin mostrar error si otra persona eliminó la publicación", async () => {
    vi.mocked(actualizarPrecio).mockResolvedValueOnce({ publicacionEliminada: true });
    const alPublicacionEliminada = vi.fn();
    render(<TarjetaPublicacion pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} alPublicacionEliminada={alPublicacionEliminada} />);

    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));

    await waitFor(() => expect(alPublicacionEliminada).toHaveBeenCalledOnce());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("muestra un mensaje breve si falla el servidor al guardar el precio", async () => {
    vi.mocked(actualizarPrecio).mockRejectedValueOnce(new Error("Minified React error #441"));
    const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      render(<TarjetaPublicacion pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />);
      fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));

      await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar el precio. Intentá de nuevo."));
      expect(screen.queryByText(/Minified React error/)).not.toBeInTheDocument();
    } finally {
      registrarError.mockRestore();
    }
  });

  it("disminuye el precio con el botón", async () => {
    render(
      <TarjetaPublicacion
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

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      90,
      37,
    );
  });

  it("no permite disminuir el precio hasta cero", () => {
    const pub = crearPublicacion();
    pub.precio = "5";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disminuir precio",
      }),
    );

    expect(screen.getByText("$5")).toBeInTheDocument();
    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("permite editar manualmente el precio", async () => {
    render(
      <TarjetaPublicacion
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
    );
  });

  it.each(["125,5", "125.5"])("rechaza el precio decimal %s al escribirlo", (precioDecimal) => {
    render(
      <TarjetaPublicacion
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
      <TarjetaPublicacion
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

  it("descarta un precio manual vacío", () => {
    render(
      <TarjetaPublicacion
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
        value: "",
      },
    });

    expect(input).toHaveValue("");

    fireEvent.blur(input);

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("impide escribir un precio manual negativo", () => {
    render(
      <TarjetaPublicacion
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
      <TarjetaPublicacion
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
      <TarjetaPublicacion pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />,
    );

    fireEvent.click(screen.getByTitle("Editar precio"));
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Editar precio" }), { key: "Enter" });

    expect(screen.getByText("$100")).toBeInTheDocument();
    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("impide escribir precios de más de diez dígitos", () => {
    render(
      <TarjetaPublicacion pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} />,
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
      <TarjetaPublicacion
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
      <TarjetaPublicacion
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} alConsultar={alConsultar} />,
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} operadorId={37} alConsultar={alConsultar} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Aumentar precio",
      }),
    );

    await waitFor(() => expect(screen.getByText("$110")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Manzana · Red Delicious"));

    expect(alConsultar).toHaveBeenCalledWith({ ...pub, precio: "110" });
  });

  it("no consulta mientras se está guardando el precio", async () => {
    let finalizarGuardado: () => void = () => undefined;
    vi.mocked(actualizarPrecio).mockImplementationOnce(() => new Promise<{ publicacionEliminada: boolean }>((resolve) => {
      finalizarGuardado = () => resolve({ publicacionEliminada: false });
    }));
    const alConsultar = vi.fn();

    render(
      <TarjetaPublicacion pub={crearPublicacion()} incrementoPrecio={10} operadorId={37} alConsultar={alConsultar} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aumentar precio" }));
    fireEvent.click(screen.getByText("Manzana · Red Delicious"));

    expect(alConsultar).not.toHaveBeenCalled();

    finalizarGuardado();
    await waitFor(() => expect(screen.getByText("$110")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Manzana · Red Delicious"));

    expect(alConsultar).toHaveBeenCalledWith(expect.objectContaining({ precio: "110" }));
  });
});
