import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { altaPublicacionOperador } from "./altaPublicacionOperador";
import { ErrorImagenPublicacion } from "./operadores/imagenes-publicacion";

const mocks = vi.hoisted(() => ({
    validar: vi.fn(), operador: vi.fn(), variedad: vi.fn(), presentacion: vi.fn(), categoria: vi.fn(),
    calibre: vi.fn(), pais: vi.fn(), especie: vi.fn(), relaciones: vi.fn(), coincidencias: vi.fn(),
    crear: vi.fn(), crearRelacion: vi.fn(), actualizar: vi.fn(), guardar: vi.fn(), eliminar: vi.fn(),
    transaccion: vi.fn(), notificar: vi.fn(), bloquear: vi.fn(), operadorActual: vi.fn(), reservar: vi.fn(),
}));

vi.mock("./validarAltaPublicacionOperador", () => ({ validarAltaPublicacionOperador: mocks.validar }));
vi.mock("./operadores/imagenes-publicacion", () => ({
    guardarImagenPublicacion: mocks.guardar,
    eliminarImagenPublicacionGestionada: mocks.eliminar,
    ErrorImagenPublicacion: class extends Error {},
}));
vi.mock("@/infraestructura/tiempo-real/publicaciones", () => ({ notificarCambioPublicacion: mocks.notificar }));
vi.mock("./operadores/limpiar-imagen-publicacion", () => ({ limpiarImagenPublicacionNoReferenciada: mocks.eliminar }));
vi.mock("../../infraestructura/persistencia/prisma/db", () => {
    const entidad = (first: ReturnType<typeof vi.fn>) => ({ where: () => ({ first }) });
    const tx = {
        execute: mocks.bloquear,
        orm: { public: {
            Operador: entidad(mocks.operadorActual),
            PublicacionOperador: { where: () => ({ all: mocks.relaciones }), create: mocks.crearRelacion },
            Publicacion: { create: mocks.crear, where: () => ({ update: mocks.actualizar, select: () => ({ all: mocks.coincidencias }) }) },
        } },
    };
    return { db: {
        transaction: (callback: (tx: unknown) => Promise<unknown>) => mocks.transaccion(() => callback(tx)),
        runtime: () => ({ query: mocks.reservar }),
        orm: { public: {
            Operador: entidad(mocks.operador), Variedad: entidad(mocks.variedad), Presentacion: entidad(mocks.presentacion),
            Categoria: entidad(mocks.categoria), Calibre: entidad(mocks.calibre), Pais: entidad(mocks.pais), Especie: entidad(mocks.especie),
        } },
        raw: { sql: (partes: TemplateStringsArray, ...valores: unknown[]) => ({
            returnsRow: () => ({ build: () => ({ texto: partes.join("?"), valores }) }),
        }) },
    } };
});

const DATOS = {
    operadorId: 1, especieId: 10, variedadId: 20, presentacionId: 30, categoriaId: 40, calibreId: 50,
    paisId: 60, disponibilidad: true, precio: "1500", cantidadUnidades: 5, fotografia: "data:image/png;base64,YWJj",
};
const URL = "/api/publicaciones/imagenes/777/12345678-1234-4234-8234-123456789abc.webp";

beforeEach(() => {
    vi.resetAllMocks();
    mocks.validar.mockReturnValue({ esValido: true, datos: DATOS });
    mocks.operador.mockResolvedValue({ id: 1 });
    mocks.operadorActual.mockResolvedValue({ id: 1 });
    mocks.variedad.mockResolvedValue({ id: 20, especieId: 10, variedadActiva: true });
    mocks.presentacion.mockResolvedValue({ id: 30, variedadId: 20, presentacionActiva: true });
    mocks.categoria.mockResolvedValue({ id: 40, especieId: 10 });
    mocks.calibre.mockResolvedValue({ id: 50 });
    mocks.pais.mockResolvedValue({ id: 60 });
    mocks.especie.mockResolvedValue({ id: 10, especieActiva: true });
    mocks.relaciones.mockResolvedValue([]);
    mocks.crear.mockResolvedValue({ id: 777 });
    mocks.crearRelacion.mockResolvedValue({ id: 888 });
    mocks.guardar.mockResolvedValue(URL);
    mocks.reservar.mockResolvedValue([{ id: 777 }]);
    mocks.transaccion.mockImplementation((callback) => callback());
});

afterEach(() => vi.restoreAllMocks());

