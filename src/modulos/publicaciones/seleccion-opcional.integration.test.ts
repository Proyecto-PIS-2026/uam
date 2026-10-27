import { randomUUID } from "node:crypto";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { SeleccionPublicacion } from "./seleccion-publicacion";

type BaseDatos = typeof import("@/infraestructura/persistencia/prisma/db").db;
type Rol = "OPERADOR" | "PRODUCTOR";
let db: BaseDatos;
let altaOperador: typeof import("./altaPublicacionOperador").altaPublicacionOperador;
let altaProductor: typeof import("./altaPublicacionProductor").altaPublicacionProductor;
let editarOperador: typeof import("./operadores/modificar-publicacion").modificarPublicacionOperador;
let editarProductor: typeof import("./productores/modificar-publicacion").modificarPublicacionProductor;
let operador: { id: number; usuarioId: number };
let productor: { id: number; usuarioId: number };
let especieId: number;
let variedadId: number;
let paises: number[];
const publicacionesCreadas: number[] = [];

function seleccion(cambios: Partial<SeleccionPublicacion> = {}): SeleccionPublicacion {
    return { especieId, variedadId: null, presentacionId: null, categoriaId: null, calibreId: null, paisId: null, ...cambios };
}

async function crear(rol: Rol, datos: Record<string, unknown> = {}) {
    const resultado = rol === "OPERADOR"
        ? await altaOperador({ operadorId: operador.id, especieId, ...datos })
        : await altaProductor({ productorId: productor.id, especieId, ...datos });
    if (resultado.esValido) publicacionesCreadas.push(resultado.id);
    return resultado;
}

async function crearValida(rol: Rol, datos: Record<string, unknown> = {}) {
    const resultado = await crear(rol, datos);
    if (!resultado.esValido) throw new Error(resultado.errores.join(" "));
    return resultado.id;
}

async function editar(rol: Rol, id: number, datos: SeleccionPublicacion) {
    if (rol === "OPERADOR") {
        const vinculo = await db.orm.public.PublicacionOperador.where({ publicacionId: id }).first();
        const publicacion = await db.orm.public.Publicacion.where({ id }).first();
        if (!vinculo || !publicacion) throw new Error("Falta la publicación del test.");
        return editarOperador(operador.usuarioId, vinculo.id, { ...datos, version: publicacion.version, precio: null, disponible: true });
    }
    const vinculo = await db.orm.public.PublicacionProductor.where({ publicacionId: id }).first();
    if (!vinculo) throw new Error("Falta la publicación del test.");
    return editarProductor({ usuarioId: productor.usuarioId, rol: "PRODUCTOR", expiraEn: 2000000000 }, vinculo.id,
        { ...datos, precio: null, disponible: true, ubicaciones: [] });
}

beforeAll(async () => {
    if (!process.env.DATABASE_URL_TEST || process.env.DATABASE_URL !== process.env.DATABASE_URL_TEST) {
        throw new Error("Esta prueba requiere la base de integración configurada en DATABASE_URL_TEST.");
    }
    ({ db } = await import("@/infraestructura/persistencia/prisma/db"));
    ({ altaPublicacionOperador: altaOperador } = await import("./altaPublicacionOperador"));
    ({ altaPublicacionProductor: altaProductor } = await import("./altaPublicacionProductor"));
    ({ modificarPublicacionOperador: editarOperador } = await import("./operadores/modificar-publicacion"));
    ({ modificarPublicacionProductor: editarProductor } = await import("./productores/modificar-publicacion"));
    const [op, prod, origenes] = await Promise.all([
        db.orm.public.Operador.select("id", "usuarioId").first(),
        db.orm.public.Productor.select("id", "usuarioId").first(),
        db.orm.public.Pais.select("id").all(),
    ]);
    if (!op || !prod || origenes.length < 2) throw new Error("Faltan dueños o países en el seed de pruebas.");
    operador = op;
    productor = prod;
    paises = origenes.map((pais) => pais.id);
});

beforeEach(async () => {
    const especie = await db.orm.public.Especie.create({ nombreEspecie: `Especie opcional ${randomUUID()}` });
    especieId = especie.id;
    const variedad = await db.orm.public.Variedad.create({ nombreVariedad: "Blanca", especieId });
    variedadId = variedad.id;
});

