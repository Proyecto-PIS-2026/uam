import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import { PublicacionSinOperador } from "./TarjetaPublicacionSinOperador";

function crearPublicacion(): PublicacionListado {
  return {
    id: 7,
    especie: "Tomate",
    variedad: "Perita",
    precio: 150,
    foto: null,
    presentacion: "Cajón",
    categoria: "Primera",
    calibre: "Mediano",
    codigoCalibre: "M",
    operador: { id: 10, nombreFantasia: "Huerta Sur", whatsApp: "099123456" },
  };
}

describe("PublicacionSinOperador", () => {
  it("muestra el producto y sus características sin el nombre del operador", () => {
    render(<PublicacionSinOperador producto={crearPublicacion()} />);

    expect(screen.getByText("Tomate Perita")).toBeInTheDocument();
    expect(screen.getByText("Cajón")).toBeInTheDocument();
    expect(screen.getByText("Mediano")).toBeInTheDocument();
    expect(screen.getByText("Primera")).toBeInTheDocument();
    expect(screen.queryByText("Huerta Sur")).not.toBeInTheDocument();
  });

  it.each(["-", ""])(
    "muestra solamente la especie cuando la variedad es %j",
    (variedad) => {
      render(
        <PublicacionSinOperador
          producto={{ ...crearPublicacion(), variedad }}
        />,
      );

      expect(screen.getByText("Tomate", { exact: true })).toBeInTheDocument();
      expect(
        screen.queryByText("Perita", { exact: false }),
      ).not.toBeInTheDocument();
    },
  );

  it("muestra la foto con la especie como texto alternativo", () => {
    render(
      <PublicacionSinOperador
        producto={{ ...crearPublicacion(), foto: "/tomate.jpg" }}
      />,
    );

    expect(screen.getByRole("img", { name: "Tomate" })).toBeInTheDocument();
    expect(screen.queryByText("IMG")).not.toBeInTheDocument();
  });

  it("muestra un reemplazo cuando la publicación no tiene foto", () => {
    render(<PublicacionSinOperador producto={crearPublicacion()} />);

    expect(screen.getByText("IMG")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each([
    [150, "$150"],
    [1234.5, "$1234.5"],
    [0, "$0"],
  ])(
    "muestra el precio %s sin confundir cero con ausencia de precio",
    (precio, esperado) => {
      render(
        <PublicacionSinOperador producto={{ ...crearPublicacion(), precio }} />,
      );

      expect(screen.getByText(esperado)).toBeInTheDocument();
      expect(screen.queryByText("Sin precio")).not.toBeInTheDocument();
    },
  );

  it.each([null, "/tomate.jpg"])(
    "ejecuta el callback al seleccionar la imagen con foto %j",
    (foto) => {
      const onClick = vi.fn();
      render(
        <PublicacionSinOperador
          producto={{ ...crearPublicacion(), foto }}
          onClick={onClick}
        />,
      );

      expect(onClick).not.toHaveBeenCalled();
      fireEvent.click(
        foto
          ? screen.getByRole("img", { name: "Tomate" })
          : screen.getByText("IMG"),
      );
      expect(onClick).toHaveBeenCalledTimes(1);
    },
  );

  it("permite seleccionar la imagen sin un callback", () => {
    render(<PublicacionSinOperador producto={crearPublicacion()} />);

    expect(() => fireEvent.click(screen.getByText("IMG"))).not.toThrow();
    expect(screen.getByText("Tomate Perita")).toBeInTheDocument();
  });

  it("muestra un reemplazo cuando la publicación no tiene precio", () => {
    render(
      <PublicacionSinOperador
        producto={{ ...crearPublicacion(), precio: null }}
      />,
    );

    expect(screen.getByText("Sin precio")).toBeInTheDocument();
  });
});
