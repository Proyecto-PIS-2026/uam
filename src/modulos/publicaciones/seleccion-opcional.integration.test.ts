import { randomUUID } from "node:crypto";
import { Temporal } from "temporal-polyfill";
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
let envases: number[];
let kilos: number[];
const publicacionesCreadas: number[] = [];

function seleccion(cambios: Partial<SeleccionPublicacion> = {}): SeleccionPublicacion {
    return { especieId, variedadId: null, envaseId: null, kilosId: null, categoriaId: null, calibreId: null, paisId: null, ...cambios };
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

async function editar(rol: Rol, id: number, datos: SeleccionPublicacion, cambios: { fechaVigencia?: string | null; disponible?: boolean } = {}) {
    if (rol === "OPERADOR") {
        const vinculo = await db.orm.public.PublicacionOperador.where({ publicacionId: id }).first();
        const publicacion = await db.orm.public.Publicacion.where({ id }).first();
        if (!vinculo || !publicacion) throw new Error("Falta la publicación del test.");
        return editarOperador(operador.usuarioId, vinculo.id, { ...datos, version: publicacion.version, precio: null, disponible: true, ...cambios });
    }
    const vinculo = await db.orm.public.PublicacionProductor.where({ publicacionId: id }).first();
    if (!vinculo) throw new Error("Falta la publicación del test.");
    return editarProductor({ usuarioId: productor.usuarioId, rol: "PRODUCTOR", expiraEn: 2000000000 }, vinculo.id,
        { ...datos, precio: null, disponible: true, ubicaciones: [], ...cambios });
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
    const [op, prod, origenes, empaquetados, cantidades] = await Promise.all([
        db.orm.public.Operador.select("id", "usuarioId").first(),
        db.orm.public.Productor.select("id", "usuarioId").first(),
        db.orm.public.Pais.select("id").all(),
        db.orm.public.Envase.select("id").all(),
        db.orm.public.KilosEmpaquetado.select("id").all(),
    ]);
    if (!op || !prod || origenes.length < 2 || empaquetados.length < 2 || cantidades.length < 2) throw new Error("Faltan dueños o catálogos en el seed de pruebas.");
    operador = op;
    productor = prod;
    paises = origenes.map((pais) => pais.id);
    envases = empaquetados.map((envase) => envase.id);
    kilos = cantidades.map((cantidad) => cantidad.id);
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
    it("conserva los avisos al editar disponibilidad y los reinicia al renovar la vigencia", async () => {
        const hoy = Temporal.Now.plainDateISO("America/Montevideo");
        const id = await crearValida(rol, { fechaVigencia: hoy.toString() });
        const enviadoEn = Temporal.Now.instant().round({ smallestUnit: "millisecond", roundingMode: "trunc" });
        await db.orm.public.Publicacion.where({ id }).update({
            avisoProximoVencimientoEn: enviadoEn, avisoVencimientoEn: enviadoEn,
        });

        await editar(rol, id, seleccion(), { disponible: false });
        let actual = await db.orm.public.Publicacion.where({ id }).first();
        expect(actual?.avisoProximoVencimientoEn?.equals(enviadoEn)).toBe(true);
        expect(actual?.avisoVencimientoEn?.equals(enviadoEn)).toBe(true);

        await editar(rol, id, seleccion(), { disponible: true, fechaVigencia: hoy.toString() });
        actual = await db.orm.public.Publicacion.where({ id }).first();
        expect(actual?.avisoProximoVencimientoEn?.equals(enviadoEn)).toBe(true);
        expect(actual?.avisoVencimientoEn?.equals(enviadoEn)).toBe(true);

        const renovada = hoy.add({ days: 1 }).toString();
        await editar(rol, id, seleccion(), { fechaVigencia: renovada });
        actual = await db.orm.public.Publicacion.where({ id }).first();
        expect(actual).toMatchObject({ avisoProximoVencimientoEn: null, avisoVencimientoEn: null });
        expect(actual?.fechaVigencia?.toZonedDateTimeISO("America/Montevideo").toPlainDate().toString()).toBe(renovada);
    });

    it("crea solo con especie, sin ubicación, país, precio ni fotografía", async () => {
        const id = await crearValida(rol);
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({
            especieId, variedadId: null, envaseId: null, kilosId: null, categoriaId: null, calibreId: null,
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
            expect(await crear(rol, { variedadId: vacio, envaseId: vacio, kilosId: vacio, categoriaId: vacio, calibreId: vacio, paisId: vacio }))
                .toMatchObject({ esValido: false, errores: [expect.stringContaining("ya tiene una publicación")] });
        }
    });

    it("admite especie y especie con variedad, pero rechaza repetir la segunda", async () => {
        await crearValida(rol);
        const id = await crearValida(rol, { variedadId });
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ especieId, variedadId, envaseId: null, kilosId: null });
        expect(await crear(rol, { variedadId, precio: "100", disponibilidad: false })).toMatchObject({ esValido: false });
    });

    it("incluye país en la combinación y distingue un país vacío", async () => {
        await crearValida(rol, { variedadId });
        await crearValida(rol, { variedadId, paisId: paises[0] });
        await crearValida(rol, { variedadId, paisId: paises[1] });
        expect(await crear(rol, { variedadId, paisId: paises[0] })).toMatchObject({ esValido: false });
    });

    it("permite envase solo, kilos solos y ambos sin elegir variedad", async () => {
        for (const datos of [
            { envaseId: envases[0], kilosId: null },
            { envaseId: null, kilosId: kilos[0] },
            { envaseId: envases[0], kilosId: kilos[0] },
        ]) {
            const id = await crearValida(rol, datos);
            expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ especieId, variedadId: null, ...datos });
            expect(await crear(rol, datos)).toMatchObject({ esValido: false });
        }
    });

    it("distingue los envases y kilos de la misma especie y rechaza solo la combinación repetida", async () => {
        await crearValida(rol, { envaseId: envases[0], kilosId: kilos[0] });
        await crearValida(rol, { envaseId: envases[1], kilosId: kilos[0] });
        await crearValida(rol, { envaseId: envases[0], kilosId: kilos[1] });
        expect(await crear(rol, { envaseId: envases[1], kilosId: kilos[0] })).toMatchObject({ esValido: false });
        expect(await db.orm.public.Publicacion.where({ especieId }).all()).toHaveLength(3);
    });

    it("rechaza envases o kilos que no pertenecen al catálogo sin crear registros", async () => {
        expect(await crear(rol, { envaseId: 2147483647 })).toMatchObject({ esValido: false });
        expect(await crear(rol, { kilosId: 2147483647 })).toMatchObject({ esValido: false });
        expect(await db.orm.public.Publicacion.where({ especieId }).all()).toEqual([]);
    });

    it("rechaza editar envase o kilos hacia una combinación ya publicada", async () => {
        await crearValida(rol, { envaseId: envases[0], kilosId: kilos[0] });
        for (const datos of [
            { envaseId: envases[1], kilosId: kilos[0] },
            { envaseId: envases[0], kilosId: kilos[1] },
        ]) {
            const id = await crearValida(rol, datos);
            await expect(editar(rol, id, seleccion({ envaseId: envases[0], kilosId: kilos[0] })))
                .rejects.toMatchObject({ codigo: "DATOS_INVALIDOS" });
            expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject(datos);
        }
    });

    it("permite editar con envase o kilos sin depender de especie y variedad previas", async () => {
        const id = await crearValida(rol, { variedadId });
        await editar(rol, id, seleccion({ envaseId: envases[0] }));
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ variedadId: null, envaseId: envases[0], kilosId: null });
        await editar(rol, id, seleccion({ kilosId: kilos[0] }));
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ variedadId: null, envaseId: null, kilosId: kilos[0] });
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
        expect(await db.orm.public.Publicacion.where({ id }).first()).toMatchObject({ especieId, variedadId: null, envaseId: null, kilosId: null });
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
