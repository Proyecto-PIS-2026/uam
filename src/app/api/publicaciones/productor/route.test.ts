
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LIMITE_JSON_PUBLICACION } from "@/infraestructura/http/cuerpo-limitado";

const registrarEstadisticaMock = vi.hoisted(() => vi.fn());
vi.mock("@/modulos/administracion/estadisticas/registrar-estadisticas", () => ({
    registrarPublicacion: registrarEstadisticaMock,
    obtenerFechaEstadistica: () => "2026-11-06",
}));

const mocks = vi.hoisted(() => {
    const consulta = () => ({
        all: vi.fn(),
        first: vi.fn(),
        where: vi.fn(),
        select: vi.fn(),
        orderBy: vi.fn(),
        update: vi.fn(),
        create: vi.fn(),
    });

    return {
        obtenerSesion: vi.fn(),
        autorizado: vi.fn(),
        altaPublicacionProductor: vi.fn(),
        modelos: {
            Productor: consulta(),
            Especie: consulta(),
            Variedad: consulta(),
            Envase: consulta(),
            KilosEmpaquetado: consulta(),
            Categoria: consulta(),
            Calibre: consulta(),
            Pais: consulta(),
            Usuario: consulta(),
            EstadisticaPublicacion: consulta(),
        },
    };
});

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { orm: { public: mocks.modelos } },
}));

vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({
    obtenerSesion: mocks.obtenerSesion,
}));

vi.mock("@/modulos/identidad-acceso/autorizacion/permisos", () => ({
    autorizado: mocks.autorizado,
}));

vi.mock("@/modulos/publicaciones/altaPublicacionProductor", () => ({
    altaPublicacionProductor: mocks.altaPublicacionProductor,
}));

import { GET, POST } from "./route";

const resultadoValido = {
    esValido: true,
    id: 42,
    mensaje: "Publicación creada correctamente.",
};

function solicitud(datos: unknown) {
    return new Request("http://localhost/api/publicaciones/productor", {
        method: "POST",
        body: JSON.stringify(datos),
        headers: { "Content-Type": "application/json" },
    });
}

