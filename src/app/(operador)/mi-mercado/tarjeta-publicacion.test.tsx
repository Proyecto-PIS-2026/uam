import {
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import TarjetaPublicacion from "./tarjeta-publicacion";
import type { Publicacion } from "./mi-mercado";
import { actualizarPrecio } from "./actions";

vi.mock("./[id]/detalle-publicacion", () => ({
  default: ({ pub }: { pub: Publicacion }) => (
    <div data-testid="detalle-publicacion">
      Detalle {pub.id}
    </div>
  ),
}));

vi.mock("./actions", () => ({
  actualizarPrecio: vi.fn(),
}));

function crearPublicacion(): Publicacion {
  return {
    id: 1,
    foto: null,
    precio: "100",
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacion: {
      nombrePresentacion: "Caja",
      variedad: {
        nombreVariedad: "Red Delicious",
        especie: {
          id: 10,
          nombreEspecie: "Manzana",
          fotoEspecie: null,
        },
      },
    },
    categoria: {
      nombreCategoria: "Primera",
    },
    calibre: {
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(
      screen.getByText("No disponible"),
    ).toBeInTheDocument();
  });

  it("no muestra la variedad cuando es guion", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "-";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("no muestra la variedad cuando contiene solamente espacios", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "   ";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("muestra guion cuando faltan calibre categoría y presentación", () => {
    const pub = crearPublicacion();

    pub.calibre.nombreCalibre = "";
    pub.categoria.nombreCategoria = "";
    pub.presentacion.nombrePresentacion = "";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
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
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(
      screen.getByRole("img", {
        name: "Manzana · Red Delicious",
      }),
    ).toHaveAttribute("src", "/producto.jpg");
  });

  it("usa la fotografía de la especie cuando la publicación no tiene foto", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie =
      "/especie.jpg";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(
      screen.getByRole("img", {
        name: "Manzana",
      }),
    ).toHaveAttribute("src", "/especie.jpg");
  });

  it("muestra sin fotografía cuando no existe ninguna imagen", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie = null;

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(
      screen.getByText("Sin fotografía"),
    ).toBeInTheDocument();
  });

  it("muestra sin precio cuando el precio es nulo", () => {
    const pub = crearPublicacion();
    pub.precio = null;

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    expect(
      screen.getByText("Sin precio"),
    ).toBeInTheDocument();
  });

  it("aumenta el precio con el botón", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Aumentar precio",
      }),
    );

    expect(screen.getByText("$110")).toBeInTheDocument();

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      110,
    );
  });

  it("disminuye el precio con el botón", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disminuir precio",
      }),
    );

    expect(screen.getByText("$90")).toBeInTheDocument();

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      90,
    );
  });

  it("no permite disminuir el precio por debajo de cero", () => {
    const pub = crearPublicacion();
    pub.precio = "5";

    render(
      <TarjetaPublicacion pub={pub} incrementoPrecio={10} />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disminuir precio",
      }),
    );

    expect(
      screen.getByText("Sin precio"),
    ).toBeInTheDocument();

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      0,
    );
  });

  it("permite editar manualmente el precio", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
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

    expect(screen.getByText("$150")).toBeInTheDocument();

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      150,
    );
  });

  it("acepta coma decimal al editar manualmente el precio", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
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
        value: "125,5",
      },
    });

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(
      screen.getByText("$125.5"),
    ).toBeInTheDocument();

    expect(actualizarPrecio).toHaveBeenCalledWith(
      1,
      125.5,
    );
  });

  it("cancela la edición manual con Escape", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
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
        value: "   ",
      },
    });

    fireEvent.blur(input);

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("descarta un precio manual negativo", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
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

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("descarta un precio manual no numérico", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
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

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(screen.getByText("$100")).toBeInTheDocument();

    expect(actualizarPrecio).not.toHaveBeenCalled();
  });

  it("abre el detalle al seleccionar la publicación", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
      />,
    );

    expect(
      screen.queryByTestId("detalle-publicacion"),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Ver detalle de Manzana · Red Delicious",
      })[0],
    );

    expect(
      screen.getByTestId("detalle-publicacion"),
    ).toHaveTextContent("Detalle 1");
  });

  it("puede cerrar el detalle abierto", () => {
    render(
      <TarjetaPublicacion
        pub={crearPublicacion()}
        incrementoPrecio={10}
      />,
    );

    fireEvent.click(
      screen.getAllByRole("button", {
        name: "Ver detalle de Manzana · Red Delicious",
      })[0],
    );

    expect(
      screen.getByTestId("detalle-publicacion"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Cerrar",
      }),
    );

    expect(
      screen.queryByTestId("detalle-publicacion"),
    ).not.toBeInTheDocument();
  });
});