describe("altaPublicacionOperador", () => {
    it("devuelve los errores del validador sin consultar la base", async () => {
        mocks.validar.mockReturnValue({ esValido: false, errores: ["Inválida"] });
        expect(await altaPublicacionOperador(null)).toEqual({ esValido: false, errores: ["Inválida"] });
        expect(mocks.operador).not.toHaveBeenCalled();
    });

    it.each([undefined, null, "", "   "])("persiste null cuando el precio es %j", async (precio) => {
        mocks.validar.mockReturnValue({ esValido: true, datos: { ...DATOS, precio } });
        expect((await altaPublicacionOperador({ ...DATOS, precio })).esValido).toBe(true);
        expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({ precio: null }));
    });

    it("rechaza catálogos inactivos antes de guardar la imagen", async () => {
        mocks.variedad.mockResolvedValue({ id: 20, especieId: 10, variedadActiva: false });
        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(false);
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("guarda la fotografía mediante el servicio y persiste solamente su URL", async () => {
        expect(await altaPublicacionOperador(DATOS)).toEqual({ esValido: true, id: 777, mensaje: "Publicación creada correctamente." });
        expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({ id: 777, foto: URL, precio: "1500", cantidadUnidades: 5 }));
        expect(mocks.guardar).toHaveBeenCalledWith(777, DATOS.fotografia);
        expect(mocks.actualizar).not.toHaveBeenCalled();
        expect(mocks.eliminar).not.toHaveBeenCalled();
        expect(mocks.notificar).toHaveBeenCalledWith(expect.anything(), { operadorId: 1, publicacionId: 777 });
    });

    it("rechaza guardar si se eliminó el operador mientras esperaba el bloqueo", async () => {
        let liberar!: () => void;
        let avisarEspera!: () => void;
        const bloqueo = new Promise<void>((resolve) => { liberar = resolve; });
        const esperando = new Promise<void>((resolve) => { avisarEspera = resolve; });
        mocks.bloquear.mockImplementation(async () => {
            avisarEspera();
            await bloqueo;
        });

        const guardado = altaPublicacionOperador(DATOS);
        await esperando;
        expect(mocks.operadorActual).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();
        mocks.operadorActual.mockResolvedValue(null);
        liberar();

        expect(await guardado).toEqual({
            esValido: false,
            errores: ["El operador ya no existe. No se pudo guardar la publicación."],
        });
        expect(mocks.bloquear).toHaveBeenCalledWith({
            texto: "SELECT 1::int AS locked FROM pg_advisory_xact_lock(1719, ?)", valores: [1],
        });
        expect(mocks.relaciones).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();
        expect(mocks.crearRelacion).not.toHaveBeenCalled();
        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(URL, 777);
        expect(mocks.notificar).not.toHaveBeenCalled();
    });

    it("permite crear sin fotografía", async () => {
        mocks.validar.mockReturnValue({ esValido: true, datos: { ...DATOS, fotografia: "" } });
        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(true);
        expect(mocks.guardar).not.toHaveBeenCalled();
        expect(mocks.actualizar).not.toHaveBeenCalled();
        expect(mocks.reservar).not.toHaveBeenCalled();
        expect(mocks.crear).toHaveBeenCalledWith(expect.objectContaining({ foto: null }));
        expect(mocks.crear.mock.calls[0][0]).not.toHaveProperty("id");
    });

    it("rechaza duplicados y limpia la imagen preparada sin notificar", async () => {
        mocks.relaciones.mockResolvedValue([{ publicacionId: 444 }]);
        mocks.coincidencias.mockResolvedValue([{ id: 444 }]);
        expect((await altaPublicacionOperador(DATOS)).esValido).toBe(false);
        expect(mocks.crear).not.toHaveBeenCalled();
        expect(mocks.eliminar).toHaveBeenCalledExactlyOnceWith(URL, 777);
        expect(mocks.notificar).not.toHaveBeenCalled();
    });

    it("convierte el rechazo del contenido de la imagen en un error de formulario", async () => {
        mocks.guardar.mockRejectedValue(new ErrorImagenPublicacion("Imagen inválida"));
        expect(await altaPublicacionOperador(DATOS)).toEqual({ esValido: false, errores: ["Imagen inválida"] });
        expect(mocks.notificar).not.toHaveBeenCalled();
    });

    it.each(["creación", "vínculo", "commit"])("limpia la fotografía nueva cuando falla %s", async (momento) => {
        const error = new Error("Fallo de base de datos");
        if (momento === "creación") mocks.crear.mockRejectedValue(error);
        else if (momento === "vínculo") mocks.crearRelacion.mockRejectedValue(error);
        else mocks.transaccion.mockImplementation(async (callback) => { await callback(); throw error; });
        await expect(altaPublicacionOperador(DATOS)).rejects.toBe(error);
        expect(mocks.eliminar).toHaveBeenCalledWith(URL, 777);
    });

    it("propaga el error original después de solicitar la limpieza", async () => {
        const error = new Error("Fallo original");
        mocks.crear.mockRejectedValue(error);
        mocks.eliminar.mockResolvedValue(undefined);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(altaPublicacionOperador(DATOS)).rejects.toBe(error);
    });

    it("espera a que la imagen esté lista antes de abrir una transacción", async () => {
        let terminarImagen!: (url: string) => void;
        let avisarInicio!: () => void;
        const iniciada = new Promise<void>((resolve) => { avisarInicio = resolve; });
        mocks.guardar.mockImplementation(() => {
            avisarInicio();
            return new Promise<string>((resolve) => { terminarImagen = resolve; });
        });
        const guardado = altaPublicacionOperador(DATOS);
        await iniciada;
        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.crear).not.toHaveBeenCalled();
        terminarImagen(URL);
        expect((await guardado).esValido).toBe(true);
        expect(mocks.transaccion).toHaveBeenCalledOnce();
    });

    it("no abre una transacción ni escribe archivos si falla la reserva del ID", async () => {
        const error = new Error("No se pudo reservar el ID");
        mocks.reservar.mockRejectedValue(error);
        await expect(altaPublicacionOperador(DATOS)).rejects.toBe(error);
        expect(mocks.transaccion).not.toHaveBeenCalled();
        expect(mocks.guardar).not.toHaveBeenCalled();
    });
});
