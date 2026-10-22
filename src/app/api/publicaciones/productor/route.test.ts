// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    const consulta = () => ({ all: vi.fn(), first: vi.fn(), where: vi.fn(), select: vi.fn() });
    return {
        obtenerSesion: vi.fn(), altaPublicacionProductor: vi.fn(),
        modelos: { Productor: consulta(), Especie: consulta(), Variedad: consulta(), Presentacion: consulta(), Categoria: consulta(), Calibre: consulta(), Pais: consulta() },
    };
});
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: { public: mocks.modelos } } }));
vi.mock("@/modulos/identidad-acceso/autenticacion/sesiones", () => ({ obtenerSesion: mocks.obtenerSesion }));
vi.mock("@/modulos/publicaciones/altaPublicacionProductor", () => ({ altaPublicacionProductor: mocks.altaPublicacionProductor }));

import { GET, POST } from "./route";

function solicitud(datos: unknown) {
    return new Request("http://localhost/api/publicaciones/productor", { method: "POST", body: JSON.stringify(datos), headers: { "Content-Type": "application/json" } });
}

describe("/api/publicaciones/productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        for (const modelo of Object.values(mocks.modelos)) {
            modelo.where.mockReturnValue(modelo);
            modelo.select.mockReturnValue(modelo);
            modelo.all.mockResolvedValue([]);
        }
        mocks.obtenerSesion.mockResolvedValue({ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 });
        mocks.modelos.Productor.first.mockResolvedValue({ id: 4, usuarioId: 10 });
        mocks.altaPublicacionProductor.mockResolvedValue({ esValido: true, id: 42, mensaje: "Publicación creada correctamente." });
        vi.spyOn(console, "error").mockImplementation(() => undefined);
    });
    afterEach(() => vi.restoreAllMocks());

    it.each([
        { rol: null, status: 401 }, { rol: "OPERADOR", status: 403 },
    ])("rechaza GET y POST para $rol con $status antes de consultar la base", async ({ rol, status }) => {
        mocks.obtenerSesion.mockResolvedValue(rol ? { usuarioId: 10, rol, expiraEn: 2000000000 } : null);
        for (const respuesta of [await GET(), await POST(solicitud({}))]) {
            expect(respuesta.status).toBe(status);
            expect((await respuesta.json()).errores).toHaveLength(1);
        }
        expect(mocks.modelos.Productor.where).not.toHaveBeenCalled();
        expect(mocks.modelos.Especie.select).not.toHaveBeenCalled();
        expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
    });

    it("devuelve los catálogos disponibles sin exponer una selección de Productores", async () => {
        mocks.modelos.Especie.all.mockResolvedValue([{ id: 1, nombreEspecie: "Manzana" }]);
        mocks.modelos.Variedad.all.mockResolvedValue([{ id: 2, especieId: 1, nombreVariedad: "Royal" }]);
        mocks.modelos.Presentacion.all.mockResolvedValue([{ id: 3, variedadId: 2, nombrePresentacion: "Caja" }]);
        mocks.modelos.Categoria.all.mockResolvedValue([{ id: 4, especieId: 1, nombreCategoria: "Primera" }]);
        mocks.modelos.Calibre.all.mockResolvedValue([{ id: 5, nombreCalibre: "Grande" }]);
        mocks.modelos.Pais.all.mockResolvedValue([{ id: 6, codigoPais: "UY", nombrePais: "Uruguay" }]);

        const respuesta = await GET();

        expect(respuesta.status).toBe(200);
        expect(await respuesta.json()).toEqual({
            especies: [{ id: 1, nombre: "Manzana" }], variedades: [{ id: 2, especieId: 1, nombre: "Royal" }],
            presentaciones: [{ id: 3, variedadId: 2, nombre: "Caja" }], categorias: [{ id: 4, especieId: 1, nombre: "Primera" }],
            calibres: [{ id: 5, nombre: "Grande" }], paises: [{ id: 6, codigo: "UY", nombre: "Uruguay" }],
        });
        expect(mocks.modelos.Especie.where).toHaveBeenCalledWith({ especieActiva: true });
        expect(mocks.modelos.Variedad.where).toHaveBeenCalledWith({ variedadActiva: true });
        expect(mocks.modelos.Presentacion.where).toHaveBeenCalledWith({ presentacionActiva: true });
    });

    it("informa un error de carga de catálogos", async () => {
        mocks.modelos.Especie.all.mockRejectedValue(new Error("Sin conexión"));
        const respuesta = await GET();
        expect(respuesta.status).toBe(500);
        expect(await respuesta.json()).toEqual({ errores: ["No se pudieron cargar los datos del formulario."] });
    });

    it.each([{}, { productorId: 4 }])("crea con el Productor de la sesión aunque el cuerpo no lo indique", async (datos) => {
        const respuesta = await POST(solicitud({ ...datos, precio: "1250" }));
        expect(respuesta.status).toBe(201);
        expect(mocks.modelos.Productor.where).toHaveBeenCalledExactlyOnceWith({ usuarioId: 10 });
        expect(mocks.altaPublicacionProductor).toHaveBeenCalledExactlyOnceWith({ productorId: 4, precio: "1250" });
        expect(await respuesta.json()).toMatchObject({ esValido: true, id: 42 });
    });

    it("rechaza cambiar el identificador para publicar en nombre de otro Productor", async () => {
        const respuesta = await POST(solicitud({ productorId: 8 }));
        expect(respuesta.status).toBe(403);
        expect(await respuesta.json()).toEqual({ errores: ["No tenés permiso para publicar para otro Productor."] });
        expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
    });

    it("rechaza un perfil que no pertenece al usuario autenticado", async () => {
        mocks.modelos.Productor.first.mockResolvedValue({ id: 4, usuarioId: 99 });
        expect((await POST(solicitud({}))).status).toBe(403);
        expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
    });

    it("informa cuando no existe un perfil de Productor", async () => {
        mocks.modelos.Productor.first.mockResolvedValue(null);
        const respuesta = await POST(solicitud({}));
        expect(respuesta.status).toBe(404);
        expect(await respuesta.json()).toEqual({ errores: ["No se encontró el Productor."] });
        expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
    });

    it.each([null, [], "producto"].map((datos) => ({ datos })))("rechaza cuerpos que no son objetos: $datos", async ({ datos }) => {
        const respuesta = await POST(solicitud(datos));
        expect(respuesta.status).toBe(400);
        expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
    });

    it("rechaza JSON mal formado sin guardar", async () => {
        const respuesta = await POST(new Request("http://localhost/api/publicaciones/productor", { method: "POST", body: "{" }));
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual({ errores: ["El cuerpo de la solicitud no es un JSON válido."] });
        expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
    });

    it("devuelve los errores de validación o duplicado con estado 400", async () => {
        const resultado = { esValido: false, errores: ["El producto ya existe."] };
        mocks.altaPublicacionProductor.mockResolvedValue(resultado);
        const respuesta = await POST(solicitud({}));
        expect(respuesta.status).toBe(400);
        expect(await respuesta.json()).toEqual(resultado);
    });

    it("informa un fallo inesperado al guardar", async () => {
        mocks.altaPublicacionProductor.mockRejectedValue(new Error("Base no disponible"));
        const respuesta = await POST(solicitud({}));
        expect(respuesta.status).toBe(500);
        expect(await respuesta.json()).toEqual({ errores: ["No se pudo guardar la publicación."] });
    });

    describe("como Administrador (precarga BP-14.2)", () => {
        beforeEach(() => {
            mocks.obtenerSesion.mockResolvedValue({ usuarioId: 1, rol: "ADMINISTRADOR", expiraEn: 2000000000 });
            mocks.modelos.Productor.first.mockResolvedValue({ id: 8 });
        });

        it("carga los catálogos del formulario", async () => {
            expect((await GET()).status).toBe(200);
        });

        it("crea la publicación para el Productor indicado", async () => {
            const respuesta = await POST(solicitud({ productorId: 8, precio: "1250" }));
            expect(respuesta.status).toBe(201);
            expect(mocks.modelos.Productor.where).toHaveBeenCalledExactlyOnceWith({ id: 8 });
            expect(mocks.altaPublicacionProductor).toHaveBeenCalledExactlyOnceWith({ productorId: 8, precio: "1250" });
        });

        it.each([{}, { productorId: "8" }, { productorId: 0 }])("exige un productor válido: %o", async (datos) => {
            const respuesta = await POST(solicitud(datos));
            expect(respuesta.status).toBe(400);
            expect(await respuesta.json()).toEqual({ errores: ["Debe seleccionar un productor."] });
            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
        });

        it("informa cuando el Productor no existe", async () => {
            mocks.modelos.Productor.first.mockResolvedValue(null);
            const respuesta = await POST(solicitud({ productorId: 99 }));
            expect(respuesta.status).toBe(404);
            expect(await respuesta.json()).toEqual({ errores: ["El productor no existe."] });
            expect(mocks.altaPublicacionProductor).not.toHaveBeenCalled();
        });
    });
});
