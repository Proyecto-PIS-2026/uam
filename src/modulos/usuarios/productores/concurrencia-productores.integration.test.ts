import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { altaOperador } from "../operadores/acciones/alta-operador";
import { altaAdministrador } from "../administradores/acciones/alta-administrador";
import { altaProductor } from "./acciones/alta-productor";
import { modificarProductor } from "./acciones/modificar-productor";

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
            await db.orm.public.Administrador.where({ usuarioId: usuario.id }).deleteAll();
            await db.orm.public.Usuario.where({ id: usuario.id }).delete();
        }
        usuarios.clear();
    });

    function datos(numero: number, nombreUsuario = `${prefijo}-${numero}`) {
        usuarios.add(nombreUsuario);
        return {
            rol: "productor", nombreUsuario, contraseña: "clave12345", confirmacionContraseña: "clave12345",
            nombre: `${prefijo}-nombre-${numero}`, codigoPais: "+598", telefono: "099123456",
        };
    }

    function datosAdministrador(email: string) {
        const nombreUsuario = `${prefijo}-admin`;
        usuarios.add(nombreUsuario);
        return {
            rol: "administrador", nombreUsuario, email,
            contraseña: "clave12345", confirmacionContraseña: "clave12345",
        };
    }

    it("rechaza un productor cuyo usuario coincide con un correo administrativo sin dejar registros huérfanos", async () => {
        const identificador = `${prefijo}@prueba.local`;
        const administrador = datosAdministrador(identificador);
        const productor = datos(1, identificador);
        const creado = await altaAdministrador(administrador);
        expect(creado.esValido).toBe(true);
        if (!creado.esValido) return;

        expect(await altaProductor(productor)).toEqual({
            esValido: false,
            errores: ["El nombre de usuario coincide con el correo de un administrador. Elegí otro nombre de usuario."],
        });
        expect(await db.orm.public.Usuario.where({ username: productor.nombreUsuario }).first()).toBeNull();
        expect(await db.orm.public.Productor.where({ nombreFantasia: productor.nombre }).first()).toBeNull();
        expect(await db.orm.public.Administrador.where({ id: creado.id }).first()).toMatchObject({ email: identificador });
    });

    it("admite un productor con arroba y rechaza después un administrador con ese correo", async () => {
        const identificador = `${prefijo}@prueba.local`;
        const productor = datos(1, identificador);
        const administrador = datosAdministrador(identificador);
        const creado = await altaProductor(productor);
        expect(creado.esValido).toBe(true);
        if (!creado.esValido) return;

        expect(await altaAdministrador(administrador)).toEqual({
            esValido: false,
            errores: ["El email coincide con el nombre de usuario de un operador o productor. Elegí otro email."],
        });
        expect(await db.orm.public.Usuario.where({ username: administrador.nombreUsuario }).first()).toBeNull();
        expect(await db.orm.public.Administrador.where({ email: identificador }).first()).toBeNull();
        expect(await db.orm.public.Usuario.where({ username: identificador }).first()).toMatchObject({ rol: "PRODUCTOR" });
        expect(await db.orm.public.Productor.where({ id: creado.id }).first()).toMatchObject({ nombreFantasia: productor.nombre });
    });

    it("impide una colisión entre correo administrativo y usuario productor en altas simultáneas", async () => {
        const identificador = `${prefijo}@prueba.local`;
        const administrador = datosAdministrador(identificador);
        const productor = datos(1, identificador);
        const [resultadoAdministrador, resultadoProductor] = await Promise.all([
            altaAdministrador(administrador),
            altaProductor(productor),
        ]);

        expect([resultadoAdministrador, resultadoProductor].filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(resultadoAdministrador.esValido ? resultadoProductor : resultadoAdministrador).toEqual({
            esValido: false,
            errores: [resultadoAdministrador.esValido
                ? "El nombre de usuario coincide con el correo de un administrador. Elegí otro nombre de usuario."
                : "El email coincide con el nombre de usuario de un operador o productor. Elegí otro email."],
        });

        const [usuarioAdministrador, usuarioProductor, perfilAdministrador, perfilProductor] = await Promise.all([
            db.orm.public.Usuario.where({ username: administrador.nombreUsuario }).first(),
            db.orm.public.Usuario.where({ username: productor.nombreUsuario }).first(),
            db.orm.public.Administrador.where({ email: identificador }).first(),
            db.orm.public.Productor.where({ nombreFantasia: productor.nombre }).first(),
        ]);
        expect(Boolean(usuarioAdministrador)).toBe(resultadoAdministrador.esValido);
        expect(Boolean(perfilAdministrador)).toBe(resultadoAdministrador.esValido);
        expect(Boolean(usuarioProductor)).toBe(resultadoProductor.esValido);
        expect(Boolean(perfilProductor)).toBe(resultadoProductor.esValido);
        if (resultadoAdministrador.esValido) {
            expect(perfilAdministrador).toMatchObject({ id: resultadoAdministrador.id, usuarioId: usuarioAdministrador?.id });
        }
        if (resultadoProductor.esValido) {
            expect(perfilProductor).toMatchObject({ id: resultadoProductor.id, usuarioId: usuarioProductor?.id });
        }
    });

    it("resuelve dos altas de distinto rol con el mismo nombre de usuario", async () => {
        const productor = datos(1);
        const nave = (await db.orm.public.Nave.all())[0];
        if (!nave) throw new Error("La base de pruebas debe contener una nave.");
        const operador = {
            ...productor, rol: "operador",
            locales: [{ numeroLocal: BigInt(`0x${randomUUID().replaceAll("-", "")}`).toString(), naveId: nave.id, contrato: "" }],
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
