import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@/test-utils";
import FormularioModificarProductor from "../componentes/modificar-productor-por-admin/FormularioModificarProductor";

const mocks = vi.hoisted(() => ({ guardar: vi.fn(), guardarAdmin: vi.fn(), push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("./modificarMiPerfilProductor", () => ({ modificarMiPerfilProductor: mocks.guardar }));
vi.mock("../componentes/modificar-productor-por-admin/modificarProductor", () => ({ modificarProductor: mocks.guardarAdmin }));
const productor = { id: 5, nombre: "Granja Norte", nombreUsuario: "granja_norte", codigoPais: "+598", telefono: "99123456", fotoPerfil: "/api/imagenes/actual" };
const guardar = () => fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

describe("formulario de mi perfil como Productor", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.guardar.mockResolvedValue({ esValido: true, id: 5, mensaje: "Tu perfil se actualizó correctamente." });
    });
    afterEach(() => { cleanup(); vi.restoreAllMocks(); });

    it("muestra nombre, contacto y fotografía actuales", () => {
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        expect(screen.getByRole("heading", { name: "Editar mi perfil" })).toBeInTheDocument();
        expect(screen.getByText("granja_norte")).toBeInTheDocument();
        expect(screen.getByLabelText("Nombre")).toHaveValue("Granja Norte");
        expect(screen.getByLabelText(/WhatsApp/)).toHaveValue("99123456");
        expect(screen.getByRole("img", { name: "Vista previa de la foto de perfil" })).toHaveAttribute("src", expect.stringContaining(productor.fotoPerfil));
    });

    it.each(["99222333"])("envía el contacto %j y vuelve al perfil actualizado", async (telefono) => {
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: telefono } });
        guardar();
        await waitFor(() => expect(mocks.push).toHaveBeenCalledWith("/mi-perfil/productor"));
        expect(mocks.guardar).toHaveBeenCalledExactlyOnceWith({ nombre: productor.nombre, codigoPais: "+598", telefono });
        expect(mocks.guardarAdmin).not.toHaveBeenCalled();
        expect(mocks.refresh).toHaveBeenCalled();
    });

    it("permite cargar contacto en un perfil sin número", async () => {
        render(<FormularioModificarProductor productor={{ ...productor, telefono: "" }} perfilPropio />);
        fireEvent.change(screen.getByLabelText(/WhatsApp/), { target: { value: "099123456" } });
        guardar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalledWith(expect.objectContaining({ telefono: "099123456" })));
    });

    it("identifica WhatsApp como un campo obligatorio", () => {
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        const telefono = screen.getByLabelText(/WhatsApp/);
        expect(telefono).toBeRequired();
        fireEvent.change(telefono, { target: { value: "" } });
        expect(telefono).toBeInvalid();
    });

    it("muestra errores de validación y permite corregirlos sin navegar", async () => {
        mocks.guardar.mockResolvedValueOnce({ esValido: false, errores: ["El teléfono no es válido."] });
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        guardar();
        expect(await screen.findByRole("alert")).toHaveTextContent("El teléfono no es válido.");
        expect(mocks.push).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    });

    it("cancela sin guardar los cambios", () => {
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Sin guardar" } });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(mocks.push).toHaveBeenCalledWith("/mi-perfil/productor");
        expect(mocks.guardar).not.toHaveBeenCalled();
    });

    it("no ofrece cambiar la contraseña en el formulario de perfil propio", () => {
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        expect(screen.queryByRole("heading", { name: "Cambiar contraseña" })).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Nueva contraseña")).not.toBeInTheDocument();
        expect(screen.queryByLabelText("Confirmar contraseña")).not.toBeInTheDocument();
    });

    it("envía la eliminación de fotografía usando el selector compartido", async () => {
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        fireEvent.click(screen.getByRole("button", { name: "Quitar foto" }));
        guardar();
        await waitFor(() => expect(mocks.guardar).toHaveBeenCalled());
        const foto = mocks.guardar.mock.calls[0][1] as FormData;
        expect(foto.get("eliminarFoto")).toBe("true");
    });

    it("evita envíos repetidos mientras se guarda", async () => {
        let terminar!: (valor: unknown) => void;
        mocks.guardar.mockReturnValue(new Promise((resolve) => { terminar = resolve; }));
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        const formulario = screen.getByRole("button", { name: "Guardar cambios" }).closest("form")!;
        fireEvent.submit(formulario); fireEvent.submit(formulario);
        expect(mocks.guardar).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("button", { name: "Guardando..." })).toBeDisabled();
        terminar({ esValido: true, id: 5, mensaje: "Guardado" });
        await waitFor(() => expect(mocks.push).toHaveBeenCalled());
    });

    it("notifica el fallo de guardado sin anunciar éxito ni navegar", async () => {
        vi.spyOn(console, "error").mockImplementation(() => {});
        mocks.guardar.mockRejectedValue(new Error("Sin conexión"));
        render(<FormularioModificarProductor productor={productor} perfilPropio />);
        guardar();
        expect(await screen.findByText("No se pudieron guardar los cambios. Intentá de nuevo.")).toBeInTheDocument();
        expect(mocks.push).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
    });
});
