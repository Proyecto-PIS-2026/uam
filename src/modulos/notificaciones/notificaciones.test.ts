import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { enviarNotificacion, type DestinatariosNotificacion } from "./notificaciones";

const mocks = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@/infraestructura/persistencia/prisma/db", () => ({
    db: { transaction: mocks.transaction },
}));

type Cliente = NonNullable<Parameters<typeof enviarNotificacion>[1]>;
type Usuario = { id: number; rol: RolUsuario };
type Filtro = { usuarios: number[] } | { roles: RolUsuario[] };
type CamposUsuario = {
    id: { in: (usuarios: number[]) => Filtro };
    rol: { in: (roles: RolUsuario[]) => Filtro };
};

function simularCliente(usuarios: Usuario[] = []) {
    const consultar = vi.fn(async (filtro: Filtro) => usuarios
        .filter((usuario) => "usuarios" in filtro ? filtro.usuarios.includes(usuario.id) : filtro.roles.includes(usuario.rol))
        .map(({ id }) => ({ id })));
    const where = vi.fn((condicion: (campos: CamposUsuario) => Filtro) => {
        const filtro = condicion({
            id: { in: (ids) => ({ usuarios: ids }) },
            rol: { in: (roles) => ({ roles }) },
        });
        return { all: () => consultar(filtro) };
    });
    const select = vi.fn(() => ({ where }));
    const crear = vi.fn().mockResolvedValue({});
    const cliente = { orm: { public: { Usuario: { select }, Notificacion: { create: crear } } } } as unknown as Cliente;
    return { cliente, consultar, select, crear };
}

describe("enviarNotificacion con una transacción existente", () => {
    beforeEach(() => {
        mocks.transaction.mockReset();
    });

    it("usa el cliente recibido, normaliza texto y URL y deduplica sólo destinatarios explícitos o de los roles pedidos", async () => {
        const simulado = simularCliente([
            { id: 10, rol: "OPERADOR" },
            { id: 20, rol: "PRODUCTOR" },
            { id: 30, rol: "OPERADOR" },
            { id: 40, rol: "ADMINISTRADOR" },
        ]);
        const entrada: DestinatariosNotificacion = {
            texto: "  Una publicación venció. \n",
            url: "/notificaciones/../mi-mercado?origen=aviso#productos",
            usuarios: [20, 20, 10, 999],
            roles: ["OPERADOR", "OPERADOR"],
        };

        await expect(enviarNotificacion(entrada, simulado.cliente)).resolves.toEqual({ enviadas: 3 });

        expect(mocks.transaction).not.toHaveBeenCalled();
        expect(simulado.select).toHaveBeenNthCalledWith(1, "id");
        expect(simulado.select).toHaveBeenNthCalledWith(2, "id");
        expect(simulado.consultar.mock.calls).toEqual([[{ usuarios: [20, 10, 999] }], [{ roles: ["OPERADOR"] }]]);
        expect(simulado.crear).toHaveBeenCalledTimes(3);
        expect(simulado.crear.mock.calls).toEqual(expect.arrayContaining([20, 10, 30].map((usuarioId) => [{
            titulo: "Notificación",
            descripcion: "Una publicación venció.",
            url: "/mi-mercado?origen=aviso#productos",
            usuarioId,
        }])));
        expect(entrada.usuarios).toEqual([20, 20, 10, 999]);
        expect(entrada.roles).toEqual(["OPERADOR", "OPERADOR"]);
    });

    it("no amplía el envío si el único destinatario ya no existe", async () => {
        const simulado = simularCliente([{ id: 10, rol: "OPERADOR" }]);

        await expect(enviarNotificacion({ texto: "Aviso", usuarios: [999] }, simulado.cliente)).resolves.toEqual({ enviadas: 0 });

        expect(simulado.consultar.mock.calls).toEqual([[{ usuarios: [999] }]]);
        expect(simulado.crear).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("devuelve cero sin consultar ni abrir una transacción cuando faltan destinatarios", async () => {
        const simulado = simularCliente([{ id: 10, rol: "OPERADOR" }]);

        for (const cliente of [undefined, simulado.cliente]) {
            await expect(enviarNotificacion({ texto: "Aviso" }, cliente)).resolves.toEqual({ enviadas: 0 });
            await expect(enviarNotificacion({ texto: "Aviso", usuarios: [], roles: [] }, cliente)).resolves.toEqual({ enviadas: 0 });
        }

        expect(simulado.select).not.toHaveBeenCalled();
        expect(simulado.crear).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it.each([
        { texto: " ", usuarios: [10] },
        { texto: "Aviso", usuarios: [10, 0] },
        { texto: "Aviso", usuarios: [10], roles: ["OPERADOR", "COMPRADOR"] },
        { texto: "Aviso", usuarios: [10], url: "https://externo.example/" },
    ])("valida toda la entrada antes de consultar o crear: %j", async (entrada) => {
        const simulado = simularCliente([{ id: 10, rol: "OPERADOR" }]);

        for (const cliente of [undefined, simulado.cliente]) {
            await expect(enviarNotificacion(entrada as DestinatariosNotificacion, cliente)).rejects.toMatchObject({ status: 400 });
        }

        expect(simulado.select).not.toHaveBeenCalled();
        expect(simulado.crear).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("propaga el fallo de creación para que la transacción del llamador pueda revertirse", async () => {
        const simulado = simularCliente([10, 20, 30].map((id): Usuario => ({ id, rol: "OPERADOR" })));
        const error = new Error("No se pudo crear la segunda copia");
        simulado.crear.mockResolvedValueOnce({}).mockRejectedValueOnce(error);

        await expect(enviarNotificacion({ texto: "Aviso", roles: ["OPERADOR"] }, simulado.cliente)).rejects.toBe(error);

        expect(simulado.crear).toHaveBeenCalledTimes(2);
        expect(mocks.transaction).not.toHaveBeenCalled();
    });

    it("propaga el fallo de consulta sin crear copias", async () => {
        const simulado = simularCliente();
        const error = new Error("No se pudieron consultar los usuarios");
        simulado.consultar.mockRejectedValueOnce(error);

        await expect(enviarNotificacion({ texto: "Aviso", usuarios: [10] }, simulado.cliente)).rejects.toBe(error);

        expect(simulado.crear).not.toHaveBeenCalled();
        expect(mocks.transaction).not.toHaveBeenCalled();
    });
});

describe("enviarNotificacion sin cliente", () => {
    beforeEach(() => {
        mocks.transaction.mockReset();
    });

    it("abre una sola transacción y utiliza su cliente para consultar y crear", async () => {
        const simulado = simularCliente([{ id: 10, rol: "OPERADOR" }, { id: 20, rol: "PRODUCTOR" }]);
        mocks.transaction.mockImplementation((operacion: (cliente: Cliente) => Promise<unknown>) => operacion(simulado.cliente));

        await expect(enviarNotificacion({ texto: "  Aviso  ", usuarios: [10, 10] })).resolves.toEqual({ enviadas: 1 });

        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(simulado.consultar.mock.calls).toEqual([[{ usuarios: [10] }]]);
        expect(simulado.crear).toHaveBeenCalledExactlyOnceWith({ titulo: "Notificación", descripcion: "Aviso", url: null, usuarioId: 10 });
    });

    it("propaga el rechazo de la transacción propia", async () => {
        const error = new Error("La transacción falló");
        mocks.transaction.mockRejectedValueOnce(error);

        await expect(enviarNotificacion({ texto: "Aviso", usuarios: [10] })).rejects.toBe(error);

        expect(mocks.transaction).toHaveBeenCalledTimes(1);
    });
});