describe("/api/publicaciones/productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    registrarEstadisticaMock.mockReset().mockResolvedValue(undefined);

        for (const modelo of Object.values(mocks.modelos)) {
            modelo.where.mockReturnThis();
            modelo.select.mockReturnThis();
            modelo.orderBy.mockReturnThis();
            modelo.all.mockResolvedValue([]);
            modelo.first.mockResolvedValue(null);
            modelo.update.mockResolvedValue(1);
            modelo.create.mockResolvedValue({ id: 1 });
        }

        mocks.obtenerSesion.mockResolvedValue({
            usuarioId: 10,
            rol: "PRODUCTOR",
            expiraEn: 2000000000,
        });

        mocks.autorizado.mockImplementation((permiso: string, sesion: { rol: string; usuarioId: number }, productor?: { usuarioId: number }) => {
            if (permiso === "administracion.publicacion.crear") {
                return sesion.rol === "ADMINISTRADOR";
            }

            if (permiso === "productor.publicacion.crear") {
                return sesion.rol === "PRODUCTOR" && productor?.usuarioId === sesion.usuarioId;
            }

            return false;
        });

        mocks.modelos.Productor.first.mockResolvedValue({
            id: 4,
            usuarioId: 10,
        });

        mocks.modelos.Usuario.first.mockResolvedValue({
            username: "productor1",
        });

        mocks.modelos.EstadisticaPublicacion.first.mockResolvedValue(null);

        mocks.altaPublicacionProductor.mockResolvedValue(resultadoValido);

        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("GET /api/publicaciones/productor", () => {
        it.each([
            { rol: null, status: 401 },
            { rol: "OPERADOR", status: 403 },
        ])("rechaza GET para el rol $rol con estado $status", async ({ rol, status }) => {
            mocks.obtenerSesion.mockResolvedValue(
                rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null,
            );

            const respuesta = await GET();

            expect(respuesta.status).toBe(status);
            expect(await respuesta.json()).toEqual({
                errores: [
                    rol
                        ? "No tenés permiso para realizar esta operación."
                        : "Iniciá sesión para continuar.",
                ],
            });

            expect(mocks.modelos.Especie.select).not.toHaveBeenCalled();
            expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
        });

        it("devuelve los catálogos disponibles sin exponer una selección de Productores", async () => {
            mocks.modelos.Especie.all.mockResolvedValue([
                { id: 1, nombreEspecie: "Manzana" },
            ]);

            mocks.modelos.Variedad.all.mockResolvedValue([
                { id: 2, especieId: 1, nombreVariedad: "Royal" },
            ]);

            mocks.modelos.Envase.all.mockResolvedValue([
                { id: 3, nombreEnvase: "Cajon" },
            ]);

            mocks.modelos.KilosEmpaquetado.all.mockResolvedValue([{ id: 1, valor: "10-12" }]);
            mocks.modelos.Categoria.all.mockResolvedValue([
                { id: 4, especieId: 1, nombreCategoria: "Primera" },
            ]);

            mocks.modelos.Calibre.all.mockResolvedValue([
                { id: 5, nombreCalibre: "Grande" },
            ]);

            mocks.modelos.Pais.all.mockResolvedValue([
                { id: 6, codigoPais: "UY", nombrePais: "Uruguay" },
            ]);

            const respuesta = await GET();

            expect(respuesta.status).toBe(200);
            expect(await respuesta.json()).toEqual({
                especies: [{ id: 1, nombre: "Manzana" }],
                variedades: [{ id: 2, especieId: 1, nombre: "Royal" }],
                envases: [{ id: 3, nombre: "Cajon" }],
                kilos: [{ id: 1, nombre: "10-12" }],
                categorias: [{ id: 4, especieId: 1, nombre: "Primera" }],
                calibres: [{ id: 5, nombre: "Grande" }],
                paises: [{ id: 6, codigo: "UY", nombre: "Uruguay" }],
            });

            expect(mocks.modelos.Especie.where).toHaveBeenCalledWith({
                especieActiva: true,
            });

            expect(mocks.modelos.Variedad.where).toHaveBeenCalledWith({
                variedadActiva: true,
            });

            expect(mocks.modelos.Envase.where).not.toHaveBeenCalled();
            expect(mocks.modelos.KilosEmpaquetado.where).not.toHaveBeenCalled();

            expect(mocks.modelos.Categoria.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Calibre.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Pais.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Productor.all).not.toHaveBeenCalled();

            expect(mocks.modelos.Especie.select).toHaveBeenCalledWith(
                "id",
                "nombreEspecie",
            );
        });

        it.each(["PRODUCTOR", "ADMINISTRADOR"])("permite cargar los catálogos para %s", async (rol) => {
            mocks.obtenerSesion.mockResolvedValue({
                usuarioId: 10,
                rol,
                expiraEn: 2000000000,
            });

            const respuesta = await GET();

            expect(respuesta.status).toBe(200);
            expect(mocks.modelos.Especie.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Variedad.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Envase.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Categoria.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Calibre.all).toHaveBeenCalledOnce();
            expect(mocks.modelos.Pais.all).toHaveBeenCalledOnce();
        });

        it("informa un error cuando falla la consulta de los catálogos", async () => {
            mocks.modelos.Especie.all.mockRejectedValue(new Error("Sin conexión"));

            const respuesta = await GET();

            expect(respuesta.status).toBe(500);
            expect(await respuesta.json()).toEqual({
                errores: ["No se pudieron cargar los datos del formulario."],
            });
            expect(console.error).toHaveBeenCalledOnce();
        });
    });

    describe("POST /api/publicaciones/productor", () => {
        it.each([
            { rol: null, status: 401 },
            { rol: "OPERADOR", status: 403 },
        ])("rechaza POST para el rol $rol con estado $status", async ({ rol, status }) => {
            mocks.obtenerSesion.mockResolvedValue(
                rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null,
            );

            const respuesta = await POST(solicitud({}));

            expect(respuesta.status).toBe(status);
            expect(await respuesta.json()).toEqual({
                errores: [
                    rol
                        ? "No tenés permiso para realizar esta operación."
                        : "Iniciá sesión para continuar.",
                ],
            });

            expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("rechaza cuerpos que no son objetos", async () => {
            const cuerpos = [null, [], "producto", 123];

            for (const datos of cuerpos) {
                const respuesta = await POST(solicitud(datos));

                expect(respuesta.status).toBe(400);
                expect(await respuesta.json()).toEqual({
                    errores: ["Los datos de la publicación no son válidos."],
                });
            }

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
            expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
        });

        it("rechaza JSON mal formado sin guardar", async () => {
            const respuesta = await POST(new Request(
                "http://localhost/api/publicaciones/productor",
                {
                    method: "POST",
                    body: "{",
                },
            ));

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({
                errores: ["El cuerpo de la solicitud no es un JSON válido."],
            });

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
            expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
        });

        it.each(["PRODUCTOR", "ADMINISTRADOR"])("rechaza con 413 un cuerpo excesivo de %s antes de consultar o guardar", async (rol) => {
            mocks.obtenerSesion.mockResolvedValue({
                usuarioId: 10,
                rol,
                expiraEn: 2000000000,
            });

            const respuesta = await POST(new Request(
                "http://localhost/api/publicaciones/productor",
                {
                    method: "POST",
                    body: "{}",
                    headers: {
                        "Content-Type": "application/json",
                        "Content-Length": String(LIMITE_JSON_PUBLICACION + 1),
                    },
                },
            ));

            expect(respuesta.status).toBe(413);
            expect(await respuesta.json()).toEqual({
                errores: ["La solicitud es demasiado grande. La fotografía debe pesar hasta 10 MB."],
            });

            expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
        });

        it.each([
            {},
            { productorId: 4 },
        ])("crea con el Productor de la sesión: %o", async (datos) => {
            const respuesta = await POST(solicitud({
                ...datos,
                precio: "1250",
            }));

            expect(respuesta.status).toBe(201);
            expect(mocks.modelos.Productor.where).toHaveBeenCalledExactlyOnceWith({
                usuarioId: 10,
            });

            expect(mocks.altaPublicacionProductor).toHaveBeenCalledExactlyOnceWith({
                productorId: 4,
                precio: "1250",
            });

            expect(await respuesta.json()).toEqual(resultadoValido);
        });

        it("registra una estadística nueva cuando el productor crea una publicación", async () => {
            const respuesta = await POST(solicitud({
                precio: "1250",
            }));

            expect(respuesta.status).toBe(201);

            expect(mocks.modelos.Usuario.select).toHaveBeenCalledExactlyOnceWith("username");
            expect(mocks.modelos.Usuario.where).toHaveBeenCalledExactlyOnceWith({
                id: 10,
            });




            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1");

        });

        it("incrementa la estadística existente del productor", async () => {

            const respuesta = await POST(solicitud({ precio: "1250" }));

            expect(respuesta.status).toBe(201);

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1");




        });

        it("no registra estadísticas cuando el usuario vinculado no tiene username", async () => {
            mocks.modelos.Usuario.first.mockResolvedValue({
                username: null,
            });

            const respuesta = await POST(solicitud({ precio: "1250" }));

            expect(respuesta.status).toBe(201);
            expect(mocks.modelos.Usuario.where).toHaveBeenCalledWith({ id: 10 });

            expect(registrarEstadisticaMock).not.toHaveBeenCalled();

        });

        it("confirma la publicación aunque falle el registro de la estadística", async () => {
            registrarEstadisticaMock.mockRejectedValue(
                new Error("Error de base de datos"),
            );

            const respuesta = await POST(solicitud({ precio: "1250" }));

            expect(respuesta.status).toBe(201);
            expect(await respuesta.json()).toEqual(resultadoValido);

            expect(mocks.altaPublicacionProductor).toHaveBeenCalledOnce();
            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1");
            expect(console.error).toHaveBeenCalledWith(
                "Error al registrar estadística de publicación (productor):",
                expect.any(Error),
            );
        });

        it("no registra estadísticas cuando la creación devuelve errores de validación", async () => {
            const resultado = {
                esValido: false,
                errores: ["El producto ya existe."],
            };

            mocks.altaPublicacionProductor.mockResolvedValue(resultado);

            const respuesta = await POST(solicitud({ precio: "1250" }));

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual(resultado);

            expect(mocks.modelos.Usuario.where).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();

        });

        it("rechaza cambiar el identificador para publicar en nombre de otro Productor", async () => {
            const respuesta = await POST(solicitud({
                productorId: 8,
            }));

            expect(respuesta.status).toBe(403);
            expect(await respuesta.json()).toEqual({
                errores: ["No tenés permiso para publicar para otro Productor."],
            });

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("rechaza un perfil que no pertenece al usuario autenticado", async () => {
            mocks.modelos.Productor.first.mockResolvedValue({
                id: 4,
                usuarioId: 99,
            });

            const respuesta = await POST(solicitud({}));

            expect(respuesta.status).toBe(403);
            expect(await respuesta.json()).toEqual({
                errores: ["No tenés permiso para realizar esta operación."],
            });

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
        });

        it("rechaza la operación cuando el Productor no tiene permiso para crear publicaciones", async () => {
            mocks.autorizado.mockReturnValue(false);

            const respuesta = await POST(solicitud({}));

            expect(respuesta.status).toBe(403);
            expect(await respuesta.json()).toEqual({
                errores: ["No tenés permiso para realizar esta operación."],
            });

            expect(mocks.modelos.Productor.where).toHaveBeenCalledWith({
                usuarioId: 10,
            });

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
        });

        it("informa cuando no existe un perfil de Productor", async () => {
            mocks.modelos.Productor.first.mockResolvedValue(null);

            const respuesta = await POST(solicitud({}));

            expect(respuesta.status).toBe(404);
            expect(await respuesta.json()).toEqual({
                errores: ["No se encontró el Productor."],
            });

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
        });

        it("informa un fallo inesperado al guardar", async () => {
            mocks.altaPublicacionProductor.mockRejectedValue(
                new Error("Base no disponible"),
            );

            const respuesta = await POST(solicitud({}));

            expect(respuesta.status).toBe(500);
            expect(await respuesta.json()).toEqual({
                errores: ["No se pudo guardar la publicación."],
            });

            expect(console.error).toHaveBeenCalledOnce();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });
    });

    describe("POST como Administrador", () => {
        beforeEach(() => {
            mocks.obtenerSesion.mockResolvedValue({
                usuarioId: 1,
                rol: "ADMINISTRADOR",
                expiraEn: 2000000000,
            });

            mocks.modelos.Productor.first.mockResolvedValue({
                id: 8,
                usuarioId: 80,
            });
        });

        it("permite cargar los catálogos del formulario", async () => {
            const respuesta = await GET();

            expect(respuesta.status).toBe(200);
        });

        it("crea la publicación para el Productor indicado", async () => {
            const respuesta = await POST(solicitud({
                productorId: 8,
                precio: "1250",
            }));

            expect(respuesta.status).toBe(201);

            expect(mocks.modelos.Productor.where).toHaveBeenCalledExactlyOnceWith({
                id: 8,
            });

            expect(mocks.modelos.Productor.select).toHaveBeenCalledWith(
                "id",
                "usuarioId",
            );

            expect(mocks.altaPublicacionProductor).toHaveBeenCalledExactlyOnceWith({
                productorId: 8,
                precio: "1250",
            });

            expect(await respuesta.json()).toEqual(resultadoValido);
        });

        it("registra la estadística utilizando el usuario del Productor seleccionado", async () => {
            const respuesta = await POST(solicitud({
                productorId: 8,
                precio: "1250",
            }));

            expect(respuesta.status).toBe(201);

            expect(mocks.modelos.Usuario.where).toHaveBeenCalledExactlyOnceWith({
                id: 80,
            });

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1");
        });

        it("incrementa la estadística existente del Productor seleccionado", async () => {

            const respuesta = await POST(solicitud({
                productorId: 8,
            }));

            expect(respuesta.status).toBe(201);

            expect(registrarEstadisticaMock).toHaveBeenCalledExactlyOnceWith("productor1");

        });

        it.each([
            {},
            { productorId: "8" },
            { productorId: 0 },
            { productorId: -1 },
            { productorId: 1.5 },
            { productorId: Number.MAX_SAFE_INTEGER + 1 },
            { productorId: null },
        ])("exige un productor válido: %o", async (datos) => {
            const respuesta = await POST(solicitud(datos));

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({
                errores: ["Debe seleccionar un productor."],
            });

            expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("informa cuando el Productor no existe", async () => {
            mocks.modelos.Productor.first.mockResolvedValue(null);

            const respuesta = await POST(solicitud({
                productorId: 99,
            }));

            expect(respuesta.status).toBe(404);
            expect(await respuesta.json()).toEqual({
                errores: ["El productor no existe."],
            });

            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("devuelve los errores de validación con estado 400", async () => {
            const resultado = {
                esValido: false,
                errores: ["El producto ya existe."],
            };

            mocks.altaPublicacionProductor.mockResolvedValue(resultado);

            const respuesta = await POST(solicitud({
                productorId: 8,
            }));

            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual(resultado);

            expect(mocks.modelos.Usuario.where).not.toHaveBeenCalled();
            expect(registrarEstadisticaMock).not.toHaveBeenCalled();
        });

        it("confirma la publicación aunque falle el registro de estadísticas", async () => {
            mocks.modelos.Usuario.first.mockRejectedValue(
                new Error("Base de datos no disponible"),
            );

            const respuesta = await POST(solicitud({
                productorId: 8,
            }));

            expect(respuesta.status).toBe(201);
            expect(await respuesta.json()).toEqual(resultadoValido);

            expect(mocks.altaPublicacionProductor).toHaveBeenCalledOnce();
            expect(console.error).toHaveBeenCalledWith(
                "Error al registrar estadística de publicación (productor):",
                expect.any(Error),
            );
        });
    });
});
