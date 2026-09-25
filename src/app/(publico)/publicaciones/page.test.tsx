import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicacionListado } from "@/modulos/consulta-mercado/acciones/publicaciones";
import PaginaPublicaciones from "./page";

const consultarPublicacionesMock = vi.hoisted(() => vi.fn());

vi.mock("@/modulos/consulta-mercado/acciones/publicaciones", () => ({
  consultarPublicaciones: consultarPublicacionesMock,
}));

vi.mock("@/compartido/HeaderPublico", () => ({
  default: () => <header>Header público</header>,
}));

vi.mock(
  "@/modulos/publicaciones/componentes/contenedor-publicacion/ContenedorPublicaciones",
  () => ({
    default: ({
      publicaciones,
    }: {
      publicaciones: PublicacionListado[];
    }) => (
      <div data-testid="contenedor-publicaciones">
        {publicaciones.map((publicacion) => (
          <span key={publicacion.id}>{publicacion.especie}</span>
        ))}
      </div>
    ),
  }),
);

function crearPublicacion(id: number): PublicacionListado {
  return {
    id,
    precio: 150,
    foto: null,
    especie: `Producto ${id}`,
    variedad: "-",
    presentacion: "Cajón",
    categoria: "Primera",
    calibre: "Mediano",
    codigoCalibre: "M",
    operador: {
      id: 10,
      nombreFantasia: "Huerta Sur",
      whatsApp: "099123456",
    },
  };
}

describe("PaginaPublicaciones", () => {
  it("consulta las publicaciones y muestra la cantidad obtenida", async () => {
    const publicaciones = [
      crearPublicacion(1),
      crearPublicacion(2),
      crearPublicacion(3),
    ];

    consultarPublicacionesMock.mockResolvedValue({ publicaciones });

    render(await PaginaPublicaciones());

    expect(consultarPublicacionesMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByText("3", { exact: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("publicaciones en la plataforma"),
    ).toBeInTheDocument();
  });

  it("pasa las publicaciones obtenidas al contenedor", async () => {
    const publicaciones = [
      crearPublicacion(7),
      crearPublicacion(8),
    ];

    consultarPublicacionesMock.mockResolvedValue({ publicaciones });

    render(await PaginaPublicaciones());

    const contenedor = screen.getByTestId("contenedor-publicaciones");

    expect(contenedor).toHaveTextContent("Producto 7");
    expect(contenedor).toHaveTextContent("Producto 8");
  });

  it("muestra cero publicaciones cuando la consulta no devuelve resultados", async () => {
    consultarPublicacionesMock.mockResolvedValue({
      publicaciones: [],
    });

    render(await PaginaPublicaciones());

    expect(screen.getByText("0", { exact: true })).toBeInTheDocument();
    expect(
      screen.getByText("publicaciones en la plataforma"),
    ).toBeInTheDocument();
  });
});