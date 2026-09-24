import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import TarjetaPublicacionOperadorAlt from "./TarjetaPublicacionOperadorAlt";

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

describe("TarjetaPublicacionOperadorAlt", () => {
  it("muestra el producto, sus características y el operador", () => {
    render(
      <TarjetaPublicacionOperadorAlt
        publicacion={crearPublicacion()}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Tomate - Perita")).toHaveAttribute(
      "title",
      "Tomate - Perita",
    );
    expect(screen.getByText("M")).toBeInTheDocument();
    expect(screen.getByText("Primera")).toBeInTheDocument();
    expect(screen.getByText("por Cajón")).toBeInTheDocument();
    expect(screen.getByText("Huerta Sur")).toHaveAttribute(
      "title",
      "Huerta Sur",
    );
  });

  it("muestra solamente la especie cuando la variedad es un guion", () => {
    render(
      <TarjetaPublicacionOperadorAlt
        publicacion={{ ...crearPublicacion(), variedad: "-" }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Tomate", { exact: true })).toHaveAttribute(
      "title",
      "Tomate",
    );
  });

  it("muestra la foto con la especie como texto alternativo", () => {
    render(
      <TarjetaPublicacionOperadorAlt
        publicacion={{ ...crearPublicacion(), foto: "/tomate.jpg" }}
        onClick={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("img", { name: "Foto de Tomate" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Foto", { exact: true })).not.toBeInTheDocument();
  });

  it("muestra un reemplazo cuando la publicación no tiene foto", () => {
    render(
      <TarjetaPublicacionOperadorAlt
        publicacion={crearPublicacion()}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText("Foto", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it.each([
    [150, "$150"],
    [1234.5, "$1234.5"],
    [0, "$0"],
  ])("muestra el precio %s", (precio, esperado) => {
    render(
      <TarjetaPublicacionOperadorAlt
        publicacion={{ ...crearPublicacion(), precio }}
        onClick={vi.fn()}
      />,
    );

    expect(screen.getByText(esperado)).toBeInTheDocument();
  });

  it("ejecuta el callback únicamente al seleccionar la tarjeta", () => {
    const onClick = vi.fn();
    render(
      <TarjetaPublicacionOperadorAlt
        publicacion={crearPublicacion()}
        onClick={onClick}
      />,
    );

    expect(onClick).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Tomate - Perita/ }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("actualiza el contenido y el callback cuando cambia la publicación", () => {
    const onClickAnterior = vi.fn();
    const onClickNuevo = vi.fn();
    const { rerender } = render(
      <TarjetaPublicacionOperadorAlt
        publicacion={crearPublicacion()}
        onClick={onClickAnterior}
      />,
    );

    rerender(
      <TarjetaPublicacionOperadorAlt
        publicacion={{
          ...crearPublicacion(),
          id: 2,
          especie: "Manzana",
          variedad: "Gala",
          precio: 80,
          foto: "/manzana.jpg",
          codigoCalibre: "G",
          categoria: "Segunda",
          presentacion: "Bolsa",
          operador: {
            id: 20,
            nombreFantasia: "Frutas Norte",
            whatsApp: "098654321",
          },
        }}
        onClick={onClickNuevo}
      />,
    );

    expect(screen.queryByText("Tomate - Perita")).not.toBeInTheDocument();
    expect(screen.getByText("Manzana - Gala")).toBeInTheDocument();
    expect(screen.getByText("$80")).toBeInTheDocument();
    expect(screen.queryByText("$150")).not.toBeInTheDocument();
    expect(screen.getByText("G")).toBeInTheDocument();
    expect(screen.getByText("Segunda")).toBeInTheDocument();
    expect(screen.getByText("por Bolsa")).toBeInTheDocument();
    expect(
      screen.getByRole("img", { name: "Foto de Manzana" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Huerta Sur")).not.toBeInTheDocument();
    expect(screen.getByText("Frutas Norte")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Manzana - Gala/ }));
    expect(onClickNuevo).toHaveBeenCalledTimes(1);
    expect(onClickAnterior).not.toHaveBeenCalled();
  });
});
