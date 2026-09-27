import {
  render,
  screen,
  fireEvent,
} from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import MiMercado, {
  type Publicacion,
} from "./mi-mercado";

vi.mock("./tarjeta-publicacion", () => ({
  default: ({
    pub,
    incrementoPrecio,
  }: {
    pub: Publicacion;
    incrementoPrecio: number;
  }) => (
    <div
      data-testid={`publicacion-${pub.id}`}
      data-incremento={incrementoPrecio}
    >
      {pub.presentacion.variedad.nombreVariedad}
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
    foto: null,
    precio: "100",
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacion: {
      nombrePresentacion: "Cajón",
      variedad: {
        nombreVariedad: `Variedad ${id}`,
        especie: {
          id: especieId,
          nombreEspecie,
          fotoEspecie: null,
        },
      },
    },
    categoria: {
      nombreCategoria: "Primera",
    },
    calibre: {
      codigoCalibre: "M",
      nombreCalibre: "Mediano",
    },
  };
}

function renderMiMercado(
  publicaciones: Publicacion[],
  incrementoPrecio = 5,
) {
  render(
    <MiMercado
      publicaciones={publicaciones}
      incrementoPrecio={incrementoPrecio}
    />,
  );
}

describe("MiMercado", () => {
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
        publicaciones={[
          crearPublicacion(1, 10, "Manzana"),
        ]}
        incrementoPrecio={5}
      />,
    );

    expect(
      screen.getByTestId("publicacion-1"),
    ).toBeInTheDocument();

    rerender(
      <MiMercado
        publicaciones={[
          crearPublicacion(2, 20, "Pera"),
        ]}
        incrementoPrecio={5}
      />,
    );

    expect(
      screen.getByTestId("publicacion-2"),
    ).toBeInTheDocument();
  });
});