import { fireEvent, render, screen, waitFor, within } from "@/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Temporal } from "temporal-polyfill";
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
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Temporal.Now, "plainDateISO").mockImplementation((zona) =>
            Temporal.Instant.from("2026-11-15T01:30:00Z").toZonedDateTimeISO(zona ?? "UTC").toPlainDate(),
        );
    });
    afterEach(() => vi.restoreAllMocks());

    it("carga licencia y contacto, permite editar y guarda correctamente", async () => {
        mocks.modificar.mockResolvedValue({ esValido: true, mensaje: "ok" });
        const cancelar = vi.fn();
        render(<FormularioPerfilPropio perfil={perfil} alCancelar={cancelar} />);

        expect(screen.getByLabelText("Código de país")).toHaveTextContent("+598");
        expect(screen.getByLabelText(/Teléfono/)).toHaveValue("99123456");
        expect(screen.getByRole("switch", { name: "En licencia" })).toBeChecked();
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Inicio de licencia")).toHaveValue("2999-11-05");
        expect(screen.getByLabelText("Mensaje de recomendación")).toHaveValue("Consultar disponibilidad.");

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
        expect(aviso).toHaveTextContent("La gestión de licencias debe tramitarse exclusivamente a través de los mecanismos habituales de la UAM. La información exhibida en este sitio tiene carácter meramente informativo.");
        expect(interruptor).not.toBeChecked();
        expect(mocks.modificar).not.toHaveBeenCalled();

        fireEvent.click(within(aviso).getByRole("button", { name: "Aceptar" }));
        await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
        expect(interruptor).toBeChecked();
        expect(mocks.modificar).not.toHaveBeenCalled();
        expect(screen.getByLabelText("Inicio de licencia")).not.toHaveAttribute("min");
        expect(screen.getByLabelText("Fin de licencia")).toHaveAttribute("min", "2026-11-14");
        fireEvent.change(screen.getByLabelText("Inicio de licencia"), { target: { value: "2999-11-05" } });
        expect(screen.getByLabelText("Fin de licencia")).toHaveAttribute("min", "2999-11-05");
        fireEvent.change(screen.getByLabelText("Inicio de licencia"), { target: { value: "2000-11-05" } });
        expect(screen.getByLabelText("Fin de licencia")).toHaveAttribute("min", "2026-11-14");
        fireEvent.change(screen.getByLabelText("Fin de licencia"), { target: { value: "2026-11-14" } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        await waitFor(() => expect(mocks.modificar).toHaveBeenCalledWith(expect.objectContaining({
            enLicencia: true, inicioLicencia: "2000-11-05", finLicencia: "2026-11-14",
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
