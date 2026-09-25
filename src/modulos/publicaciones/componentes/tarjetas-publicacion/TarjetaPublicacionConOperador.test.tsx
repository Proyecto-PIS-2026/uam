import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import TarjetaPublicacionConOperador from "./TarjetaPublicacionConOperador";

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

describe("TarjetaPublicacionConOperador", () => {
  it("muestra el producto, sus características y el operador", () => {
    render(
      <TarjetaPublicacionConOperador
        publicacion={crearPublicacion()}
        onClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Tomate Perita" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Mediano · Categoría Primera")).toBeInTheDocument();
    expect(screen.getByText("por Cajón")).toBeInTheDocument();
    expect(screen.getByText("Huerta Sur")).toHaveAttribute(
      "title",
      "Huerta Sur",
    );
    expect(
      screen.getByRole("button", { name: "Ver detalle de Tomate Perita" }),
    ).toHaveAttribute("type", "button");
  });

  it.each(["-", ""])(
    "muestra solamente la especie cuando la variedad es %j",
    (variedad) => {
      render(
        <TarjetaPublicacionConOperador
          publicacion={{ ...crearPublicacion(), variedad }}
          onClick={vi.fn()}
        />,
      );

      expect(
        screen.getByRole("heading", { name: "Tomate" }),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Ver detalle de Tomate" }),
      ).toBeInTheDocument();
    },
  );

  it("muestra la foto con un texto alternativo del producto", () => {
    render(
      <TarjetaPublicacionConOperador
        publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg" }}
        onClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Foto de Tomate Perita" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Sin foto disponible")).not.toBeInTheDocument();
  });

  it("informa cuando la publicación no tiene foto", () => {
    render(
      <TarjetaPublicacionConOperador
        publicacion={crearPublicacion()}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Sin foto disponible")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each([
    [150, /^\$\s*150$/],
    [1234.5, /^\$\s*1\.234,5$/],
    [0, /^\$\s*0$/],
  ])("muestra el precio %s en pesos uruguayos", (precio, esperado) => {
    render(
      <TarjetaPublicacionConOperador
        publicacion={{ ...crearPublicacion(), precio }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it("ejecuta el callback únicamente al seleccionar la tarjeta", () => {
    const onClick = vi.fn();
    render(
      <TarjetaPublicacionConOperador
        publicacion={crearPublicacion()}
        onClick={onClick}
      />,
    );

    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Ver detalle de Tomate Perita" }),
    );
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
