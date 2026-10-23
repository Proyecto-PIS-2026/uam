import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaOperador } from "../operadores/altaOperador";
import { altaProductor } from "./altaProductor";
import { modificarProductor } from "./componentes/modificar-productor-por-admin/modificarProductor";

vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => ({ exigirAdministrador: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("concurrencia de productores con otros usuarios", () => {
    let prefijo: string;
    const usuarios = new Set<string>();

    beforeEach(() => { prefijo = `test-productores-${randomUUID()}`; });

    afterEach(async () => {
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
        usuarios.clear();
    });

    function datos(numero: number) {
        const nombreUsuario = `${prefijo}-${numero}`;
        usuarios.add(nombreUsuario);
        return {
            rol: "productor", nombreUsuario, contraseña: "clave12345", confirmacionContraseña: "clave12345",
            nombre: `${prefijo}-nombre-${numero}`, codigoPais: "+598", telefono: "099123456",
        };
    }

    it("resuelve dos altas de distinto rol con el mismo nombre de usuario", async () => {
        const productor = datos(1);
        const nave = (await db.orm.public.Nave.all())[0];
        if (!nave) throw new Error("La base de pruebas debe contener una nave.");
        const operador = {
            ...productor, rol: "operador",
            locales: [{ numeroLocal: prefijo, naveId: nave.id, contrato: "" }],
        };

        const resultados = await Promise.all([altaOperador(operador), altaProductor(productor)]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultados.find((resultado) => !resultado.esValido)).toEqual({
            esValido: false, errores: ["Ya existe un usuario con ese nombre de usuario."],
        });
    });

    it("resuelve dos altas de productores con distinto usuario y el mismo nombre", async () => {
        const primero = datos(1);
        const segundo = { ...datos(2), nombre: primero.nombre };
        const resultados = await Promise.all([altaProductor(primero), altaProductor(segundo)]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultados.find((resultado) => !resultado.esValido)).toEqual({
            esValido: false, errores: ["Ya existe un productor con ese nombre."],
        });
    });

    it("resuelve un alta y una edición que compiten por el mismo nombre", async () => {
        const original = datos(1);
        const creado = await altaProductor(original);
        expect(creado.esValido).toBe(true);
        if (!creado.esValido) return;
        const nuevo = datos(2);
        const resultados = await Promise.all([
            altaProductor(nuevo),
            modificarProductor({ productorId: creado.id, nombre: nuevo.nombre, codigoPais: "+598", telefono: "099123456" }),
        ]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultados.find((resultado) => !resultado.esValido)).toEqual({
            esValido: false, errores: ["Ya existe un productor con ese nombre."],
        });
    });
});