afterEach(async () => {
    for (const id of publicacionesCreadas.splice(0)) await db.orm.public.Publicacion.where({ id }).delete();
    if (variedadId) await db.orm.public.Variedad.where({ id: variedadId }).delete();
    if (especieId) await db.orm.public.Especie.where({ id: especieId }).delete();
});

describe.each(["OPERADOR", "PRODUCTOR"] as const)("combinaciones opcionales de %s", (rol) => {
    it("crea solo con especie, sin ubicación, país, precio ni fotografía", async () => {
        const id = await crearValida(rol);
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({
            especieId, variedadId: null, presentacionId: null, categoriaId: null, calibreId: null,
            precio: null, foto: null, cantidadUnidades: null, publicacionDisponible: true,
        });
        if (rol === "PRODUCTOR") {
            const vinculo = await db.orm.public.PublicacionProductor.where({ publicacionId: id }).include("ubicaciones").first();
            expect(vinculo).toMatchObject({ paisId: null, ubicaciones: [] });
        } else {
            expect(await db.orm.public.PublicacionOperador.where({ publicacionId: id }).first()).toMatchObject({ paisId: null });
        }
    });

    it("considera equivalentes omitido, null, cero y texto vacío al detectar duplicados", async () => {
        await crearValida(rol);
        for (const vacio of [null, 0, ""]) {
            expect(await crear(rol, { variedadId: vacio, presentacionId: vacio, categoriaId: vacio, calibreId: vacio, paisId: vacio }))
                .toMatchObject({ esValido: false, errores: [expect.stringContaining("ya tiene una publicación")] });
        }
    });

    it("admite especie y especie con variedad, pero rechaza repetir la segunda", async () => {
        await crearValida(rol);
        const id = await crearValida(rol, { variedadId });
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ especieId, variedadId, presentacionId: null });
        expect(await crear(rol, { variedadId, precio: "100", disponibilidad: false })).toMatchObject({ esValido: false });
    });

    it("incluye país en la combinación y distingue un país vacío", async () => {
        await crearValida(rol, { variedadId });
        await crearValida(rol, { variedadId, paisId: paises[0] });
        await crearValida(rol, { variedadId, paisId: paises[1] });
        expect(await crear(rol, { variedadId, paisId: paises[0] })).toMatchObject({ esValido: false });
    });

    it("impide borrar atributos si eso crea un duplicado y conserva el registro original", async () => {
        await crearValida(rol);
        const id = await crearValida(rol, { variedadId });
        await expect(editar(rol, id, seleccion())).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ especieId, variedadId });
    });

    it("permite vaciar los atributos si la combinación resultante no existe", async () => {
        const id = await crearValida(rol, { variedadId, paisId: paises[0] });
        await editar(rol, id, seleccion());
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ especieId, variedadId: null, presentacionId: null });
        expect(await crear(rol)).toMatchObject({ esValido: false });
    });

    it("permite guardar la publicación sin cambiar la combinación propia", async () => {
        const id = await crearValida(rol);
        await expect(editar(rol, id, seleccion())).resolves.toBeDefined();
    });

    it("rechaza cambiar el país al de otra publicación idéntica", async () => {
        await crearValida(rol, { paisId: paises[0] });
        const id = await crearValida(rol, { paisId: paises[1] });
        await expect(editar(rol, id, seleccion({ paisId: paises[0] }))).rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
    });

    it("serializa dos altas simultáneas de una combinación con campos vacíos", async () => {
        const resultados = await Promise.all([crear(rol), crear(rol)]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultados.filter((resultado) => !resultado.esValido)).toHaveLength(1);
        expect(await db.orm.public.Publicacion.where({ especieId }).all()).toHaveLength(1);
    });

    it("serializa una edición y un alta simultáneas que intentan la misma combinación", async () => {
        const id = await crearValida(rol, { variedadId });
        const [edicion, alta] = await Promise.allSettled([editar(rol, id, seleccion()), crear(rol)]);
        const altaExitosa = alta.status === "fulfilled" && alta.value.esValido;
        expect(Number(edicion.status === "fulfilled") + Number(altaExitosa)).toBe(1);
        const publicaciones = await db.orm.public.Publicacion.where({ especieId }).all();
        expect(publicaciones.filter((publicacion) => publicacion.variedadId === null)).toHaveLength(1);
    });
});
