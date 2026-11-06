import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/infraestructura/persistencia/prisma/db";
import { cambiarHabilitacionUsuario } from "@/modulos/administracion/componentes/configuracion-usuarios/acciones/cambiarHabilitacionUsuario";
import { bajaAdministrador } from "./bajaAdministrador";

const mocks = vi.hoisted(() => ({ exigirAdministrador: vi.fn() }));
vi.mock("@/modulos/identidad-acceso/autorizacion/controles", () => mocks);
vi.mock("@/modulos/identidad-acceso/autorizacion/control-acciones", () => ({
    controlarSesionEnAccion: (exigir: () => Promise<unknown>) => exigir(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("protección concurrente de los últimos administradores", () => {
    let habilitadosAnteriores: number[];
    let usuariosCreados: number[];
    let administradores: { id: number; usuarioId: number }[];

    beforeEach(async () => {
        vi.clearAllMocks();
        usuariosCreados = [];
        administradores = [];
        habilitadosAnteriores = (await db.orm.public.Usuario
            .where({ rol: "ADMINISTRADOR", habilitado: true }).select("id").all()).map((usuario) => usuario.id);
        await db.orm.public.Usuario.where({ rol: "ADMINISTRADOR", habilitado: true }).updateAndCount({ habilitado: false });
        for (let indice = 0; indice < 2; indice++) {
            const identificador = `admin_proteccion_${randomUUID()}`;
            const usuario = await db.orm.public.Usuario.create({
                username: identificador, passwordHash: "hash-prueba", rol: "ADMINISTRADOR", habilitado: true,
            });
            usuariosCreados.push(usuario.id);
            const administrador = await db.orm.public.Administrador.create({ usuarioId: usuario.id, email: `${identificador}@prueba.local` });
            administradores.push({ id: administrador.id, usuarioId: usuario.id });
        }
    });

    afterEach(async () => {
        for (const usuarioId of usuariosCreados) {
            await db.orm.public.Administrador.where({ usuarioId }).deleteAndCount();
            await db.orm.public.Usuario.where({ id: usuarioId }).deleteAndCount();
        }
        if (habilitadosAnteriores.length) {
            await db.orm.public.Usuario.where((usuario) => usuario.id.in(habilitadosAnteriores)).updateAndCount({ habilitado: true });
        }
    });

    it("impide que dos solicitudes autenticadas previamente deshabiliten a los dos administradores", async () => {
        const [primero, segundo] = administradores;
        mocks.exigirAdministrador.mockResolvedValueOnce({ usuarioId: primero.usuarioId }).mockResolvedValueOnce({ usuarioId: segundo.usuarioId });
        const resultados = await Promise.all([
            cambiarHabilitacionUsuario({ usuarioId: segundo.usuarioId, habilitado: false }),
            cambiarHabilitacionUsuario({ usuarioId: primero.usuarioId, habilitado: false }),
        ]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(await db.orm.public.Usuario.where({ rol: "ADMINISTRADOR", habilitado: true }).all()).toHaveLength(1);
    });

    it("comparte la protección entre una deshabilitación y una eliminación concurrentes", async () => {
        const [primero, segundo] = administradores;
        mocks.exigirAdministrador.mockResolvedValueOnce({ usuarioId: primero.usuarioId }).mockResolvedValueOnce({ usuarioId: segundo.usuarioId });
        const resultados = await Promise.all([
            cambiarHabilitacionUsuario({ usuarioId: segundo.usuarioId, habilitado: false }),
            bajaAdministrador({ administradorId: primero.id }),
        ]);
        expect(resultados.filter((resultado) => resultado.esValido)).toHaveLength(1);
        expect(await db.orm.public.Usuario.where({ rol: "ADMINISTRADOR", habilitado: true }).all()).toHaveLength(1);
    });

    it("no permite al único administrador habilitado deshabilitarse ni eliminarse", async () => {
        const [primero, segundo] = administradores;
        await db.orm.public.Usuario.where({ id: segundo.usuarioId }).update({ habilitado: false });
        mocks.exigirAdministrador.mockResolvedValue({ usuarioId: primero.usuarioId });
        expect(await cambiarHabilitacionUsuario({ usuarioId: primero.usuarioId, habilitado: false })).toMatchObject({ esValido: false });
        expect(await bajaAdministrador({ administradorId: primero.id })).toMatchObject({ esValido: false });
        expect(await db.orm.public.Usuario.where({ rol: "ADMINISTRADOR", habilitado: true }).all()).toHaveLength(1);
    });
});
