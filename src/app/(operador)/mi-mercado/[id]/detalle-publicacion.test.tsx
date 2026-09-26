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
import DetallePublicacion from "./detalle-publicacion";
import type { Publicacion } from "../mi-mercado";

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

describe("DetallePublicacion", () => {
  let restar: ReturnType<typeof vi.fn>;
  let sumar: ReturnType<typeof vi.fn>;
  let cambiarPrecio: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    restar = vi.fn();
    sumar = vi.fn();
    cambiarPrecio = vi.fn();
  });

  it("muestra los datos de la publicación", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByText("Manzana"),
    ).toBeInTheDocument();

    expect(
      screen.getAllByText("Red Delicious"),
    ).toHaveLength(2);

    expect(
      screen.getByText("Disponible"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("$100"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Presentación"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Caja"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Calibre"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Grande"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Categoría"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Primera"),
    ).toBeInTheDocument();

    expect(
      screen.getByText("Variedad"),
    ).toBeInTheDocument();
  });

  it("muestra no disponible cuando la publicación no está disponible", () => {
    const pub = crearPublicacion();
    pub.publicacionDisponible = false;

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByText("No disponible"),
    ).toBeInTheDocument();
  });

  it("muestra sin variedad cuando la variedad no fue informada", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "-";

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByText("Sin variedad"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("-"),
    ).not.toBeInTheDocument();
  });

  it("muestra sin variedad cuando la variedad está vacía", () => {
    const pub = crearPublicacion();
    pub.presentacion.variedad.nombreVariedad = "";

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByText("Sin variedad"),
    ).toBeInTheDocument();
  });

  it("muestra guion cuando faltan presentación calibre y categoría", () => {
    const pub = crearPublicacion();

    pub.presentacion.nombrePresentacion = "";
    pub.calibre.nombreCalibre = "";
    pub.categoria.nombreCategoria = "";

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getAllByText("-"),
    ).toHaveLength(3);
  });

  it("muestra la fotografía propia cuando existe", () => {
    const pub = crearPublicacion();

    pub.foto = "/producto.jpg";
    pub.presentacion.variedad.especie.fotoEspecie =
      "/especie.jpg";

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Manzana",
      }),
    ).toHaveAttribute(
      "src",
      "/producto.jpg",
    );
  });

  it("usa la fotografía de la especie cuando la publicación no tiene foto", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie =
      "/especie.jpg";

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByRole("img", {
        name: "Manzana",
      }),
    ).toHaveAttribute(
      "src",
      "/especie.jpg",
    );
  });

  it("muestra sin fotografía cuando no existe ninguna imagen", () => {
    const pub = crearPublicacion();

    pub.foto = null;
    pub.presentacion.variedad.especie.fotoEspecie = null;

    render(
      <DetallePublicacion
        pub={pub}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByText("Sin fotografía"),
    ).toBeInTheDocument();
  });

  it("muestra sin precio cuando el precio es cero", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={0}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    expect(
      screen.getByText("Sin precio"),
    ).toBeInTheDocument();
  });

  it("ejecuta restar al presionar disminuir precio", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Disminuir precio",
      }),
    );

    expect(restar).toHaveBeenCalledTimes(1);
  });

  it("ejecuta sumar al presionar aumentar precio", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Aumentar precio",
      }),
    );

    expect(sumar).toHaveBeenCalledTimes(1);
  });

  it("permite editar manualmente el precio", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
      />,
    );

    fireEvent.click(
      screen.getByTitle("Editar precio"),
    );

    const input = screen.getByRole("textbox", {
      name: "Editar precio",
    });

    expect(input).toHaveValue("100");

    fireEvent.change(input, {
      target: {
        value: "150",
      },
    });

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(
      cambiarPrecio,
    ).toHaveBeenCalledWith(150);

    expect(
      screen.queryByRole("textbox", {
        name: "Editar precio",
      }),
    ).not.toBeInTheDocument();
  });

  it("acepta coma decimal al editar el precio", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
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
      cambiarPrecio,
    ).toHaveBeenCalledWith(125.5);
  });

  it("cancela la edición con Escape", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
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

    expect(
      cambiarPrecio,
    ).not.toHaveBeenCalled();

    expect(
      screen.getByText("$100"),
    ).toBeInTheDocument();
  });

  it("descarta un precio vacío", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
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

    expect(
      cambiarPrecio,
    ).not.toHaveBeenCalled();

    expect(
      screen.getByText("$100"),
    ).toBeInTheDocument();
  });

  it("descarta un precio negativo", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
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
        value: "-20",
      },
    });

    fireEvent.keyDown(input, {
      key: "Enter",
    });

    expect(
      cambiarPrecio,
    ).not.toHaveBeenCalled();

    expect(
      screen.getByText("$100"),
    ).toBeInTheDocument();
  });

  it("descarta un precio no numérico", () => {
    render(
      <DetallePublicacion
        pub={crearPublicacion()}
        precio={100}
        restar={restar}
        sumar={sumar}
        cambiarPrecio={cambiarPrecio}
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

    expect(
      cambiarPrecio,
    ).not.toHaveBeenCalled();

    expect(
      screen.getByText("$100"),
    ).toBeInTheDocument();
  });
});