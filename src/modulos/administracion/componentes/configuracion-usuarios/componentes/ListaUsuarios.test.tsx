import { act, fireEvent, render, screen, waitFor, within } from "@/test-utils";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioParaModificar } from "../Tipos";
import ListaUsuarios from "./ListaUsuarios";

const estadoTest = vi.hoisted(() => ({
    simularServidor: false,
    esMobile: false,
    routerPush: vi.fn(),
}));

vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();

    return {
        ...actual,
        useSyncExternalStore: (
            subscribe: (callback: () => void) => () => void,
            getSnapshot: () => boolean,
            getServerSnapshot: () => boolean,
        ) => {
            if (estadoTest.simularServidor) {
                const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
                let desuscribir = () => { };

                try {
                    Object.defineProperty(globalThis, "window", {
                        configurable: true,
                        writable: true,
                        value: undefined,
                    });
                    desuscribir = subscribe(() => { });
                } finally {
                    if (descriptor) {
                        Object.defineProperty(globalThis, "window", descriptor);
                    } else {
                        Reflect.deleteProperty(globalThis, "window");
                    }
                }

                desuscribir();
                return getServerSnapshot();
            }

            const desuscribir = subscribe(() => { });
            desuscribir();
            return getSnapshot();
        },
    };
});

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: estadoTest.routerPush }),
}));

interface PaginationMockProps {
    count: number;
    page: number;
    size: "small" | "medium";
    onChange: (evento: ChangeEvent<unknown>, pagina: number) => void;
}

vi.mock("@mui/material/Pagination", () => ({
    default: ({ count, page, size, onChange }: PaginationMockProps) => (
        <nav data-testid="paginacion" data-size={size}>
            {Array.from({ length: count }, (_, index) => {
                const numeroPagina = index + 1;

                return (
                    <button
                        key={numeroPagina}
                        type="button"
                        aria-label={`Página ${numeroPagina}`}
                        aria-current={page === numeroPagina ? "page" : undefined}
                        onClick={() => onChange({} as ChangeEvent<unknown>, numeroPagina)}
                    >
                        {numeroPagina}
                    </button>
                );
            })}
        </nav>
    ),
}));

vi.mock("@mui/material/Dialog", () => ({
    default: ({
        open,
        onClose,
        children,
        "aria-labelledby": tituloId,
    }: {
        open: boolean;
        onClose: () => void;
        children?: ReactNode;
        "aria-labelledby"?: string;
    }) => tituloId && !open ? null : (
        <div data-testid={tituloId ? "dialog-habilitacion" : "dialog"} hidden={!open}>
            {children}
            <button type="button" data-testid="cerrar-dialogo" onClick={onClose}>
                Cerrar diálogo
            </button>
        </div>
    ),
}));

