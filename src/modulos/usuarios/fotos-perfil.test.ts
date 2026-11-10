import { beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorImagen } from "@/infraestructura/imagenes/almacenamiento-imagenes";
import { controlarErrorFotoPerfil, guardarCambioFotoPerfil, validarCambioFotoPerfil } from "./fotos-perfil";
import type { ClienteAlmacenamientoImagenes } from "@/infraestructura/imagenes/almacenamiento-postgres";

const servicio = vi.hoisted(() => ({ guardar: vi.fn(), eliminar: vi.fn() }));
vi.mock("@/infraestructura/imagenes/imagenes", () => ({
    TAMANO_MAXIMO_IMAGEN: 10 * 1024 * 1024,
    crearServicioImagenes: () => servicio,
}));
vi.mock("@/infraestructura/persistencia/prisma/db", () => ({ db: { orm: {} } }));

function formulario(tipo = "image/png", tamano = 4): FormData {
    const archivo = new File([new Uint8Array(tamano)], "perfil.png", { type: tipo });
    Object.defineProperty(archivo, "arrayBuffer", { value: async () => new ArrayBuffer(tamano) });
    const datos = new FormData();
    datos.set("fotoPerfil", archivo);
    return datos;
}

describe("validarCambioFotoPerfil", () => {
    it.each([undefined, new FormData()])("conserva la foto cuando no se pide modificarla", (datos) => {
        expect(validarCambioFotoPerfil(datos)).toEqual({ esValido: true, cambio: { accion: "conservar" } });
    });

    it.each([null, "https://example.com/perfil.png", { fotoPerfil: "/api/imagenes/operadores/1/foto.webp" }])("rechaza entradas sin FormData", (datos) => {
        expect(validarCambioFotoPerfil(datos).esValido).toBe(false);
    });

    it.each(["image/jpeg", "image/png", "image/webp"])("acepta el archivo %s", (tipo) => {
        const datos = formulario(tipo);
        expect(validarCambioFotoPerfil(datos)).toEqual({ esValido: true, cambio: { accion: "reemplazar", archivo: datos.get("fotoPerfil") } });
    });

    it.each(["image/svg+xml", "image/gif", "text/plain", ""])("rechaza el tipo %s", (tipo) => {
        expect(validarCambioFotoPerfil(formulario(tipo))).toEqual({ esValido: false, errores: ["La imagen debe ser JPEG, PNG o WebP."] });
    });

    it.each([0, 10 * 1024 * 1024 + 1])("rechaza un archivo de tamaño inválido: %s", (tamano) => {
        expect(validarCambioFotoPerfil(formulario("image/png", tamano))).toEqual({ esValido: false, errores: ["La imagen debe pesar entre 1 byte y 10 MB."] });
    });

    it("rechaza una URL en lugar de un archivo", () => {
        const datos = new FormData();
        datos.set("fotoPerfil", "/api/imagenes/operadores/999/foto.webp");
        expect(validarCambioFotoPerfil(datos).esValido).toBe(false);
    });

    it("rechaza campos desconocidos y campos duplicados", () => {
        const desconocido = new FormData();
        desconocido.set("fotoActual", "/imagenes/otro.webp");
        expect(validarCambioFotoPerfil(desconocido).esValido).toBe(false);
        for (const clave of ["fotoPerfil", "eliminarFoto"]) {
            const repetido = new FormData();
            repetido.append(clave, "true");
            repetido.append(clave, "true");
            expect(validarCambioFotoPerfil(repetido).esValido).toBe(false);
        }
    });

    it("acepta eliminar sólo en modificaciones y sin archivo simultáneo", () => {
        const datos = new FormData();
        datos.set("eliminarFoto", "true");
        expect(validarCambioFotoPerfil(datos)).toEqual({ esValido: true, cambio: { accion: "eliminar" } });
        expect(validarCambioFotoPerfil(datos, false).esValido).toBe(false);
        datos.set("fotoPerfil", formulario().get("fotoPerfil")!);
        expect(validarCambioFotoPerfil(datos).esValido).toBe(false);
    });

    it("rechaza un valor de eliminación no reconocido", () => {
        const datos = new FormData();
        datos.set("eliminarFoto", "false");
        expect(validarCambioFotoPerfil(datos).esValido).toBe(false);
    });
});

describe("guardarCambioFotoPerfil", () => {
    const cliente = { orm: {} } as ClienteAlmacenamientoImagenes;

    beforeEach(() => {
        vi.resetAllMocks();
        servicio.guardar.mockResolvedValue("/api/imagenes/productores/7/nueva.webp");
    });

    it("no toca imágenes cuando se conserva la foto", async () => {
        await expect(guardarCambioFotoPerfil(cliente, "productores", 7, "/anterior.webp", { accion: "conservar" })).resolves.toBeUndefined();
        expect(servicio.guardar).not.toHaveBeenCalled();
        expect(servicio.eliminar).not.toHaveBeenCalled();
    });

    it("crea la foto nueva antes de eliminar la anterior, vinculada al mismo perfil", async () => {
        const archivo = formulario().get("fotoPerfil") as File;
        await expect(guardarCambioFotoPerfil(cliente, "productores", 7, "/anterior.webp", { accion: "reemplazar", archivo })).resolves.toBe("/api/imagenes/productores/7/nueva.webp");
        expect(servicio.guardar).toHaveBeenCalledExactlyOnceWith("productores", 7, archivo);
        expect(servicio.eliminar).toHaveBeenCalledExactlyOnceWith("/anterior.webp", "productores", 7);
        expect(servicio.eliminar.mock.invocationCallOrder[0]).toBeGreaterThan(servicio.guardar.mock.invocationCallOrder[0]);
    });

    it("no elimina la foto anterior si falla la carga", async () => {
        servicio.guardar.mockRejectedValueOnce(new ErrorImagen("Imagen inválida"));
        const archivo = formulario().get("fotoPerfil") as File;
        await expect(guardarCambioFotoPerfil(cliente, "operadores", 7, "/anterior.webp", { accion: "reemplazar", archivo })).rejects.toThrow("Imagen inválida");
        expect(servicio.eliminar).not.toHaveBeenCalled();
    });

    it("eliminar devuelve null y usa el dueño real del perfil", async () => {
        await expect(guardarCambioFotoPerfil(cliente, "operadores", 7, "/anterior.webp", { accion: "eliminar" })).resolves.toBeNull();
        expect(servicio.guardar).not.toHaveBeenCalled();
        expect(servicio.eliminar).toHaveBeenCalledExactlyOnceWith("/anterior.webp", "operadores", 7);
    });

    it("convierte el error de imagen después de terminar la transacción fallida", async () => {
        const transaccion = vi.fn().mockRejectedValue(new ErrorImagen("Imagen inválida"));
        await expect(controlarErrorFotoPerfil(transaccion)).resolves.toBe("Imagen inválida");
        expect(transaccion).toHaveBeenCalledOnce();
    });

    it("no oculta fallos inesperados de persistencia", async () => {
        await expect(controlarErrorFotoPerfil(async () => { throw new Error("Sin conexión"); })).rejects.toThrow("Sin conexión");
    });
});
