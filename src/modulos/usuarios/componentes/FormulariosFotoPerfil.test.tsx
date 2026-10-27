import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import FormularioAltaUsuario from "../administradores/componentes/alta-usuario/FormularioAltaUsuario";
import FormularioModificarOperador from "../operadores/componentes/modificar-operador-por-admin/FormularioModificarOperador";
import FormularioModificarProductor from "../productores/componentes/modificar-productor-por-admin/FormularioModificarProductor";

const mocks = vi.hoisted(() => ({
    rol: "operador",
    altaOperador: vi.fn(),
    altaProductor: vi.fn(),
    modificarOperador: vi.fn(),
    modificarProductor: vi.fn(),
    push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => ({ get: () => mocks.rol }),
    useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/modulos/usuarios/operadores/altaOperador", () => ({ altaOperador: mocks.altaOperador }));
vi.mock("@/modulos/usuarios/productores/altaProductor", () => ({ altaProductor: mocks.altaProductor }));
vi.mock("@/modulos/usuarios/operadores/acciones/modificarOperador", () => ({ modificarOperador: mocks.modificarOperador }));
vi.mock("@/modulos/usuarios/productores/componentes/modificar-productor-por-admin/modificarProductor", () => ({ modificarProductor: mocks.modificarProductor }));

const URLOriginal = URL;
const revocarUrl = vi.fn();
const naves = [{ id: 1, nombre: "Nave A" }];
const datos = { id: 7, nombre: "Huerta Sur", codigoPais: "+598", telefono: "99123456", fotoPerfil: "/api/imagenes/productores/7/actual.webp" };

function elegirFoto() {
    const archivo = new File(["png"], "perfil.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Seleccionar foto de perfil"), { target: { files: [archivo] } });
    return archivo;
}

function renderizarModificacion(rol: "operador" | "productor") {
    if (rol === "operador") render(<FormularioModificarOperador operador={{ ...datos, fotoPerfil: "/api/imagenes/operadores/7/actual.webp", locales: [{ nombre: "001", naveId: 1, contrato: "" }] }} naves={naves} />);
    else render(<FormularioModificarProductor productor={datos} />);
    return rol === "operador" ? mocks.modificarOperador : mocks.modificarProductor;
}

describe("Fotos en altas y modificaciones administrativas", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.rol = "operador";
        vi.stubGlobal("URL", class extends URLOriginal {
            static createObjectURL = () => "blob:perfil.png";
            static revokeObjectURL = revocarUrl;
        });
    });

    afterEach(() => {
        cleanup();
        vi.unstubAllGlobals();
    });

    it.each(["operador", "productor"] as const)("envía la foto con el alta de %s, bloquea duplicados y limpia la selección al finalizar", async (rol) => {
        mocks.rol = rol;
        const accion = rol === "operador" ? mocks.altaOperador : mocks.altaProductor;
        let resolver!: (valor: unknown) => void;
        accion.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; }));
        render(<FormularioAltaUsuario naves={naves} />);
        const archivo = elegirFoto();
        await screen.findByRole("img", { name: "Vista previa de la foto de perfil" });
        expect(accion).not.toHaveBeenCalled();
        const formulario = screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!;
        act(() => { fireEvent.submit(formulario); fireEvent.submit(formulario); });
        expect(accion).toHaveBeenCalledTimes(1);
        expect((accion.mock.calls[0][1] as FormData).get("fotoPerfil")).toBe(archivo);
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "Limpiar" })).toBeDisabled();
        expect(screen.getByRole("combobox", { name: /^Rol del usuario/ })).toHaveAttribute("aria-disabled", "true");
        await act(async () => resolver({ esValido: true, id: 7, mensaje: "Usuario registrado." }));
        expect(screen.getByRole("button", { name: "Agregar foto" })).toBeEnabled();
        expect(screen.queryByRole("img", { name: "Vista previa de la foto de perfil" })).not.toBeInTheDocument();
        expect(revocarUrl).toHaveBeenCalledWith("blob:perfil.png");
    });

    it("limpia la selección de foto al limpiar el alta o cambiar de rol", async () => {
        render(<FormularioAltaUsuario naves={naves} />);
        elegirFoto();
        await screen.findByRole("img");
        fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        elegirFoto();
        await screen.findByRole("img");
        fireEvent.mouseDown(screen.getByRole("combobox", { name: /^Rol del usuario/ }));
        fireEvent.click(screen.getByRole("option", { name: "Productor" }));
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Agregar foto" })).toBeEnabled();
        expect(mocks.altaOperador).not.toHaveBeenCalled();
        expect(mocks.altaProductor).not.toHaveBeenCalled();
    });

    it.each(["operador", "productor"] as const)("conserva la foto preparada cuando falla la validación del alta de %s", async (rol) => {
        mocks.rol = rol;
        const accion = rol === "operador" ? mocks.altaOperador : mocks.altaProductor;
        accion.mockResolvedValueOnce({ esValido: false, errores: ["Ya existe ese usuario."] });
        render(<FormularioAltaUsuario naves={naves} />);
        elegirFoto();
        await screen.findByRole("img");
        fireEvent.submit(screen.getByRole("button", { name: "Registrar usuario" }).closest("form")!);
        expect(await screen.findByText("Ya existe ese usuario.")).toBeVisible();
        expect(screen.getByRole("img")).toHaveAttribute("src", "blob:perfil.png");
        expect(screen.getByRole("button", { name: "Cambiar foto" })).toBeEnabled();
    });

    it.each(["operador", "productor"] as const)("envía el reemplazo al modificar %s y conserva la selección si falla", async (rol) => {
        const accion = renderizarModificacion(rol);
        accion.mockResolvedValueOnce({ esValido: false, errores: ["El nombre ya existe."] });
        const archivo = elegirFoto();
        await waitFor(() => expect(screen.getByRole("img")).toHaveAttribute("src", "blob:perfil.png"));
        expect(accion).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(await screen.findByText("El nombre ya existe.")).toBeVisible();
        expect((accion.mock.calls[0][1] as FormData).get("fotoPerfil")).toBe(archivo);
        expect(screen.getByRole("img")).toHaveAttribute("src", "blob:perfil.png");
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it.each(["operador", "productor"] as const)("envía la eliminación explícita de la foto de %s sólo al guardar", async (rol) => {
        const accion = renderizarModificacion(rol);
        accion.mockResolvedValueOnce({ esValido: true, id: 7 });
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        expect(accion).not.toHaveBeenCalled();
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith(`/gestion-${rol === "operador" ? "operadores" : "productores"}/7`));
        const formulario = accion.mock.calls[0][1] as FormData;
        expect(formulario.get("eliminarFoto")).toBe("true");
        expect(formulario.has("fotoPerfil")).toBe(false);
    });

    it.each(["operador", "productor"] as const)("deshacer el cambio de foto de %s vuelve a guardar sin modificarla", async (rol) => {
        const accion = renderizarModificacion(rol);
        accion.mockResolvedValueOnce({ esValido: true, id: 7 });
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        fireEvent.click(screen.getByRole("button", { name: "Deshacer cambio" }));
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => expect(accion).toHaveBeenCalledTimes(1));
        expect(accion.mock.calls[0]).toHaveLength(1);
    });
});
