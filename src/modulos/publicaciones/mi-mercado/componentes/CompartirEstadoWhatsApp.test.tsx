
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import CompartirEstadoWhatsApp from "./CompartirEstadoWhatsApp";
import type { Publicacion } from "./MiMercado";

const mocks = vi.hoisted(() => ({
  copiar: vi.fn(),
  obtenerFoto: vi.fn(),
}));

vi.mock("@mui/material/Dialog", () => ({
  default: ({
    open,
    children,
  }: {
    open: boolean;
    children: ReactNode;
  }) =>
    open ? <div role="dialog">{children}</div> : null,
}));

vi.mock("../../componentes/ImagenPublicacion", () => ({
  default: ({
    src,
    alt,
  }: {
    src: string | null | undefined;
    alt: string;
  }) =>
    src ? <span role="img" aria-label={alt} data-src={src} /> : null,
}));

function crearPublicacion(foto: string | null = null): Publicacion {
  return {
    id: 52,
    publicacionOperadorId: 13,
    paisId: 44,
    foto,
    precio: "45",
    fecha: "2026-10-03T15:00:00.000Z",
    publicacionActiva: true,
    publicacionDisponible: true,
    presentacion: {
      id: 5,
      nombrePresentacion: "Docena",
      variedad: {
        id: 6,
        nombreVariedad: "-",
        especie: {
          id: 7,
          nombreEspecie: "Acelga",
          fotoEspecie: null,
        },
      },
    },
    categoria: {
      id: 1,
      nombreCategoria: "I",
    },
    calibre: {
      id: 2,
      codigoCalibre: "M",
      nombreCalibre: "12 PLANTAS",
    },
  };
}

function renderizar(
  publicacion = crearPublicacion(),
  alCerrar = vi.fn(),
) {
  render(
    <CompartirEstadoWhatsApp
      publicacion={publicacion}
      nombreOperador="Mercado Verde UAM"
      alCerrar={alCerrar}
    />,
  );

  return { alCerrar };
}

function obtenerMensaje(): HTMLTextAreaElement {
  return screen.getByLabelText(
    "Editá el texto que querés compartir",
  ) as HTMLTextAreaElement;
}

describe("BP-10.3 - Compartir producto en estado de WhatsApp", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    mocks.copiar.mockResolvedValue(undefined);

    vi.spyOn(window, "open").mockImplementation(() => null);

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.copiar },
    });

    vi.stubGlobal("fetch", mocks.obtenerFoto);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();

    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "clipboard");
  });

  it("CP-01: muestra el contenido predeterminado del producto", () => {
    renderizar();

    const mensaje = obtenerMensaje().value;

    expect(mensaje).toContain("Acelga");
    expect(mensaje).toContain("Docena");
    expect(mensaje).toContain("Categoría: I");
    expect(mensaje).toContain("12 PLANTAS");
    expect(mensaje).toContain("$45");
    expect(mensaje).toContain("Mercado Verde UAM");

    expect(screen.getByRole("button", { name: "Compartir" }))
      .toBeInTheDocument();
  });

  it("CP-02: incluye el enlace al perfil público del operador", () => {
    renderizar();

    const enlaceEsperado =
      `${window.location.origin}/operadores/` +
      encodeURIComponent("Mercado Verde UAM");

    expect(obtenerMensaje().value).toContain(enlaceEsperado);
  });

  it("CP-03: permite editar el texto antes de compartir", async () => {
    renderizar();

    const mensaje = "Oferta especial de acelga a $45";

    fireEvent.change(obtenerMensaje(), {
      target: { value: mensaje },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledExactlyOnceWith(
        `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
        "_blank",
        "noopener,noreferrer",
      );
    });
  });

  it("CP-04: abre WhatsApp con el texto cuando no hay foto", async () => {
    renderizar(crearPublicacion(null));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Abrir foto" }),
    ).not.toBeInTheDocument();

    const mensaje = obtenerMensaje().value;

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledExactlyOnceWith(
        `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
        "_blank",
        "noopener,noreferrer",
      );
    });

    expect(mocks.obtenerFoto).not.toHaveBeenCalled();
  });

  it("CP-05: permite abrir la fotografía manualmente", async () => {
    const foto = "/imagenes/acelga.png";

    renderizar(crearPublicacion(foto));

    expect(
      screen.getByRole("img", { name: "Acelga" }),
    ).toHaveAttribute("data-src", foto);

    expect(
      screen.getByRole("link", { name: "Abrir foto" }),
    ).toHaveAttribute("href", foto);

    const mensaje = obtenerMensaje().value;

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledExactlyOnceWith(
        `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
        "_blank",
        "noopener,noreferrer",
      );
    });

    expect(mocks.obtenerFoto).not.toHaveBeenCalled();
  });

  it("CP-06: informa cuando falla la apertura de WhatsApp", async () => {
    vi.mocked(window.open).mockImplementation(() => {
      throw new Error("No se pudo abrir WhatsApp");
    });

    renderizar(crearPublicacion("/imagenes/acelga.png"));

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "No se pudo abrir WhatsApp.",
      );
    });

    expect(
      screen.getByRole("link", { name: "Abrir foto" }),
    ).toBeInTheDocument();
  });

  it("CP-07: codifica correctamente el mensaje en la URL de WhatsApp", async () => {
    renderizar();

    const mensaje = "Acelga 🥬\nPrecio $45 & descuento 10%";

    fireEvent.change(obtenerMensaje(), {
      target: { value: mensaje },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledOnce();
    });

    const destino = new URL(
      vi.mocked(window.open).mock.calls[0][0]!.toString(),
    );

    expect(destino.hostname).toBe("wa.me");
    expect(destino.searchParams.get("text")).toBe(mensaje);
  });

  it("CP-08: abre WhatsApp aunque navigator.share no exista", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    renderizar();

    const mensaje = obtenerMensaje().value;

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(window.open).toHaveBeenCalledExactlyOnceWith(
        `https://wa.me/?text=${encodeURIComponent(mensaje)}`,
        "_blank",
        "noopener,noreferrer",
      );
    });

    expect(
      screen.getByRole("button", { name: "Copiar texto" }),
    ).toBeInTheDocument();
  });

  it("CP-09: copia el mensaje editable al portapapeles", async () => {
    renderizar();

    fireEvent.change(obtenerMensaje(), {
      target: { value: "Mi promoción de acelga" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Copiar texto" }),
    );

    await waitFor(() => {
      expect(mocks.copiar).toHaveBeenCalledExactlyOnceWith(
        "Mi promoción de acelga",
      );
    });

    expect(screen.getByRole("status")).toHaveTextContent(
      "Texto copiado al portapapeles",
    );
  });

  it("CP-10: permite cerrar la ventana sin compartir", () => {
    const alCerrar = vi.fn();

    renderizar(crearPublicacion(), alCerrar);

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar" }),
    );

    expect(alCerrar).toHaveBeenCalledOnce();
    expect(window.open).not.toHaveBeenCalled();
  });

  it("CP-11: muestra Consultar cuando no hay precio", () => {
    const publicacion = crearPublicacion();
    publicacion.precio = null;

    renderizar(publicacion);

    expect(obtenerMensaje().value).toContain("Consultar");
  });
});
