import { beforeEach, describe, expect, it, vi } from "vitest";


const mocks = vi.hoisted(() => ({
  operadores: vi.fn(),
  especies: vi.fn(),
  variedades: vi.fn(),
  presentaciones: vi.fn(),
  categorias: vi.fn(),
  calibres: vi.fn(),
  paises: vi.fn(),
  altaPublicacionOperador: vi.fn(),
  obtenerOperadorActual: vi.fn(() => Promise.resolve({ id: 1, usuarioId: 10, nombreFantasia: "Operador 1" })),
  obtenerOperadorPorId: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modulos/usuarios/operadores/operador-actual", () => ({
  obtenerOperadorActual: mocks.obtenerOperadorActual,
  obtenerOperadorPorId: mocks.obtenerOperadorPorId,
}));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
  db: {
    orm: {
      public: {
        Operador: { all: mocks.operadores },
        Especie: { all: mocks.especies },
        Variedad: { all: mocks.variedades },
        Presentacion: { all: mocks.presentaciones },
        Categoria: { all: mocks.categorias },
        Calibre: { all: mocks.calibres },
        Pais: { all: mocks.paises },
      },
    },
  },
}));

vi.mock("@/modulos/publicaciones/altaPublicacionOperador", () => ({
  altaPublicacionOperador: mocks.altaPublicacionOperador,
}));

import { GET, POST } from "./route";
import { revalidatePath } from "next/cache";

describe("GET /api/publicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("devuelve los catálogos de publicaciones", async () => {
        mocks.operadores.mockResolvedValue([
        { id: 1, nombreFantasia: "Operador 1" },
        ]);

        mocks.especies.mockResolvedValue([
        { id: 1, nombreEspecie: "Manzana", especieActiva: true },
        ]);

        mocks.variedades.mockResolvedValue([]);
        mocks.presentaciones.mockResolvedValue([]);
        mocks.categorias.mockResolvedValue([]);
        mocks.calibres.mockResolvedValue([]);
        mocks.paises.mockResolvedValue([]);

        const respuesta = await GET();
        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(200);

        expect(cuerpo.operadores).toEqual([
        { id: 1, nombre: "Operador 1" },
        ]);

        expect(cuerpo.especies).toEqual([
        { id: 1, nombre: "Manzana" },
        ]);
    });
  
    it("devuelve 500 si ocurre un error al cargar los catálogos", async () => {
        mocks.operadores.mockRejectedValue(new Error("Error de base de datos"));

        const respuesta = await GET();
        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(500);

        expect(cuerpo).toEqual({
            errores: ["No se pudieron cargar los datos del formulario."],
        });
    });

});

