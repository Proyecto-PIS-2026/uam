import { randomUUID } from "node:crypto";
import postgres from "@prisma/orm-postgres/runtime";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Contract } from "../persistencia/prisma/contract";
import contractJson from "../persistencia/prisma/contract.json" with { type: "json" };
import {
    CATEGORIAS_IMAGEN,
    ErrorImagenNoEncontrada,
    ErrorImagenYaExiste,
    type CategoriaImagen,
} from "./almacenamiento-imagenes";

type Cliente = ReturnType<typeof postgres<Contract>>;
type Adaptador = typeof import("./almacenamiento-postgres").AlmacenamientoImagenesPostgres;
type GuardarPublicacion = typeof import("@/modulos/publicaciones/operadores/imagenes-publicacion").guardarImagenPublicacion;
type CrearServicio = typeof import("./imagenes").crearServicioImagenes;

let clientes: [Cliente, Cliente];
let Almacenamiento: Adaptador;
let guardarPublicacion: GuardarPublicacion;
let crearServicio: CrearServicio;
const clavesCreadas = new Set<string>();

function claveNueva(categoria: CategoriaImagen = "publicaciones", id = 42) {
    const clave = `${categoria}/${id}/${randomUUID()}.webp`;
    clavesCreadas.add(clave);
    return clave;
}

function registrarUrl(url: string, id: number) {
    const archivo = url.split("/").at(-1)!;
    const clave = `publicaciones/${id}/${archivo}`;
    clavesCreadas.add(clave);
    return { clave, archivo };
}

async function fotografia() {
    const contenido = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#229944" } })
        .jpeg().toBuffer();
    return `data:image/jpeg;base64,${contenido.toString("base64")}`;
}

describe.sequential("almacenamiento compartido de imágenes en PostgreSQL", { timeout: 15_000 }, () => {
    beforeAll(async () => {
        const url = process.env.DATABASE_URL_TEST;
        if (!url || process.env.DATABASE_URL !== url) {
            throw new Error("La integración de imágenes requiere DATABASE_URL_TEST como base activa.");
        }
        ({ AlmacenamientoImagenesPostgres: Almacenamiento } = await import("./almacenamiento-postgres"));
        ({ guardarImagenPublicacion: guardarPublicacion } = await import("@/modulos/publicaciones/operadores/imagenes-publicacion"));
        ({ crearServicioImagenes: crearServicio } = await import("./imagenes"));
        clientes = [postgres<Contract>({ contractJson, url }), postgres<Contract>({ contractJson, url })];
    });

    afterEach(async () => {
        for (const clave of clavesCreadas) {
            await clientes[0].orm.public.Imagen.where({ clave }).deleteAll();
        }
        clavesCreadas.clear();
    });

    afterAll(async () => {
        if (clientes) await Promise.all(clientes.map((cliente) => cliente.close()));
    });

    it.each(CATEGORIAS_IMAGEN)("comparte los bytes exactos de %s entre dos clientes independientes", async (categoria) => {
        const clave = claveNueva(categoria);
        const contenido = Buffer.from([0, 1, 2, 10, 13, 127, 128, 254, 255, 0]);

        await new Almacenamiento(clientes[0]).guardar(clave, contenido);

        const leida = await new Almacenamiento(clientes[1]).leer(clave);
        expect(Buffer.isBuffer(leida)).toBe(true);
        expect(leida).toEqual(contenido);
        const registro = await clientes[1].orm.public.Imagen.where({ clave }).first();
        expect(Buffer.from(registro!.contenido)).toEqual(contenido);
    });

    it("rechaza una clave existente sin sobrescribir ni eliminar sus bytes", async () => {
        const clave = claveNueva();
        const original = Buffer.from("imagen original");
        await new Almacenamiento(clientes[0]).guardar(clave, original);

        await expect(new Almacenamiento(clientes[1]).guardar(clave, Buffer.from("otra imagen")))
            .rejects.toBeInstanceOf(ErrorImagenYaExiste);

        expect(await new Almacenamiento(clientes[1]).leer(clave)).toEqual(original);
    });

    it("resuelve inserciones concurrentes de la misma clave sin reemplazar a la ganadora", async () => {
        const clave = claveNueva();
        const contenidos = [Buffer.from([0, 255, 1]), Buffer.from([0, 128, 2])];
        const resultados = await Promise.allSettled(clientes.map((cliente, indice) =>
            new Almacenamiento(cliente).guardar(clave, contenidos[indice])));

        const ganadora = resultados.findIndex((resultado) => resultado.status === "fulfilled");
        expect(resultados.filter((resultado) => resultado.status === "fulfilled")).toHaveLength(1);
        expect(resultados.filter((resultado) => resultado.status === "rejected")).toEqual([
            expect.objectContaining({ reason: expect.any(ErrorImagenYaExiste) }),
        ]);
        expect(await new Almacenamiento(clientes[1]).leer(clave)).toEqual(contenidos[ganadora]);
    });

    it("propaga la eliminación al otro cliente y tolera eliminar nuevamente la misma clave", async () => {
        const clave = claveNueva();
        const primero = new Almacenamiento(clientes[0]);
        const segundo = new Almacenamiento(clientes[1]);
        await primero.guardar(clave, Buffer.from([255, 0, 1]));

        await segundo.eliminar(clave);

        await expect(primero.leer(clave)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
        await expect(primero.eliminar(clave)).resolves.toBeUndefined();
    });

    it("no expone desde otro cliente una imagen insertada en una transacción revertida", async () => {
        const clave = claveNueva();
        const error = new Error("Revertir operación de prueba");
        const lector = new Almacenamiento(clientes[1]);

        await expect(clientes[0].transaction(async (tx) => {
            const almacenamiento = new Almacenamiento(tx);
            await almacenamiento.guardar(clave, Buffer.from([0, 255]));
            expect(await almacenamiento.leer(clave)).toEqual(Buffer.from([0, 255]));
            await expect(lector.leer(clave)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
            throw error;
        })).rejects.toBe(error);

        await expect(lector.leer(clave)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
    });

    it("guarda mediante Sharp y permite leer el WebP desde un segundo servicio y cliente", async () => {
        const url = await guardarPublicacion(42, await fotografia(), clientes[0]);
        const { clave, archivo } = registrarUrl(url, 42);
        const servicioLector = crearServicio(new Almacenamiento(clientes[1]));

        const contenido = await servicioLector.leer("publicaciones", 42, archivo);

        expect(url).toMatch(/^\/api\/publicaciones\/imagenes\/42\/[a-f0-9-]+\.webp$/);
        expect(await sharp(contenido).metadata()).toMatchObject({ format: "webp", width: 1600, height: 800 });
        const registro = await clientes[0].orm.public.Imagen.where({ clave }).first();
        expect(contenido).toEqual(Buffer.from(registro!.contenido));
        await servicioLector.eliminar(url, "publicaciones", 42);
        await expect(new Almacenamiento(clientes[0]).leer(clave)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
    });

    it("el guardado de publicación usa la transacción recibida y revierte también los bytes optimizados", async () => {
        let clave = "";
        const error = new Error("No confirmar la edición de publicación");
        const foto = await fotografia();
        const lector = new Almacenamiento(clientes[1]);

        await expect(clientes[0].transaction(async (tx) => {
            const url = await guardarPublicacion(43, foto, tx);
            ({ clave } = registrarUrl(url, 43));
            await expect(lector.leer(clave)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
            throw error;
        })).rejects.toBe(error);

        await expect(lector.leer(clave)).rejects.toBeInstanceOf(ErrorImagenNoEncontrada);
    });
});
