import { fireEvent, render, screen, waitFor, within } from "@/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import type { PerfilPropioOperador } from "../../consultasPerfilPropio";
import FormularioPerfilPropio from "./FormularioPerfilPropio";

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
    refresh: vi.fn(),
    modificar: vi.fn(),
    notificar: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }) }));
vi.mock("../../acciones/modificarPerfilPropio", () => ({ modificarPerfilPropio: mocks.modificar }));
vi.mock("@/compartido/componentes/NotificacionToast", () => ({
    useNotificacionToast: () => ({ notificar: mocks.notificar }),
    ProveedorNotificacionesToast: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@/modulos/usuarios/componentes/SelectorFotoPerfil", () => ({
    default: () => <div data-testid="selector-foto" />,
    argumentosFotoPerfil: () => [],
}));

const perfil: PerfilPropioOperador = {
    id: 7,
    nombre: "Frutas del Norte",
    nombreUsuario: "frutas",
    contacto: "+59899123456",
    fotoPerfil: null,
    comentario: "Licencia: 2999-11-05 - 2999-11-12\n\nConsultar disponibilidad.",
    enLicencia: true,
    locales: [],
};

describe("FormularioPerfilPropio", () => {
    beforeEach(() => vi.clearAllMocks());

    it("carga licencia y contacto, permite editar y guarda correctamente", async () => {
        mocks.modificar.mockResolvedValue({ esValido: true, mensaje: "ok" });
        const cancelar = vi.fn();
        render(<FormularioPerfilPropio perfil={perfil} alCancelar={cancelar} />);

        expect(screen.getByLabelText("Código de país")).toHaveTextContent("+598");
        expect(screen.getByLabelText(/Teléfono/)).toHaveValue("99123456");
        expect(screen.getByRole("switch", { name: "En licencia" })).toBeChecked();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Inicio de licencia")).toHaveValue("2999-11-05");
        expect(screen.getByLabelText("Mensaje de recomendación (opcional)")).toHaveValue("Consultar disponibilidad.");

        fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Nuevo nombre" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => expect(cancelar).toHaveBeenCalledOnce());
        expect(mocks.refresh).toHaveBeenCalledOnce();
        expect(mocks.notificar).toHaveBeenCalledWith("ok", "success");
        expect(mocks.modificar).toHaveBeenCalledWith(expect.objectContaining({
            nombre: "Nuevo nombre",
            enLicencia: true,
            inicioLicencia: "2999-11-05",
        }));
    });

    it("activa la licencia sólo al aceptar el aviso y espera a guardar para persistir", async () => {
        mocks.modificar.mockResolvedValue({ esValido: true, mensaje: "ok" });
        render(<FormularioPerfilPropio perfil={{ ...perfil, enLicencia: false, comentario: null }} alCancelar={vi.fn()} />);
        const interruptor = screen.getByRole("switch", { name: "En licencia" });

        fireEvent.click(interruptor);
        const aviso = screen.getByRole("alertdialog", { name: "Aviso de licencia" });
        expect(aviso).toHaveTextContent("La declaración de licencia en la aplicación no sustituye la solicitud formal ante el área jurídica de la UAM.");
        expect(interruptor).not.toBeChecked();
        expect(mocks.modificar).not.toHaveBeenCalled();

        fireEvent.click(within(aviso).getByRole("button", { name: "Aceptar" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(interruptor).toBeChecked();
        expect(mocks.modificar).not.toHaveBeenCalled();
        fireEvent.change(screen.getByLabelText("Inicio de licencia"), { target: { value: "2999-11-05" } });
        fireEvent.change(screen.getByLabelText("Fin de licencia"), { target: { value: "2999-11-12" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => expect(mocks.modificar).toHaveBeenCalledWith(expect.objectContaining({
            enLicencia: true, inicioLicencia: "2999-11-05", finLicencia: "2999-11-12",
        })));
    });

    it.each(["Cancelar", "Escape"])("cerrar el aviso con %s conserva la licencia desmarcada", async (cierre) => {
        const cancelar = vi.fn();
        render(<FormularioPerfilPropio perfil={{ ...perfil, enLicencia: false, comentario: null }} alCancelar={cancelar} />);
        const interruptor = screen.getByRole("switch", { name: "En licencia" });
        fireEvent.click(interruptor);
        const aviso = screen.getByRole("alertdialog", { name: "Aviso de licencia" });
        if (cierre === "Cancelar") fireEvent.click(within(aviso).getByRole("button", { name: "Cancelar" }));
        else fireEvent.keyDown(aviso, { key: "Escape" });

        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(interruptor).not.toBeChecked();
        expect(screen.queryByLabelText("Inicio de licencia")).not.toBeInTheDocument();
        expect(cancelar).not.toHaveBeenCalled();
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("permite desmarcar una licencia existente sin pedir confirmación", () => {
        render(<FormularioPerfilPropio perfil={perfil} alCancelar={vi.fn()} />);
        const interruptor = screen.getByRole("switch", { name: "En licencia" });
        fireEvent.click(interruptor);
        expect(interruptor).not.toBeChecked();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(mocks.modificar).not.toHaveBeenCalled();
    });

    it("muestra errores de validación y permite cancelar", async () => {
        mocks.modificar.mockResolvedValue({ esValido: false, errores: ["El nombre es obligatorio."] });
        const cancelar = vi.fn();
        render(<FormularioPerfilPropio perfil={{ ...perfil, enLicencia: false, comentario: null }} alCancelar={cancelar} />);
        fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("El nombre es obligatorio.");
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        expect(cancelar).toHaveBeenCalledOnce();
    });
});
