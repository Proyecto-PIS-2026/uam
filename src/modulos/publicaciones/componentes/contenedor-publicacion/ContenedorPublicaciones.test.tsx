import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import ListadoPublicaciones from "../listado-publicaciones/listadoPublicacionesUnificado";
import ContenedorPublicaciones from "./ContenedorPublicaciones";

// Se aísla el listado para verificar las publicaciones que recibe del contenedor.
vi.mock("../listado-publicaciones/listadoPublicacionesUnificado", () => ({
  default: vi.fn(() => null),
}));

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

function publicacionesDelListado() {
  return vi.mocked(ListadoPublicaciones).mock.calls.at(-1)?.[0].publicaciones;
}

describe("ContenedorPublicaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("entrega al listado todas las publicaciones en el orden recibido", () => {
    const publicaciones = [crearPublicacion(7), crearPublicacion(2)];

    render(<ContenedorPublicaciones publicaciones={publicaciones} />);

    expect(publicacionesDelListado()).toEqual(publicaciones);
  });

  it("entrega una lista vacía cuando no hay publicaciones", () => {
    render(<ContenedorPublicaciones publicaciones={[]} />);

    expect(publicacionesDelListado()).toEqual([]);
  });

  it("actualiza el listado cuando recibe nuevas publicaciones", () => {
    const { rerender } = render(
      <ContenedorPublicaciones publicaciones={[crearPublicacion(7)]} />,
    );
    const publicaciones = [crearPublicacion(2), crearPublicacion(9)];

    rerender(<ContenedorPublicaciones publicaciones={publicaciones} />);

    expect(publicacionesDelListado()).toEqual(publicaciones);
  });

  it("actualiza los datos aunque la publicación conserve el mismo ID", () => {
    const publicacion = crearPublicacion(7);
    const { rerender } = render(
      <ContenedorPublicaciones publicaciones={[publicacion]} />,
    );
    const actualizada = { ...publicacion, precio: 80, foto: "/tomate.jpg" };

    rerender(<ContenedorPublicaciones publicaciones={[actualizada]} />);

    expect(publicacionesDelListado()).toEqual([actualizada]);
  });

  it("vacía el listado cuando se quitan las publicaciones", () => {
    const { rerender } = render(
      <ContenedorPublicaciones publicaciones={[crearPublicacion(7)]} />,
    );

    rerender(<ContenedorPublicaciones publicaciones={[]} />);

    expect(publicacionesDelListado()).toEqual([]);
  });

  it("muestra los resultados que llegan después de una lista vacía", () => {
    const { rerender } = render(<ContenedorPublicaciones publicaciones={[]} />);
    const publicaciones = [crearPublicacion(7)];

    rerender(<ContenedorPublicaciones publicaciones={publicaciones} />);

    expect(publicacionesDelListado()).toEqual(publicaciones);
  });
});