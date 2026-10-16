import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaOperador } from "./altaOperador";
import { modificarOperador } from "./acciones/modificarOperador";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("concurrencia de altas y modificaciones de operadores", () => {
    let prefijo: string;
    let naveId: number;
    const usuariosCreados = new Set<string>();

    beforeEach(async () => {
        prefijo = `test-concurrencia-${randomUUID()}`;
        const nave = (await db.orm.public.Nave.all())[0];
        if (!nave) throw new Error("La base de pruebas debe contener una nave.");
        naveId = nave.id;
    });

    afterEach(async () => {
        for (const username of usuariosCreados) {
            const usuario = await db.orm.public.Usuario.where({ username }).first();
            if (!usuario) continue;
            const operador = await db.orm.public.Operador.where({ usuarioId: usuario.id }).first();
            if (operador) {
                await db.orm.public.Local.where({ operadorId: operador.id }).deleteAll();
                await db.orm.public.Operador.where({ id: operador.id }).delete();
            }
            await db.orm.public.Usuario.where({ id: usuario.id }).delete();
        }
        usuariosCreados.clear();
    });

    function datos(numero: number) {
        const nombreUsuario = `${prefijo}-${numero}`;
        usuariosCreados.add(nombreUsuario);
        return {
            rol: "operador", nombreUsuario, contraseña: "clave12345", confirmacionContraseña: "clave12345",
            nombre: `${prefijo}-nombre-${numero}`, codigoPais: "+598", telefono: "099123456",
            locales: [{ numeroLocal: `${prefijo}-local-${numero}`, naveId, contrato: "" }],
        };
    }

    it.each(["usuario", "nombre", "local"])("solo acepta una de dos altas que compiten por el mismo %s", async (campo) => {
        const primera = datos(1);
        const segunda = datos(2);
        if (campo === "usuario") segunda.nombreUsuario = primera.nombreUsuario;
        if (campo === "nombre") segunda.nombre = primera.nombre;
        if (campo === "local") segunda.locales = primera.locales;
        const resultados = await Promise.all([altaOperador(primera), altaOperador(segunda)]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultados.filter((resultado) => !resultado.esValido)).toHaveLength(1);
        const rechazo = resultados.find((resultado) => !resultado.esValido);
        expect(rechazo && !rechazo.esValido && rechazo.errores.join(" ")).toMatch(/ya existe/i);
    });

    it.each(["nombre", "local"])("resuelve de forma atómica un alta y una edición que compiten por el mismo %s", async (campo) => {
        const original = datos(1);
        const creado = await altaOperador(original);
        expect(creado.esValido).toBe(true);
        if (!creado.esValido) return;
        const alta = datos(2);
        const edicion = {
            operadorId: creado.id, nombre: campo === "nombre" ? alta.nombre : original.nombre,
            codigoPais: "+598", telefono: "099123456",
            locales: [{
                nombre: campo === "local" ? alta.locales[0].numeroLocal : original.locales[0].numeroLocal,
                naveId, contrato: "",
            }],
        };
        const resultados = await Promise.all([altaOperador(alta), modificarOperador(edicion)]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultados.filter((resultado) => !resultado.esValido)).toHaveLength(1);
        const operador = await db.orm.public.Operador.where({ id: creado.id }).first();
        const locales = await db.orm.public.Local.where({ operadorId: creado.id }).all();
        expect(operador).toBeDefined();
        expect(locales).toHaveLength(1);
        if (!resultados[1].esValido) {
            expect(operador?.nombreFantasia).toBe(original.nombre);
            expect(locales[0].numeroLocal).toBe(original.locales[0].numeroLocal);
        }
    });
});
