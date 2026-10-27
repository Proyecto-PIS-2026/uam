import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import sharp from "sharp";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { AlmacenamientoImagenesPostgres } from "@/infraestructura/imagenes/almacenamiento-postgres";
import { claveDesdeUrlImagen } from "@/infraestructura/imagenes/almacenamiento-imagenes";
import { altaOperador } from "./operadores/altaOperador";
import { altaProductor } from "./productores/altaProductor";
import { modificarOperador } from "./operadores/acciones/modificarOperador";
import { modificarProductor } from "./productores/componentes/modificar-productor-por-admin/modificarProductor";

const autorizacion = vi.hoisted(() => ({ exigirAdministrador: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => autorizacion);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Perfil = "operador" | "productor";

const usuarios = new Set<string>();
const claves = new Set<string>();
const guardarImagen = AlmacenamientoImagenesPostgres.prototype.guardar;
const eliminarImagen = AlmacenamientoImagenesPostgres.prototype.eliminar;
let naveId: number;
let imagenRoja: Buffer;
let imagenAzul: Buffer;

beforeAll(async () => {
    const nave = await db.orm.public.Nave.create({ nombreNave: `fotos-perfil-${randomUUID()}` });
    naveId = nave.id;
    imagenRoja = await sharp({ create: { width: 2400, height: 600, channels: 3, background: "red" } }).png().toBuffer();
    imagenAzul = await sharp({ create: { width: 120, height: 80, channels: 3, background: "blue" } }).png().toBuffer();
});

beforeEach(() => {
    autorizacion.exigirAdministrador.mockReset().mockResolvedValue(undefined);
    vi.spyOn(AlmacenamientoImagenesPostgres.prototype, "guardar").mockImplementation(function (this: AlmacenamientoImagenesPostgres, clave, contenido) {
        claves.add(clave);
        return guardarImagen.call(this, clave, contenido);
    });
});

afterEach(async () => {
    vi.restoreAllMocks();
    for (const username of usuarios) {
        const usuario = await db.orm.public.Usuario.where({ username }).first();
        if (!usuario) continue;
        const operador = await db.orm.public.Operador.where({ usuarioId: usuario.id }).first();
        if (operador) {
            await db.orm.public.Local.where({ operadorId: operador.id }).deleteAll();
            await db.orm.public.Operador.where({ id: operador.id }).delete();
        }
        await db.orm.public.Productor.where({ usuarioId: usuario.id }).deleteAll();
        await db.orm.public.Usuario.where({ id: usuario.id }).delete();
    }
    for (const clave of claves) await db.orm.public.Imagen.where({ clave }).deleteAll();
    usuarios.clear();
    claves.clear();
});

afterAll(async () => {
    if (naveId) await db.orm.public.Nave.where({ id: naveId }).delete();
});

function datosAlta(tipo: Perfil) {
    const identificador = randomUUID().replaceAll("-", "");
    const nombreUsuario = `foto_${identificador}`;
    usuarios.add(nombreUsuario);
    return {
        rol: tipo,
        nombreUsuario,
        contraseña: "claveFotos123",
        confirmacionContraseña: "claveFotos123",
        nombre: `Foto perfil ${identificador}`,
        codigoPais: "+598",
        telefono: "99123456",
        locales: [{ numeroLocal: BigInt(`0x${identificador}`).toString(), naveId, contrato: "" }],
    };
}

function formularioFoto(contenido = imagenRoja) {
    const formulario = new FormData();
    formulario.set("fotoPerfil", new File([new Uint8Array(contenido)], "perfil.png", { type: "image/png" }));
    return formulario;
}

function formularioEliminar() {
    const formulario = new FormData();
    formulario.set("eliminarFoto", "true");
    return formulario;
}

async function consultarPerfil(tipo: Perfil, id: number) {
    const perfil = tipo === "operador"
        ? await db.orm.public.Operador.where({ id }).first()
        : await db.orm.public.Productor.where({ id }).first();
    if (!perfil) throw new Error("El perfil de prueba debe existir.");
    return perfil;
}

async function crearPerfil(tipo: Perfil, foto?: FormData) {
    const datos = datosAlta(tipo);
    const resultado = tipo === "operador" ? await altaOperador(datos, foto) : await altaProductor(datos, foto);
    expect(resultado.esValido).toBe(true);
    if (!resultado.esValido) throw new Error(resultado.errores.join(" "));
    const modificar = (cambio?: FormData, nombre = datos.nombre) => tipo === "operador"
        ? modificarOperador({
            operadorId: resultado.id, nombre, codigoPais: datos.codigoPais, telefono: datos.telefono,
            locales: datos.locales.map(({ numeroLocal, ...local }) => ({ nombre: numeroLocal, ...local })),
        }, cambio)
        : modificarProductor({ productorId: resultado.id, nombre, codigoPais: datos.codigoPais, telefono: datos.telefono }, cambio);
    return { id: resultado.id, datos, modificar, consultar: () => consultarPerfil(tipo, resultado.id) };
}

function claveFoto(tipo: Perfil, id: number, url: string | null) {
    expect(url).toBeTruthy();
    const clave = url && claveDesdeUrlImagen(url, tipo === "operador" ? "operadores" : "productores", id);
    if (!clave) throw new Error("La foto debe pertenecer al perfil creado.");
    return clave;
}

async function leerImagen(clave: string) {
    const imagen = await db.orm.public.Imagen.where({ clave }).first();
    if (!imagen) throw new Error("La imagen de prueba debe existir.");
    return Buffer.from(imagen.contenido);
}

function fallarDespuesDeEliminar() {
    vi.spyOn(AlmacenamientoImagenesPostgres.prototype, "eliminar").mockImplementationOnce(async function (this: AlmacenamientoImagenesPostgres, clave) {
        await eliminarImagen.call(this, clave);
        throw new Error("Fallo simulado después de eliminar la foto anterior.");
    });
}

describe.each(["operador", "productor"] as const)("fotos de perfil de %s", (tipo) => {
    it("permite el alta sin foto y agregarla al modificar, optimizada en PostgreSQL", async () => {
        const perfil = await crearPerfil(tipo);
        expect((await perfil.consultar()).fotoPerfil).toBeNull();

        expect((await perfil.modificar(formularioFoto())).esValido).toBe(true);
        const guardado = await perfil.consultar();
        const contenido = await leerImagen(claveFoto(tipo, perfil.id, guardado.fotoPerfil));
        const metadata = await sharp(contenido).metadata();
        expect(metadata.format).toBe("webp");
        expect(metadata.width).toBe(1600);
        expect(metadata.height).toBe(400);
    });

    it("permite alta con foto, conservarla, reemplazarla y eliminarla", async () => {
        const perfil = await crearPerfil(tipo, formularioFoto());
        const original = await perfil.consultar();
        const claveOriginal = claveFoto(tipo, perfil.id, original.fotoPerfil);
        const contenidoOriginal = await leerImagen(claveOriginal);

        expect((await perfil.modificar(undefined, `${perfil.datos.nombre} editado`)).esValido).toBe(true);
        expect((await perfil.consultar()).fotoPerfil).toBe(original.fotoPerfil);
        expect(await leerImagen(claveOriginal)).toEqual(contenidoOriginal);

        expect((await perfil.modificar(formularioFoto(imagenAzul))).esValido).toBe(true);
        const reemplazado = await perfil.consultar();
        const claveNueva = claveFoto(tipo, perfil.id, reemplazado.fotoPerfil);
        expect(claveNueva).not.toBe(claveOriginal);
        expect(await db.orm.public.Imagen.where({ clave: claveOriginal }).first()).toBeNull();
        expect(await leerImagen(claveNueva)).not.toEqual(contenidoOriginal);

        expect((await perfil.modificar(formularioEliminar())).esValido).toBe(true);
        expect((await perfil.consultar()).fotoPerfil).toBeNull();
        expect(await db.orm.public.Imagen.where({ clave: claveNueva }).first()).toBeNull();
    });

    it("revierte el alta completa si el archivo no contiene una imagen válida", async () => {
        const datos = datosAlta(tipo);
        const foto = formularioFoto(Buffer.from("Esto no es una imagen PNG."));
        const resultado = tipo === "operador" ? await altaOperador(datos, foto) : await altaProductor(datos, foto);
        expect(resultado.esValido).toBe(false);
        expect(await db.orm.public.Usuario.where({ username: datos.nombreUsuario }).first()).toBeNull();
        for (const clave of claves) expect(await db.orm.public.Imagen.where({ clave }).first()).toBeNull();
    });

    it("conserva foto y datos al rechazar una imagen inválida durante la modificación", async () => {
        const perfil = await crearPerfil(tipo, formularioFoto());
        const original = await perfil.consultar();
        const claveOriginal = claveFoto(tipo, perfil.id, original.fotoPerfil);
        const contenidoOriginal = await leerImagen(claveOriginal);

        const resultado = await perfil.modificar(formularioFoto(Buffer.from("PNG inválido")), `${perfil.datos.nombre} cambiado`);
        expect(resultado.esValido).toBe(false);
        expect((await perfil.consultar()).fotoPerfil).toBe(original.fotoPerfil);
        expect((await perfil.consultar()).nombreFantasia).toBe(original.nombreFantasia);
        expect(await leerImagen(claveOriginal)).toEqual(contenidoOriginal);
    });

    it.each(["reemplazar", "eliminar"] as const)("revierte los bytes y el perfil si falla la transacción al %s la foto", async (operacion) => {
        const perfil = await crearPerfil(tipo, formularioFoto());
        const original = await perfil.consultar();
        const claveOriginal = claveFoto(tipo, perfil.id, original.fotoPerfil);
        const contenidoOriginal = await leerImagen(claveOriginal);
        fallarDespuesDeEliminar();

        await expect(perfil.modificar(operacion === "reemplazar" ? formularioFoto(imagenAzul) : formularioEliminar(), `${perfil.datos.nombre} cambiado`))
            .rejects.toThrow("Fallo simulado después de eliminar la foto anterior.");
        expect((await perfil.consultar()).fotoPerfil).toBe(original.fotoPerfil);
        expect((await perfil.consultar()).nombreFantasia).toBe(original.nombreFantasia);
        expect(await leerImagen(claveOriginal)).toEqual(contenidoOriginal);
        for (const clave of claves) {
            if (clave !== claveOriginal) expect(await db.orm.public.Imagen.where({ clave }).first()).toBeNull();
        }
    });

    it("rechaza subir y eliminar a la vez sin cambiar el perfil", async () => {
        const perfil = await crearPerfil(tipo, formularioFoto());
        const original = await perfil.consultar();
        const foto = formularioFoto(imagenAzul);
        foto.set("eliminarFoto", "true");

        expect((await perfil.modificar(foto)).esValido).toBe(false);
        expect((await perfil.consultar()).fotoPerfil).toBe(original.fotoPerfil);
        expect(claves.size).toBe(1);
    });

    it("no admite una URL de otro perfil como archivo ni elimina esa imagen", async () => {
        const propio = await crearPerfil(tipo, formularioFoto());
        const ajeno = await crearPerfil(tipo, formularioFoto(imagenAzul));
        const original = await propio.consultar();
        const perfilAjeno = await ajeno.consultar();
        const claveAjena = claveFoto(tipo, ajeno.id, perfilAjeno.fotoPerfil);
        const contenidoAjeno = await leerImagen(claveAjena);
        const formulario = new FormData();
        formulario.set("fotoPerfil", perfilAjeno.fotoPerfil!);

        expect((await propio.modificar(formulario)).esValido).toBe(false);
        expect((await propio.consultar()).fotoPerfil).toBe(original.fotoPerfil);
        expect(await leerImagen(claveAjena)).toEqual(contenidoAjeno);
    });

    it("exige administrador para dar de alta, reemplazar o quitar una foto", async () => {
        const perfil = await crearPerfil(tipo, formularioFoto());
        const original = await perfil.consultar();
        const datos = datosAlta(tipo);
        autorizacion.exigirAdministrador.mockRejectedValue(new Error("No autorizado"));

        await expect(tipo === "operador" ? altaOperador(datos, formularioFoto()) : altaProductor(datos, formularioFoto())).rejects.toThrow("No autorizado");
        await expect(perfil.modificar(formularioFoto(imagenAzul))).rejects.toThrow("No autorizado");
        await expect(perfil.modificar(formularioEliminar())).rejects.toThrow("No autorizado");
        expect(await db.orm.public.Usuario.where({ username: datos.nombreUsuario }).first()).toBeNull();
        expect((await perfil.consultar()).fotoPerfil).toBe(original.fotoPerfil);
        expect(claves.size).toBe(1);
    });

    it("serializa dos reemplazos concurrentes sin dejar imágenes huérfanas", async () => {
        const perfil = await crearPerfil(tipo, formularioFoto());
        const resultados = await Promise.all([
            perfil.modificar(formularioFoto(imagenAzul)),
            perfil.modificar(formularioFoto(imagenRoja)),
        ]);
        expect(resultados.every((resultado) => resultado.esValido)).toBe(true);
        const claveActual = claveFoto(tipo, perfil.id, (await perfil.consultar()).fotoPerfil);
        expect(claves.size).toBe(3);
        for (const clave of claves) {
            const imagen = await db.orm.public.Imagen.where({ clave }).first();
            if (clave === claveActual) expect(imagen).not.toBeNull();
            else expect(imagen).toBeNull();
        }
    });
});
