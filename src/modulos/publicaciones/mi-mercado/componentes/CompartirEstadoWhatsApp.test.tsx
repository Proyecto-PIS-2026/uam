
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
import type { Publicacion } from "../tipos";

const mocks = vi.hoisted(() => ({
  compartir: vi.fn(),
  puedeCompartir: vi.fn(),
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
    version: 1,
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

    mocks.compartir.mockResolvedValue(undefined);
    mocks.copiar.mockResolvedValue(undefined);
    mocks.puedeCompartir.mockReturnValue(true);

    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: mocks.compartir,
    });

    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: mocks.puedeCompartir,
    });

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: mocks.copiar },
    });

    vi.stubGlobal("fetch", mocks.obtenerFoto);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();

    Reflect.deleteProperty(navigator, "share");
    Reflect.deleteProperty(navigator, "canShare");
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

    fireEvent.change(obtenerMensaje(), {
      target: { value: "Oferta especial de acelga a $45" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(mocks.compartir).toHaveBeenCalledExactlyOnceWith({
        text: "Oferta especial de acelga a $45",
      });
    });
  });

  it("CP-04: comparte texto cuando la publicación no tiene foto", async () => {
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
      expect(mocks.compartir).toHaveBeenCalledWith({
        text: mensaje,
      });
    });

    expect(mocks.obtenerFoto).not.toHaveBeenCalled();
  });

  it("CP-05: adjunta la fotografía cuando el dispositivo lo permite", async () => {
    const foto = "/imagenes/acelga.png";

    mocks.obtenerFoto.mockResolvedValue({
      ok: true,
      blob: async () =>
        new Blob(["contenido de prueba"], {
          type: "image/png",
        }),
    });

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
      expect(mocks.compartir).toHaveBeenCalledOnce();
    });

    expect(mocks.obtenerFoto).toHaveBeenCalledWith(foto);

    const datos = mocks.compartir.mock.calls[0][0] as ShareData;

    expect(datos.text).toBe(mensaje);
    expect(datos.files).toHaveLength(1);

    const archivo = datos.files![0];

    expect(archivo).toBeInstanceOf(File);
    expect(archivo.name).toBe("producto-52.png");
    expect(archivo.type).toBe("image/png");

    expect(mocks.puedeCompartir).toHaveBeenCalledOnce();
  });

  it("CP-06: maneja errores al obtener la fotografía", async () => {
    mocks.obtenerFoto.mockRejectedValue(
      new Error("No se pudo descargar la foto"),
    );

    renderizar(crearPublicacion("/imagenes/acelga.png"));

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "No se pudo adjuntar la fotografía",
      );
    });

    expect(mocks.compartir).not.toHaveBeenCalled();
    expect(
      screen.getByRole("link", { name: "Abrir foto" }),
    ).toBeInTheDocument();
  });

  it("CP-07: avisa cuando el dispositivo no permite compartir archivos", async () => {
    mocks.puedeCompartir.mockReturnValue(false);

    mocks.obtenerFoto.mockResolvedValue({
      ok: true,
      blob: async () =>
        new Blob(["imagen"], { type: "image/png" }),
    });

    renderizar(crearPublicacion("/imagenes/acelga.png"));

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "no admite compartir la fotografía",
      );
    });

    expect(mocks.compartir).not.toHaveBeenCalled();
  });

  it("CP-08: ofrece una alternativa si navigator.share no existe", async () => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });

    renderizar();

    fireEvent.click(
      screen.getByRole("button", { name: "Compartir" }),
    );

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "Este navegador no permite compartir directamente",
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
    expect(screen.getByRole("status").closest('[role="dialog"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(obtenerMensaje()).toHaveValue("Mi promoción de acelga");
  });

  it("CP-10: permite cerrar la ventana sin compartir", () => {
    const alCerrar = vi.fn();

    renderizar(crearPublicacion(), alCerrar);

    fireEvent.click(
      screen.getByRole("button", { name: "Cerrar" }),
    );

    expect(alCerrar).toHaveBeenCalledOnce();
    expect(mocks.compartir).not.toHaveBeenCalled();
  });

  it("CP-11: muestra Consultar cuando no hay precio", () => {
    const publicacion = crearPublicacion();
    publicacion.precio = null;

    renderizar(publicacion);

    expect(obtenerMensaje().value).toContain("Consultar");
  });
});
