import { beforeEach, describe, expect, it, vi } from "vitest";
import { consultarPublicaciones } from "./publicaciones";

type FilaPublicacion = {
  id: number | string;
  precio: number | string;
  foto: string | null;
  especie: string;
  variedad: string;
  presentacion: string;
  categoria: string;
  calibre: string;
  codigoCalibre: string;
  operadorId: number | string;
  operadorNombreFantasia: string;
  operadorWhatsApp: string;
};

const { consulta, plan, query } = vi.hoisted(() => {
  const plan = { sql: "consulta de publicaciones" };
  return {
    plan,
    query: vi.fn<() => Promise<FilaPublicacion[]>>(),
    consulta: {
      innerJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      build: vi.fn().mockReturnValue(plan),
    },
  };
});

// Se sustituye la base de datos para probar el mapeo y los errores de la consulta.
// Los joins y filtros SQL requieren pruebas de integración contra una base real.
vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
  db: {
    sql: {
      public: {
        publicacionOperador: consulta,
        publicacion: {},
        presentacion: {},
        variedad: {},
        especie: {},
        categoria: {},
        calibre: {},
        operador: {},
      },
    },
    runtime: () => ({ query }),
  },
}));

function crearFila(id = 7): FilaPublicacion {
  return {
    id,
    precio: 150,
    foto: "/tomate.jpg",
    especie: "Tomate",
    variedad: "Perita",
    presentacion: "Cajón",
    categoria: "Primera",
    calibre: "Mediano",
    codigoCalibre: "M",
    operadorId: 10,
    operadorNombreFantasia: "Huerta Sur",
    operadorWhatsApp: "099123456",
  };
}

describe("consultarPublicaciones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockReset();
    query.mockResolvedValue([]);
  });

  it("devuelve una lista vacía cuando no hay publicaciones", async () => {
    expect(await consultarPublicaciones()).toEqual({ publicaciones: [] });
  });

  it("ejecuta el plan construido para consultar las publicaciones", async () => {
    await consultarPublicaciones();

    expect(consulta.build).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledExactlyOnceWith(plan);
  });

  it("mapea los datos de la publicación y agrupa los datos del operador", async () => {
    query.mockResolvedValue([crearFila()]);

    expect(await consultarPublicaciones()).toEqual({
      publicaciones: [
        {
          id: 7,
          precio: 150,
          foto: "/tomate.jpg",
          especie: "Tomate",
          variedad: "Perita",
          presentacion: "Cajón",
          categoria: "Primera",
          calibre: "Mediano",
          codigoCalibre: "M",
          operador: {
            id: 10,
            nombreFantasia: "Huerta Sur",
            whatsApp: "099123456",
          },
        },
      ],
    });
  });

  it.each([
    ["150", 150],
    ["1234.50", 1234.5],
    ["0", 0],
  ])("convierte los IDs y el precio %s recibidos como texto", async (precio, esperado) => {
    query.mockResolvedValue([
      { ...crearFila(), id: "7", operadorId: "10", precio },
    ]);

    const { publicaciones } = await consultarPublicaciones();

    expect(publicaciones).toHaveLength(1);
    expect(publicaciones[0].id).toBe(7);
    expect(publicaciones[0].precio).toBe(esperado);
    expect(publicaciones[0].operador.id).toBe(10);
  });

  it("conserva la foto nula cuando la publicación no tiene imagen", async () => {
    query.mockResolvedValue([{ ...crearFila(), foto: null }]);

    const { publicaciones } = await consultarPublicaciones();

    expect(publicaciones).toHaveLength(1);
    expect(publicaciones[0].foto).toBeNull();
  });

  it("mantiene el orden de los resultados y el operador de cada publicación", async () => {
    query.mockResolvedValue([
      crearFila(7),
      {
        ...crearFila(2),
        operadorId: 20,
        operadorNombreFantasia: "Frutas Norte",
        operadorWhatsApp: "098654321",
      },
      crearFila(9),
    ]);

    const { publicaciones } = await consultarPublicaciones();

    expect(publicaciones.map((publicacion) => publicacion.id)).toEqual([7, 2, 9]);
    expect(publicaciones.map((publicacion) => publicacion.operador)).toEqual([
      { id: 10, nombreFantasia: "Huerta Sur", whatsApp: "099123456" },
      { id: 20, nombreFantasia: "Frutas Norte", whatsApp: "098654321" },
      { id: 10, nombreFantasia: "Huerta Sur", whatsApp: "099123456" },
    ]);
  });

  it("propaga el error cuando falla la consulta a la base de datos", async () => {
    const error = new Error("No se pudo consultar las publicaciones");
    query.mockRejectedValue(error);

    await expect(consultarPublicaciones()).rejects.toBe(error);
  });
});