describe("POST /api/publicaciones", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 1, usuarioId: 10, nombreFantasia: "Operador 1" });
    });

    it("devuelve 400 si el cuerpo no es un JSON válido", async () => {
        const solicitud = new Request(
        "http://localhost/api/publicaciones",
        {
            method: "POST",
            body: "{json-invalido",
            headers: {
            "Content-Type": "application/json",
            },
        }
        );

        const respuesta = await POST(solicitud);
        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(400);

        expect(cuerpo).toEqual({
            errores: ["El cuerpo de la solicitud no es un JSON válido."],
            });
    });

    it("devuelve 201 si la publicación se crea correctamente", async () => {
        const resultadoEsperado = {
            esValido: true,
            errores: [],
        };

        mocks.altaPublicacionOperador.mockResolvedValue(resultadoEsperado);

        const datos = {
            operadorId: 1,
        };

        const solicitud = new Request(
            "http://localhost/api/publicaciones",
            {
            method: "POST",
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "application/json",
            },
            }
        );

        const respuesta = await POST(solicitud);
        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(201);
        expect(mocks.altaPublicacionOperador).toHaveBeenCalledWith(datos);
        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(1);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado");
        expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%201");
        expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%201");
        expect(cuerpo).toEqual(resultadoEsperado);
    });

    it("confirma la creacion aunque falle una revalidacion posterior", async () => {
        const resultado = { esValido: true, id: 15, errores: [] };
        mocks.altaPublicacionOperador.mockResolvedValue(resultado);
        vi.mocked(revalidatePath).mockImplementationOnce(() => { throw new Error("Fallo de cache"); });
        const registrarError = vi.spyOn(console, "error").mockImplementation(() => {});

        try {
            const solicitud = new Request("http://localhost/api/publicaciones", {
                method: "POST",
                body: JSON.stringify({ operadorId: 1 }),
                headers: { "Content-Type": "application/json" },
            });
            const respuesta = await POST(solicitud);

            expect(respuesta.status).toBe(201);
            expect(await respuesta.json()).toEqual(resultado);
            expect(mocks.altaPublicacionOperador).toHaveBeenCalledOnce();
            expect(revalidatePath).toHaveBeenCalledTimes(6);
            expect(revalidatePath).toHaveBeenCalledWith("/inicio");
            expect(registrarError).toHaveBeenCalledOnce();
        } finally {
            registrarError.mockRestore();
        }
    });

    it("usa el operador actual cuando no se indica un ID", async () => {
        mocks.altaPublicacionOperador.mockResolvedValue({ esValido: true, id: 15, mensaje: "Creada" });
        const datos = { especieId: 4 };
        const solicitud = new Request("http://localhost/api/publicaciones", {
            method: "POST",
            body: JSON.stringify(datos),
            headers: { "Content-Type": "application/json" },
        });

        const respuesta = await POST(solicitud);

        expect(respuesta.status).toBe(201);
        expect(mocks.obtenerOperadorActual).toHaveBeenCalledOnce();
        expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
        expect(mocks.altaPublicacionOperador).toHaveBeenCalledWith({ ...datos, operadorId: 1 });
    });

    it("usa el operador indicado para la publicacion", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue({ id: 7, usuarioId: 70, nombreFantasia: "Operador 7" });
        mocks.altaPublicacionOperador.mockResolvedValue({ esValido: true, id: 15, mensaje: "Creada" });
        const solicitud = new Request("http://localhost/api/publicaciones", {
            method: "POST",
            body: JSON.stringify({ especieId: 4, operadorId: 7 }),
            headers: { "Content-Type": "application/json" },
        });

        const respuesta = await POST(solicitud);

        expect(respuesta.status).toBe(201);
        expect(mocks.obtenerOperadorPorId).toHaveBeenCalledExactlyOnceWith(7);
        expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
        expect(mocks.altaPublicacionOperador).toHaveBeenCalledWith({ especieId: 4, operadorId: 7 });
        expect(revalidatePath).toHaveBeenCalledWith("/mi-mercado/Operador%207");
        expect(revalidatePath).toHaveBeenCalledWith("/operadores/Operador%207");
    });

    it.each([null, "7", 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
        "devuelve 400 para un operadorId invalido: %s",
        async (operadorId) => {
            const solicitud = new Request("http://localhost/api/publicaciones", {
                method: "POST",
                body: JSON.stringify({ operadorId }),
                headers: { "Content-Type": "application/json" },
            });

            const respuesta = await POST(solicitud);

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({ errores: ["El operador no es válido."] });
            expect(mocks.obtenerOperadorActual).not.toHaveBeenCalled();
            expect(mocks.obtenerOperadorPorId).not.toHaveBeenCalled();
            expect(mocks.altaPublicacionOperador).not.toHaveBeenCalled();
        },
    );

    it("devuelve 404 cuando no existe el operador indicado", async () => {
        mocks.obtenerOperadorPorId.mockResolvedValue(null);
        const solicitud = new Request("http://localhost/api/publicaciones", {
            method: "POST",
            body: JSON.stringify({ operadorId: 7 }),
            headers: { "Content-Type": "application/json" },
        });

        const respuesta = await POST(solicitud);

        expect(respuesta.status).toBe(404);
        expect(await respuesta.json()).toEqual({ errores: ["No se encontró el operador seleccionado."] });
        expect(mocks.altaPublicacionOperador).not.toHaveBeenCalled();
    });

    it("devuelve 400 si los datos de la publicación no son válidos", async () => {
        const resultadoEsperado = {
            esValido: false,
            errores: ["Datos inválidos"],
        };

        mocks.altaPublicacionOperador.mockResolvedValue(resultadoEsperado);

        const datos = {
            operadorId: 1,
        };

        const solicitud = new Request(
            "http://localhost/api/publicaciones",
            {
            method: "POST",
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "application/json",
            },
            }
        );

        const respuesta = await POST(solicitud);
        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(400);
        expect(mocks.altaPublicacionOperador).toHaveBeenCalledWith(datos);
        expect(cuerpo).toEqual(resultadoEsperado);
    });

    it("devuelve 500 si ocurre un error al crear la publicación", async () => {
        mocks.altaPublicacionOperador.mockRejectedValue(
            new Error("Error inesperado")
        );

        const datos = {
            operadorId: 1,
        };

        const solicitud = new Request(
            "http://localhost/api/publicaciones",
            {
            method: "POST",
            body: JSON.stringify(datos),
            headers: {
                "Content-Type": "application/json",
            },
            }
        );

        const respuesta = await POST(solicitud);
        const cuerpo = await respuesta.json();

        expect(respuesta.status).toBe(500);

        expect(cuerpo).toEqual({
            errores: ["No se pudo guardar la publicación."],
        });
    });
});
