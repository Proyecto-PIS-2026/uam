import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ChangeEvent, MouseEvent, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UsuarioParaModificar } from "../Tipos";
import ListaUsuarios from "./ListaUsuarios";

const estadoTest = vi.hoisted(() => ({
    simularServidor: false,
    esMobile: false,
    routerPush: vi.fn(),
}));

// Permite ejercitar tanto la suscripción del navegador como la rama SSR.
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
                let desuscribir = () => {};

                try {
                    Object.defineProperty(globalThis, "window", {
                        configurable: true,
                        writable: true,
                        value: undefined,
                    });
                    desuscribir = subscribe(() => {});
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

            const desuscribir = subscribe(() => {});
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

vi.mock("@mui/material/IconButton", () => ({
    default: ({
        children,
        title,
        onClick,
    }: {
        children?: ReactNode;
        title?: string;
        onClick?: (evento: MouseEvent<HTMLButtonElement>) => void;
    }) => (
        <button type="button" title={title} onClick={onClick}>
            {children}
        </button>
    ),
}));

vi.mock("@mui/material/Dialog", () => ({
    default: ({
        open,
        onClose,
        children,
    }: {
        open: boolean;
        onClose: () => void;
        children?: ReactNode;
    }) => (
        <div data-testid="dialog" hidden={!open}>
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
    }: {
        children?: ReactNode;
        onClick?: (evento: MouseEvent<HTMLButtonElement>) => void;
        type?: "button" | "submit" | "reset";
    }) => (
        <button type={type} onClick={onClick}>
            {children}
        </button>
    ),
}));

vi.mock("@mui/material/Snackbar", () => ({
    default: ({
        open,
        onClose,
        children,
    }: {
        open: boolean;
        onClose: () => void;
        children?: ReactNode;
    }) => (
        <div data-testid="snackbar" hidden={!open}>
            {open ? children : undefined}
            <button type="button" aria-label="Cerrar snackbar" onClick={onClose}>
                Cerrar
            </button>
        </div>
    ),
}));

vi.mock("@mui/material/Alert", () => ({
    default: ({
        severity,
        onClose,
        children,
    }: {
        severity: "error" | "success";
        onClose: () => void;
        children?: ReactNode;
    }) => (
        <div role="alert" data-severity={severity}>
            {children}
            <button type="button" aria-label="Cerrar alerta" onClick={onClose}>
                Cerrar
            </button>
        </div>
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
    onEditar?: (usuario: UsuarioParaModificar) => void;
    onEliminar?: (usuario: UsuarioParaModificar) => void;
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
            onSeleccionar,
        });

        const filaAdmin = obtenerFila("ana.admin");
        const filaOperador = obtenerFila("beto.operador");
        const filaProductor = obtenerFila("carla.productor");

        expect(within(filaAdmin).getByText("ana@example.com")).toBeInTheDocument();
        expect(within(filaAdmin).getByText("Administrador")).toBeInTheDocument();

        expect(within(filaOperador).getByText("La Huerta")).toBeInTheDocument();
        expect(within(filaOperador).getByText("Operador")).toBeInTheDocument();

        expect(within(filaProductor).getByText("-")).toBeInTheDocument();
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

        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            1,
            "/gestion-de-administradores/101",
        );
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            2,
            "/gestion-de-opradores/201",
        );
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            3,
            "/gestion-de-productores/301",
        );
    });

    it("navega a la edición según el rol cuando no se proporciona onEditar", () => {
        renderLista();

        hacerClickEnAccion("ana.admin", "Editar perfil");
        hacerClickEnAccion("beto.operador", "Editar perfil");
        hacerClickEnAccion("carla.productor", "Editar perfil");

        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            1,
            "/gestion-de-administradores/101/editar",
        );
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            2,
            "/gestion-de-opradores/201/editar",
        );
        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            3,
            "/gestion-de-productores/301/editar",
        );

        // Sin onSeleccionar, la selección usa la navegación predeterminada.
        fireEvent.click(obtenerFila("ana.admin"));

        expect(estadoTest.routerPush).toHaveBeenNthCalledWith(
            4,
            "/gestion-de-administradores/101",
        );
    });

    it("utiliza onEditar cuando se proporciona y no propaga el click a la fila", () => {
        const onEditar = vi.fn();
        const onSeleccionar = vi.fn();

        renderLista({ onEditar, onSeleccionar });

        hacerClickEnAccion("beto.operador", "Editar perfil");

        expect(onEditar).toHaveBeenCalledTimes(1);
        expect(onEditar).toHaveBeenCalledWith(usuarios[1]);
        expect(onSeleccionar).not.toHaveBeenCalled();
        expect(estadoTest.routerPush).not.toHaveBeenCalled();
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
        renderLista();

        abrirConfirmacionEliminacion("ana.admin");

        expect(screen.getByText("@ana.admin")).toBeInTheDocument();

        fireEvent.click(screen.getByText("Cancelar", { selector: "button" }));

        expect(screen.getByTestId("dialog")).not.toBeVisible();

        abrirConfirmacionEliminacion("beto.operador");

        fireEvent.click(screen.getByTestId("cerrar-dialogo"));

        expect(screen.getByTestId("dialog")).not.toBeVisible();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("elimina al usuario y muestra una notificación de éxito sin onEliminar", async () => {
        renderLista({ usuarios: [usuarios[0]] });

        abrirConfirmacionEliminacion("ana.admin");
        confirmarEliminacion();

        await waitFor(() => {
            expect(
                screen.getByRole("alert"),
            ).toHaveTextContent(
                "El usuario ana.admin fue eliminado correctamente.",
            );
        });

        expect(screen.getByRole("alert")).toHaveAttribute("data-severity", "success");
        expect(screen.getByText("No se encontraron usuarios.")).toBeInTheDocument();
        expect(screen.getByTestId("dialog")).not.toBeVisible();

        // Cierre de la alerta.
        fireEvent.click(screen.getByRole("button", { name: "Cerrar alerta" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("espera a onEliminar antes de mostrar el éxito y permite cerrar el snackbar", async () => {
        const onEliminar = vi.fn().mockResolvedValue(undefined);

        renderLista({ onEliminar });

        abrirConfirmacionEliminacion("beto.operador");
        confirmarEliminacion();

        await waitFor(() => {
            expect(onEliminar).toHaveBeenCalledWith(usuarios[1]);
            expect(screen.getByRole("alert")).toHaveTextContent(
                "El usuario beto.operador fue eliminado correctamente.",
            );
        });

        expect(screen.queryByText("beto.operador")).not.toBeInTheDocument();
        expect(screen.getByTestId("dialog")).not.toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Cerrar snackbar" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });

    it("mantiene al usuario y muestra un error cuando onEliminar falla", async () => {
        const onEliminar = vi.fn().mockRejectedValue(new Error("Error de prueba"));

        renderLista({ onEliminar });

        abrirConfirmacionEliminacion("carla.productor");
        confirmarEliminacion();

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "Ocurrió un error al intentar eliminar a carla.productor.",
            );
        });

        expect(screen.getByRole("alert")).toHaveAttribute("data-severity", "error");
        expect(screen.getByText("carla.productor")).toBeInTheDocument();
        expect(screen.getByTestId("dialog")).not.toBeVisible();

        fireEvent.click(screen.getByRole("button", { name: "Cerrar snackbar" }));

        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
});