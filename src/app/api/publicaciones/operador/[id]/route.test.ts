import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  operadorFirst: vi.fn(),
  relacionesAll: vi.fn(),
  publicacionesAll: vi.fn(),
  presentacionesAll: vi.fn(),
  variedadesAll: vi.fn(),
  especiesAll: vi.fn(),
  categoriasAll: vi.fn(),
  calibresAll: vi.fn(),
  paisesAll: vi.fn(),
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
  db: {
    orm: {
      public: {
        Operador: {
          where: vi.fn(() => ({
            first: mocks.operadorFirst,
          })),
        },
        PublicacionOperador: {
          where: vi.fn(() => ({
            all: mocks.relacionesAll,
          })),
        },
        Publicacion: {
          where: vi.fn(() => ({
            select: vi.fn(() => ({
              all: mocks.publicacionesAll,
            })),
          })),
        },
        Presentacion: {
          select: vi.fn(() => ({
            all: mocks.presentacionesAll,
          })),
        },
        Variedad: {
          select: vi.fn(() => ({
            all: mocks.variedadesAll,
          })),
        },
        Especie: {
          select: vi.fn(() => ({
            all: mocks.especiesAll,
          })),
        },
        Categoria: {
          select: vi.fn(() => ({
            all: mocks.categoriasAll,
          })),
        },
        Calibre: {
          select: vi.fn(() => ({
            all: mocks.calibresAll,
          })),
        },
        Pais: {
          select: vi.fn(() => ({
            all: mocks.paisesAll,
          })),
        },
      },
    },
  },
}));

import { GET } from "./route";

describe("GET /api/publicaciones/operador/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("devuelve 400 si el operador no es válido", async () => {
        const solicitud = new Request(
        "http://localhost/api/publicaciones/operador/abc"
        );

        const respuesta = await GET(solicitud, {
        params: Promise.resolve({ id: "abc" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(400);

        expect(cuerpo).toEqual({
        errores: ["El operador no es válido."],
        });
    });

    it("devuelve 404 si el operador no existe", async () => {
        mocks.operadorFirst.mockResolvedValue(null);

        const solicitud = new Request(
        "http://localhost/api/publicaciones/operador/15"
        );

        const respuesta = await GET(solicitud, {
        params: Promise.resolve({ id: "15" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(404);

        expect(cuerpo).toEqual({
        errores: ["El operador no existe."],
        });
    });

    it("devuelve una lista vacía si el operador no tiene publicaciones", async () => {
        mocks.operadorFirst.mockResolvedValue({
        id: 15,
        nombreFantasia: "Operador 15",
        });

        mocks.relacionesAll.mockResolvedValue([]);

        const solicitud = new Request(
        "http://localhost/api/publicaciones/operador/15"
        );

        const respuesta = await GET(solicitud, {
        params: Promise.resolve({ id: "15" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(200);

        expect(cuerpo).toEqual({
        publicaciones: [],
        });
    });

    it("devuelve las publicaciones del operador con sus datos asociados", async () => {
        mocks.operadorFirst.mockResolvedValue({
            id: 15,
            nombreFantasia: "Operador 15",
        });

        mocks.relacionesAll.mockResolvedValue([
            {
            publicacionId: 10,
            operadorId: 15,
            paisId: 1,
            },
        ]);

        mocks.publicacionesAll.mockResolvedValue([
            {
            id: 10,
            fecha: new Date("2026-09-20"),
            publicacionDisponible: true,
            precio: 150,
            presentacionId: 100,
            categoriaId: 200,
            calibreId: 300,
            },
        ]);

        mocks.presentacionesAll.mockResolvedValue([
            {
            id: 100,
            nombrePresentacion: "Caja",
            variedadId: 400,
            },
        ]);

        mocks.variedadesAll.mockResolvedValue([
            {
            id: 400,
            nombreVariedad: "Gala",
            especieId: 500,
            },
        ]);

        mocks.especiesAll.mockResolvedValue([
            {
            id: 500,
            nombreEspecie: "Manzana",
            },
        ]);

        mocks.categoriasAll.mockResolvedValue([
            {
            id: 200,
            nombreCategoria: "Primera",
            },
        ]);

        mocks.calibresAll.mockResolvedValue([
            {
            id: 300,
            nombreCalibre: "Grande",
            },
        ]);

        mocks.paisesAll.mockResolvedValue([
            {
            id: 1,
            nombrePais: "Uruguay",
            },
        ]);

        const solicitud = new Request(
            "http://localhost/api/publicaciones/operador/15"
        );

        const respuesta = await GET(solicitud, {
            params: Promise.resolve({ id: "15" }),
        });

        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(200);

        expect(cuerpo).toEqual({
            publicaciones: [
            {
                id: 10,
                fecha: new Date("2026-09-20").toString(),
                especie: "Manzana",
                variedad: "Gala",
                presentacion: "Caja",
                categoria: "Primera",
                calibre: "Grande",
                pais: "Uruguay",
                precio: "150",
                disponible: true,
            },
            ],
        });
        });
});