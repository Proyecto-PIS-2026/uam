import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import { PublicacionesOperador } from "./ListadoPublicacionConOperador";

function crearPublicacion(id: number): PublicacionListado {
  return {
    id,
    especie: `Producto ${id}`,
    variedad: "-",
    precio: 150,
    foto: null,
    presentacion: "Cajón",
    categoria: "Primera",
    calibre: "Mediano",
    codigoCalibre: "M",
    operador: { id: 10, nombreFantasia: "Huerta Sur", whatsApp: "099123456" },
  };
}

// Las tarjetas se sustituyen para probar solamente el contrato del listado.
vi.mock(
  "@/modulos/publicaciones/componentes/tarjetas-publicacion/TarjetaPublicacionConOperador",
  () => ({
    default: ({
      publicacion,
      onClick,
    }: {
      publicacion: PublicacionListado;
      onClick: () => void;
    }) => <button onClick={onClick}>{publicacion.especie}</button>,
  }),
);

describe("PublicacionesOperador", () => {
  it("muestra todas las publicaciones en el orden recibido", () => {
    render(
      <PublicacionesOperador
        nombreFantasia="Huerta Sur"
        publicaciones={[crearPublicacion(7), crearPublicacion(2)]}
        onPublicacionClick={vi.fn()}
      />,
    );

    const tarjetas = screen.getAllByRole("button");

    expect(tarjetas.map((tarjeta) => tarjeta.textContent)).toEqual([
      "Producto 7",
      "Producto 2",
    ]);
    expect(screen.getByText("Huerta Sur")).toBeInTheDocument();
  });

  it("no muestra tarjetas cuando la lista está vacía", () => {
    const onPublicacionClick = vi.fn();

    render(
      <PublicacionesOperador
        nombreFantasia="Huerta Sur"
        publicaciones={[]}
        onPublicacionClick={onPublicacionClick}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(onPublicacionClick).not.toHaveBeenCalled();
  });

  it("notifica el ID de cada publicación únicamente al seleccionarla", () => {
    const onPublicacionClick = vi.fn();

    render(
      <PublicacionesOperador
        nombreFantasia="Huerta Sur"
        publicaciones={[crearPublicacion(7), crearPublicacion(2)]}
        onPublicacionClick={onPublicacionClick}
      />,
    );

    expect(onPublicacionClick).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Producto 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Producto 7" }));

    expect(onPublicacionClick).toHaveBeenCalledTimes(2);
    expect(onPublicacionClick).toHaveBeenNthCalledWith(1, 2);
    expect(onPublicacionClick).toHaveBeenNthCalledWith(2, 7);
  });

  it("actualiza las tarjetas cuando cambian las publicaciones", () => {
    const onPublicacionClick = vi.fn();

    const { rerender } = render(
      <PublicacionesOperador
        nombreFantasia="Huerta Sur"
        publicaciones={[crearPublicacion(7)]}
        onPublicacionClick={onPublicacionClick}
      />,
    );

    rerender(
      <PublicacionesOperador
        nombreFantasia="Huerta Sur"
        publicaciones={[crearPublicacion(2)]}
        onPublicacionClick={onPublicacionClick}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Producto 7" }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Producto 2" }));
    expect(onPublicacionClick).toHaveBeenCalledExactlyOnceWith(2);
  });
});
