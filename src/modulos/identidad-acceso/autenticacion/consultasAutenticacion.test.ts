// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    obtenerIdentidadProductorPorUsuarioId,
    obtenerUsuarioAdministradorPorCorreo,
    obtenerUsuarioOperadorPorNombre,
    obtenerUsuarioProductorPorNombre,
} from "./consultasAutenticacion";

const baseSimulada = vi.hoisted(() => ({
    usuario: { select: vi.fn(), where: vi.fn(), first: vi.fn() },
    administrador: { select: vi.fn(), where: vi.fn(), first: vi.fn() },
    productor: { select: vi.fn(), where: vi.fn(), first: vi.fn() },
}));

vi.mock("../../../infraestructura/persistencia/prisma/db", () => ({
    db: {
        orm: {
            public: {
                Usuario: baseSimulada.usuario,
                Administrador: baseSimulada.administrador,
                Productor: baseSimulada.productor,
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
    it.each([true, false])("devuelve el estado habilitado=%s y restringe el nombre y rol", async (habilitado) => {
        const usuario = { id: 4, passwordHash: "hash", rol, habilitado };
        baseSimulada.usuario.first.mockResolvedValue(usuario);

        const resultado = await consultar("huerta");

        expect(resultado).toEqual(usuario);
        expect(baseSimulada.usuario.select).toHaveBeenCalledWith("id", "passwordHash", "rol", "habilitado");
        expect(baseSimulada.usuario.where).toHaveBeenCalledWith({ username: "huerta", rol });
    });

    it("devuelve null si no existe un usuario de ese rol", async () => {
        expect(await consultar("inexistente")).toBeNull();
    });
});

describe("obtenerUsuarioAdministradorPorCorreo", () => {
    it.each([true, false])("busca el correo y devuelve el estado habilitado=%s del administrador", async (habilitado) => {
        const usuario = { id: 1, passwordHash: "hash", rol: "ADMINISTRADOR", habilitado };
        baseSimulada.administrador.first.mockResolvedValue({ usuarioId: 1 });
        baseSimulada.usuario.first.mockResolvedValue(usuario);

        expect(await obtenerUsuarioAdministradorPorCorreo("admin@ejemplo.com"))
            .toEqual(usuario);
        expect(baseSimulada.administrador.where)
            .toHaveBeenCalledWith({ email: "admin@ejemplo.com" });
        expect(baseSimulada.usuario.where)
            .toHaveBeenCalledWith({ id: 1, rol: "ADMINISTRADOR" });
        expect(baseSimulada.usuario.select).toHaveBeenCalledWith("id", "passwordHash", "rol", "habilitado");
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

describe("obtenerIdentidadProductorPorUsuarioId", () => {
    it.each(["/api/imagenes/foto-productor", null])("devuelve nombre y foto del productor asociado al usuario: %s", async (fotoPerfil) => {
        const perfil = { nombreFantasia: "Granja Norte", fotoPerfil };
        baseSimulada.productor.first.mockResolvedValue(perfil);

        expect(await obtenerIdentidadProductorPorUsuarioId(9)).toEqual(perfil);
        expect(baseSimulada.productor.select).toHaveBeenCalledWith("nombreFantasia", "fotoPerfil");
        expect(baseSimulada.productor.where).toHaveBeenCalledWith({ usuarioId: 9 });
    });

    it("devuelve null si no existe el productor", async () => {
        expect(await obtenerIdentidadProductorPorUsuarioId(9)).toBeNull();
    });
});