vi.mock("@mui/material/DialogTitle", () => ({
    default: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock("@mui/material/DialogContent", () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@mui/material/DialogActions", () => ({
    default: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@mui/material/Button", () => ({
    default: ({
        children,
        onClick,
        type = "button",
        disabled,
    }: {
        children?: ReactNode;
        onClick?: (evento: MouseEvent<HTMLButtonElement>) => void;
        type?: "button" | "submit" | "reset";
        disabled?: boolean;
    }) => (
        <button type={type} onClick={onClick} disabled={disabled}>
            {children}
        </button>
    ),
}));

vi.mock("@mui/icons-material/Edit", () => ({
    default: () => <span data-testid="icono-editar" />,
}));

vi.mock("@mui/icons-material/Delete", () => ({
    default: () => <span data-testid="icono-eliminar" />,
}));

const usuarios: UsuarioParaModificar[] = [
    {
        id: 1,
        username: "ana.admin",
        rol: "ADMINISTRADOR",
        administradorId: 101,
        email: "ana@example.com",
    },
    {
        id: 2,
        username: "beto.operador",
        rol: "OPERADOR",
        operadorId: 201,
        nombreFantasia: "La Huerta",
    },
    {
        id: 3,
        username: "carla.productor",
        rol: "PRODUCTOR",
        productorId: 301,
        nombreFantasia: "Granja Carla",
    },
];

const usuariosPaginados: UsuarioParaModificar[] = [
    ...usuarios,
    ...Array.from({ length: 9 }, (_, index): UsuarioParaModificar => ({
        id: index + 4,
        username: `operador.${index + 1}`,
        rol: "OPERADOR",
        operadorId: index + 202,
        nombreFantasia: `Local ${index + 1}`,
    })),
];

interface PropsTest {
    usuarios: UsuarioParaModificar[];
    usuarioSeleccionadoId: number | null;
    onSeleccionar?: (usuario: UsuarioParaModificar) => void;
    onEliminar?: (usuario: UsuarioParaModificar) => void;
    usuarioActualId?: number;
    onCambiarHabilitacion?: (usuario: UsuarioParaModificar) => Promise<void>;
}

function renderLista(props: Partial<PropsTest> = {}) {
    return render(
        <ListaUsuarios
            usuarios={usuarios}
            usuarioSeleccionadoId={null}
            {...props}
        />,
    );
}

function obtenerFila(username: string): HTMLElement {
    const fila = screen.getByText(username).closest('[role="button"]');

    if (!fila) {
        throw new Error(`No se encontró la fila del usuario ${username}`);
    }

    return fila as HTMLElement;
}

function hacerClickEnAccion(username: string, titulo: string) {
    const boton = obtenerFila(username).querySelector(`button[title="${titulo}"]`);

    if (!(boton instanceof HTMLButtonElement)) {
        throw new Error(`No se encontró la acción "${titulo}" para ${username}`);
    }

    fireEvent.click(boton);
}

function abrirConfirmacionEliminacion(username: string) {
    hacerClickEnAccion(username, "Eliminar usuario");
    expect(screen.getByTestId("dialog")).toBeVisible();
}

function confirmarEliminacion() {
    fireEvent.click(screen.getByText("Eliminar", { selector: "button" }));
}

describe("ListaUsuarios", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        estadoTest.simularServidor = false;
        estadoTest.esMobile = false;

        Object.defineProperty(window, "matchMedia", {
            configurable: true,
            writable: true,
            value: vi.fn(() => ({
                matches: estadoTest.esMobile,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            })),
        });
    });

    it("permite ver usuarios deshabilitados y bloquea la deshabilitación del administrador actual", () => {
        const onCambiarHabilitacion = vi.fn();
        const onSeleccionar = vi.fn();
        renderLista({
            usuarios: [{ ...usuarios[0], habilitado: true }, { ...usuarios[1], habilitado: false }],
            usuarioActualId: 1,
            onCambiarHabilitacion,
            onSeleccionar,
        });

        expect(within(obtenerFila("ana.admin")).getByText("Habilitado")).toBeInTheDocument();
        const botonDeshabilitarPropio = within(obtenerFila("ana.admin")).getByRole("button", { name: "Deshabilitar usuario" });
        expect(botonDeshabilitarPropio).toBeDisabled();
        expect(within(obtenerFila("beto.operador")).getByText("Deshabilitado")).toBeInTheDocument();
        expect(within(obtenerFila("beto.operador")).getByRole("button", { name: "Habilitar usuario" })).toBeEnabled();

        fireEvent.click(botonDeshabilitarPropio);
        // MUI deja pasar el clic al contenedor cuando el botón está deshabilitado.
        fireEvent.click(botonDeshabilitarPropio.parentElement!);

        expect(screen.queryByTestId("dialog-habilitacion")).not.toBeInTheDocument();
        expect(onCambiarHabilitacion).not.toHaveBeenCalled();
        expect(onSeleccionar).not.toHaveBeenCalled();
        expect(estadoTest.routerPush).not.toHaveBeenCalled();
    });

    it("solicita confirmación y permite cancelar sin cambiar el estado ni seleccionar la fila", () => {
        const onCambiarHabilitacion = vi.fn();
        const onSeleccionar = vi.fn();
        renderLista({ onCambiarHabilitacion, onSeleccionar });

        hacerClickEnAccion("beto.operador", "Deshabilitar usuario");
        const dialogo = screen.getByTestId("dialog-habilitacion");
        expect(within(dialogo).getByText("¿Deshabilitar usuario?")).toBeVisible();
        expect(within(dialogo).getByText("@beto.operador")).toBeVisible();
        expect(onCambiarHabilitacion).not.toHaveBeenCalled();
        expect(onSeleccionar).not.toHaveBeenCalled();
        expect(estadoTest.routerPush).not.toHaveBeenCalled();

        fireEvent.click(within(dialogo).getByRole("button", { name: "Cancelar" }));

        expect(screen.queryByTestId("dialog-habilitacion")).not.toBeInTheDocument();
        expect(onCambiarHabilitacion).not.toHaveBeenCalled();
    });

    it.each([true, false])("confirma el cambio del usuario habilitado=%s y conserva su fila", async (habilitado) => {
        const usuario = { ...usuarios[1], habilitado };
        const onCambiarHabilitacion = vi.fn().mockResolvedValue(undefined);
        renderLista({ usuarios: [usuario], onCambiarHabilitacion });

        hacerClickEnAccion(usuario.username, habilitado ? "Deshabilitar usuario" : "Habilitar usuario");
        fireEvent.click(within(screen.getByTestId("dialog-habilitacion")).getByRole("button", { name: habilitado ? "Deshabilitar" : "Habilitar" }));

        await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent(
            `El usuario beto.operador fue ${habilitado ? "deshabilitado" : "habilitado"} correctamente.`,
        ));
        expect(onCambiarHabilitacion).toHaveBeenCalledExactlyOnceWith(usuario);
        expect(screen.queryByTestId("dialog-habilitacion")).not.toBeInTheDocument();
        expect(obtenerFila(usuario.username)).toBeInTheDocument();
    });

    it("bloquea acciones y cierre mientras se guarda y no duplica la confirmación", async () => {
        const pendiente = Promise.withResolvers<void>();
        const onCambiarHabilitacion = vi.fn(() => pendiente.promise);
        renderLista({ onCambiarHabilitacion, onEliminar: vi.fn() });
        hacerClickEnAccion("beto.operador", "Deshabilitar usuario");
        const dialogo = screen.getByTestId("dialog-habilitacion");

        fireEvent.click(within(dialogo).getByRole("button", { name: "Deshabilitar" }));
        const confirmar = within(dialogo).getByRole("button", { name: "Guardando..." });
        expect(confirmar).toBeDisabled();
        expect(within(dialogo).getByRole("button", { name: "Cancelar" })).toBeDisabled();
        expect(within(obtenerFila("beto.operador")).getByTitle("Editar perfil")).toBeDisabled();
        expect(within(obtenerFila("beto.operador")).getByTitle("Eliminar usuario")).toBeDisabled();
        fireEvent.click(confirmar);
        fireEvent.click(within(dialogo).getByTestId("cerrar-dialogo"));
        expect(dialogo).toBeVisible();
        expect(onCambiarHabilitacion).toHaveBeenCalledOnce();

        await act(async () => pendiente.resolve());
        expect(screen.queryByTestId("dialog-habilitacion")).not.toBeInTheDocument();
    });

    it("mantiene la confirmación y el estado previo cuando falla el guardado", async () => {
        renderLista({ onCambiarHabilitacion: vi.fn().mockRejectedValue(new Error("No se pudo guardar el estado.")) });
        hacerClickEnAccion("beto.operador", "Deshabilitar usuario");
        const dialogo = screen.getByTestId("dialog-habilitacion");
        fireEvent.click(within(dialogo).getByRole("button", { name: "Deshabilitar" }));

        await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("No se pudo guardar el estado."));
        expect(dialogo).toBeVisible();
        expect(within(obtenerFila("beto.operador")).getByText("Habilitado")).toBeInTheDocument();
        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("permite accionar con teclado sin navegar al perfil del usuario", () => {
        renderLista({ onCambiarHabilitacion: vi.fn() });
        const boton = within(obtenerFila("beto.operador")).getByRole("button", { name: "Deshabilitar usuario" });
        fireEvent.keyDown(boton, { key: "Enter" });
        fireEvent.click(boton);

        expect(estadoTest.routerPush).not.toHaveBeenCalled();
        expect(screen.getByTestId("dialog-habilitacion")).toBeVisible();
    });

    it("muestra el mensaje vacío y cubre la confirmación sin un usuario seleccionado", () => {
        estadoTest.simularServidor = true;

        renderLista({ usuarios: [] });

        estadoTest.simularServidor = false;

        expect(screen.getByText("No se encontraron usuarios.")).toBeInTheDocument();
        expect(screen.queryByTestId("paginacion")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();

        // El mock permite ejercitar la protección aunque el diálogo esté cerrado.
        confirmarEliminacion();

        expect(screen.getByText("No se encontraron usuarios.")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("muestra la información de cada rol y permite seleccionar con click y teclado", () => {
        const onSeleccionar = vi.fn();

        renderLista({
            usuarios,
            usuarioSeleccionadoId: 2,
            usuarioActualId: 7,
            onSeleccionar,
        });

        const filaAdmin = obtenerFila("ana.admin");
        const filaOperador = obtenerFila("beto.operador");
        const filaProductor = obtenerFila("carla.productor");

        expect(within(filaAdmin).getByText("ana@example.com")).toBeInTheDocument();
        expect(within(filaAdmin).getByText("Administrador")).toBeInTheDocument();

        expect(within(filaOperador).getByText("La Huerta")).toBeInTheDocument();
        expect(within(filaOperador).getByText("Operador")).toBeInTheDocument();

        expect(within(filaProductor).getByText("Granja Carla")).toBeInTheDocument();
        expect(within(filaProductor).getByText("Productor")).toBeInTheDocument();

        // Una tecla diferente no selecciona al usuario.
        fireEvent.keyDown(filaAdmin, { key: "ArrowDown" });
        expect(estadoTest.routerPush).not.toHaveBeenCalled();

        fireEvent.keyDown(filaAdmin, { key: "Enter" });
        fireEvent.keyDown(filaOperador, { key: " " });
        fireEvent.click(filaProductor);

        expect(onSeleccionar).toHaveBeenCalledTimes(3);
        expect(onSeleccionar).toHaveBeenNthCalledWith(1, usuarios[0]);
        expect(onSeleccionar).toHaveBeenNthCalledWith(2, usuarios[1]);
        expect(onSeleccionar).toHaveBeenNthCalledWith(3, usuarios[2]);

        expect(estadoTest.routerPush).toHaveBeenCalledTimes(3);
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(1, "/gestion-administradores/101");
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(2, "/gestion-operadores/201");
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(3, "/gestion-productores/301");

    });

    it.each(["click", "Enter", " "])("abre Mi perfil al seleccionar la propia cuenta con %s", (accion) => {
        const onSeleccionar = vi.fn();
        renderLista({ usuarioActualId: 1, onSeleccionar });
        const fila = obtenerFila("ana.admin");

        if (accion === "click") fireEvent.click(fila);
        else fireEvent.keyDown(fila, { key: accion });

        expect(onSeleccionar).toHaveBeenCalledExactlyOnceWith(usuarios[0]);
        expect(estadoTest.routerPush).toHaveBeenCalledExactlyOnceWith("/mi-perfil");
    });

    it("navega a la edición de cada rol", () => {
        renderLista();

        hacerClickEnAccion("ana.admin", "Editar perfil");
        hacerClickEnAccion("beto.operador", "Editar perfil");
        hacerClickEnAccion("carla.productor", "Editar perfil");
        expect(estadoTest.routerPush).toHaveBeenCalledWith("/gestion-operadores/201/editar");
        expect(estadoTest.routerPush).toHaveBeenCalledWith("/gestion-productores/301/editar");
        expect(estadoTest.routerPush).toHaveBeenCalledWith("/gestion-administradores/101/editar");

        fireEvent.click(obtenerFila("ana.admin"));

        expect(estadoTest.routerPush).toHaveBeenCalledTimes(4);
        expect(estadoTest.routerPush).toHaveBeenLastCalledWith("/gestion-administradores/101");
    });

    it("navega a editar sin propagar el click a la fila", () => {
        const onSeleccionar = vi.fn();

        renderLista({ onSeleccionar });

        hacerClickEnAccion("beto.operador", "Editar perfil");

        expect(onSeleccionar).not.toHaveBeenCalled();
        expect(estadoTest.routerPush).toHaveBeenCalledExactlyOnceWith("/gestion-operadores/201/editar");
    });

    it("pagina los resultados en escritorio", () => {
        estadoTest.esMobile = false;

        renderLista({ usuarios: usuariosPaginados });

        expect(screen.getByTestId("paginacion")).toHaveAttribute("data-size", "medium");
        expect(screen.getByRole("button", { name: "Página 1" })).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByText("ana.admin")).toBeInTheDocument();
        expect(screen.queryByText("operador.8")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Página 2" }));

        expect(screen.getByText("operador.8")).toBeInTheDocument();
        expect(screen.queryByText("ana.admin")).not.toBeInTheDocument();
    });

    it("pagina los resultados en móvil usando siete usuarios por página", () => {
        estadoTest.esMobile = true;

        renderLista({ usuarios: usuariosPaginados });

        expect(screen.getByTestId("paginacion")).toHaveAttribute("data-size", "small");
        expect(screen.getByText("operador.4")).toBeInTheDocument();
        expect(screen.queryByText("operador.5")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Página 2" }));

        expect(screen.getByText("operador.5")).toBeInTheDocument();
        expect(screen.queryByText("operador.4")).not.toBeInTheDocument();
    });

    it("permite cancelar la eliminación y cerrar el diálogo mediante onClose", () => {
        renderLista({ onEliminar: vi.fn() });

        abrirConfirmacionEliminacion("beto.operador");

        expect(screen.getByText("@beto.operador")).toBeInTheDocument();

        fireEvent.click(screen.getByText("Cancelar", { selector: "button" }));

        expect(screen.getByTestId("dialog")).not.toBeVisible();

        abrirConfirmacionEliminacion("beto.operador");

        fireEvent.click(screen.getByTestId("cerrar-dialogo"));

        expect(screen.getByTestId("dialog")).not.toBeVisible();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("deshabilita la baja sin un backend y no anuncia una eliminación ficticia", () => {
        renderLista();

        for (const usuario of usuarios) {
            expect(within(obtenerFila(usuario.username)).getByTitle("Baja todavía no disponible")).toBeDisabled();
        }
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("espera a onEliminar antes de mostrar el éxito y permite cerrar la notificación", async () => {
        const onEliminar = vi.fn().mockResolvedValue(undefined);

        renderLista({ onEliminar });

        abrirConfirmacionEliminacion("beto.operador");
        confirmarEliminacion();

        await waitFor(() => {
            expect(onEliminar).toHaveBeenCalledWith(usuarios[1]);
            expect(screen.getByRole("status")).toHaveTextContent(
                "El usuario beto.operador fue eliminado correctamente.",
            );
        });

        expect(screen.queryByText("beto.operador")).not.toBeInTheDocument();
        expect(screen.getByTestId("dialog")).not.toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));

        expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });

    it("mantiene al usuario y muestra un error cuando onEliminar falla", async () => {
        const onEliminar = vi.fn().mockRejectedValue(new Error("Error de prueba"));

        renderLista({ onEliminar });

        abrirConfirmacionEliminacion("beto.operador");
        confirmarEliminacion();

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Error de prueba",
            );
        });

        expect(screen.getByText("beto.operador")).toBeInTheDocument();
        expect(screen.getByTestId("dialog")).not.toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Cerrar notificación" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
    it("muestra el indicador solo a usuarios que solicitaron restablecimiento", () => {
        renderLista({
            usuarios: [
                { ...usuarios[1], solicitoRestablecimiento: true },
                { ...usuarios[2], solicitoRestablecimiento: false },
            ],
        });

        expect(
            within(obtenerFila("beto.operador")).getByText("Restablecimiento solicitado")
        ).toBeInTheDocument();

        expect(
            within(obtenerFila("carla.productor")).queryByText("Restablecimiento solicitado")
        ).not.toBeInTheDocument();
    });
});
