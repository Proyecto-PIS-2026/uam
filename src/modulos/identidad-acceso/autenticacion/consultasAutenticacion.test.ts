// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    obtenerOperadorAutenticadoPorUsuarioId,
    obtenerUsuarioAdministradorPorCorreo,
    obtenerUsuarioOperadorPorNombre,
    obtenerUsuarioProductorPorNombre,
} from "./consultasAutenticacion";

const baseSimulada = vi.hoisted(() => ({
    usuario: { select: vi.fn(), where: vi.fn(), first: vi.fn() },
    administrador: { select: vi.fn(), where: vi.fn(), first: vi.fn() },
    operador: { select: vi.fn(), where: vi.fn(), first: vi.fn() },
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Usuario: baseSimulada.usuario,
                Administrador: baseSimulada.administrador,
                Operador: baseSimulada.operador,
            },
        },
    },
}));

beforeEach(() => {
    vi.resetAllMocks();
    for (const consulta of Object.values(baseSimulada)) {
        consulta.select.mockReturnThis();
        consulta.where.mockReturnThis();
        consulta.first.mockResolvedValue(null);
    }
});

describe.each([
    { nombre: "obtenerUsuarioOperadorPorNombre", consultar: obtenerUsuarioOperadorPorNombre, rol: "OPERADOR" },
    { nombre: "obtenerUsuarioProductorPorNombre", consultar: obtenerUsuarioProductorPorNombre, rol: "PRODUCTOR" },
])("$nombre", ({ consultar, rol }) => {
    it("busca por nombre de usuario y restringe el rol", async () => {
        const usuario = { id: 4, passwordHash: "hash", rol };
        baseSimulada.usuario.first.mockResolvedValue(usuario);

        const resultado = await consultar("huerta");

        expect(resultado).toEqual(usuario);
        expect(baseSimulada.usuario.select).toHaveBeenCalledWith("id", "passwordHash", "rol");
        expect(baseSimulada.usuario.where).toHaveBeenCalledWith({ username: "huerta", rol });
    });

    it("devuelve null si no existe un usuario de ese rol", async () => {
        expect(await consultar("inexistente")).toBeNull();
    });
});

describe("obtenerUsuarioAdministradorPorCorreo", () => {
    it("busca el correo y obtiene al usuario con rol administrador", async () => {
        const usuario = { id: 1, passwordHash: "hash", rol: "ADMINISTRADOR" };
        baseSimulada.administrador.first.mockResolvedValue({ usuarioId: 1 });
        baseSimulada.usuario.first.mockResolvedValue(usuario);

        expect(await obtenerUsuarioAdministradorPorCorreo("admin@ejemplo.com"))
            .toEqual(usuario);
        expect(baseSimulada.administrador.where)
            .toHaveBeenCalledWith({ email: "admin@ejemplo.com" });
        expect(baseSimulada.usuario.where)
            .toHaveBeenCalledWith({ id: 1, rol: "ADMINISTRADOR" });
    });

    it("rechaza un correo que no pertenece a un administrador", async () => {
        expect(await obtenerUsuarioAdministradorPorCorreo("desconocido@ejemplo.com"))
            .toBeNull();
        expect(baseSimulada.usuario.first).not.toHaveBeenCalled();
    });

    it("devuelve null si la referencia no corresponde a un usuario administrador", async () => {
        baseSimulada.administrador.first.mockResolvedValue({ usuarioId: 1 });

        expect(await obtenerUsuarioAdministradorPorCorreo("admin@ejemplo.com"))
            .toBeNull();
    });
});

describe("obtenerOperadorAutenticadoPorUsuarioId", () => {
    it("obtiene el operador asociado al usuario de la sesion", async () => {
        baseSimulada.operador.first.mockResolvedValue({ id: 10 });

        expect(await obtenerOperadorAutenticadoPorUsuarioId(4)).toEqual({ id: 10 });
        expect(baseSimulada.operador.where).toHaveBeenCalledWith({ usuarioId: 4 });
    });

    it("devuelve null cuando el usuario no tiene un operador", async () => {
        expect(await obtenerOperadorAutenticadoPorUsuarioId(4)).toBeNull();
    });
});
