import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ContenedorConfiguracionGeneral from "./ContenedorConfiguracionGeneral";

const mocks = vi.hoisted(() => ({
    routerPush: vi.fn(),
    simularVentanaNoDisponible: false,
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({
        push: mocks.routerPush,
    }),
}));

// Permite probar la rama de SSR sin una ventana disponible.
vi.mock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();

    return {
        ...actual,
        useSyncExternalStore: (
            subscribe: (callback: () => void) => () => void,
            getSnapshot: () => string,
            getServerSnapshot: () => string,
        ) => {
            if (!mocks.simularVentanaNoDisponible) {
                return actual.useSyncExternalStore(
                    subscribe,
                    getSnapshot,
                    getServerSnapshot,
                );
            }

            const descriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

            try {
                Object.defineProperty(globalThis, "window", {
                    configurable: true,
                    enumerable: true,
                    writable: true,
                    value: undefined,
                });

                const desuscribir = subscribe(() => {});
                desuscribir();
            } finally {
                if (descriptor) {
                    Object.defineProperty(globalThis, "window", descriptor);
                } else {
                    Reflect.deleteProperty(globalThis, "window");
                }
            }

            return getServerSnapshot();
        },
    };
});

function renderizarContenedor() {
    return render(
        <ContenedorConfiguracionGeneral
            publicaciones={<div data-testid="contenido-publicaciones">Contenido publicaciones</div>}
            usuarios={<div data-testid="contenido-usuarios">Contenido usuarios</div>}
            publica={<div data-testid="contenido-publico">Contenido público</div>}
        />,
    );
}

function obtenerBoton(etiqueta: string) {
    return screen.getByRole("button", { name: etiqueta });
}

function comprobarPestanaActiva(etiqueta: string) {
    expect(obtenerBoton(etiqueta)).toHaveAttribute("aria-pressed", "true");
}

describe("ContenedorConfiguracionGeneral", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.simularVentanaNoDisponible = false;
        window.history.replaceState({}, "", "/administracion");
    });

    it("muestra publicaciones por defecto y los tres botones en orden", () => {
        renderizarContenedor();

        const botones = screen.getAllByRole("button");

        expect(botones.map((boton) => boton.textContent)).toEqual([
            "Publicaciones",
            "Usuarios",
            "Público",
        ]);

        comprobarPestanaActiva("Publicaciones");

        expect(screen.getByTestId("contenido-publicaciones")).toBeInTheDocument();
        expect(screen.queryByTestId("contenido-usuarios")).not.toBeInTheDocument();
        expect(screen.queryByTestId("contenido-publico")).not.toBeInTheDocument();

        expect(screen.getByRole("group", {
            name: "Secciones de configuración",
        })).toBeInTheDocument();
    });

    it("selecciona usuarios cuando la URL contiene #usuarios", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");

        renderizarContenedor();

        comprobarPestanaActiva("Usuarios");
        expect(screen.getByTestId("contenido-usuarios")).toBeInTheDocument();
        expect(screen.queryByTestId("contenido-publicaciones")).not.toBeInTheDocument();
    });

    it("selecciona público cuando la URL contiene #publico", () => {
        window.history.replaceState({}, "", "/administracion#publico");

        renderizarContenedor();

        comprobarPestanaActiva("Público");
        expect(screen.getByTestId("contenido-publico")).toBeInTheDocument();
    });

    it("vuelve a publicaciones cuando el hash no corresponde a ninguna pestaña", () => {
        window.history.replaceState({}, "", "/administracion#pestana-invalida");

        renderizarContenedor();

        comprobarPestanaActiva("Publicaciones");
        expect(screen.getByTestId("contenido-publicaciones")).toBeInTheDocument();
    });

    it("cambia la pestaña y navega conservando la ruta y los parámetros de búsqueda", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion?origen=menu#publicaciones",
        );

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        comprobarPestanaActiva("Usuarios");
        expect(screen.getByTestId("contenido-usuarios")).toBeInTheDocument();
        expect(mocks.routerPush).toHaveBeenCalledWith(
            "/administracion?origen=menu#usuarios",
            { scroll: false },
        );

        fireEvent.click(obtenerBoton("Público"));

        comprobarPestanaActiva("Público");
        expect(screen.getByTestId("contenido-publico")).toBeInTheDocument();
        expect(mocks.routerPush).toHaveBeenLastCalledWith(
            "/administracion?origen=menu#publico",
            { scroll: false },
        );

        fireEvent.click(obtenerBoton("Publicaciones"));

        comprobarPestanaActiva("Publicaciones");
        expect(screen.getByTestId("contenido-publicaciones")).toBeInTheDocument();
    });

    it("no navega si se pulsa la pestaña que ya corresponde al hash actual", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        comprobarPestanaActiva("Usuarios");
        expect(mocks.routerPush).not.toHaveBeenCalled();
    });

    it("sincroniza la pestaña cuando cambia el hash", () => {
        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));
        comprobarPestanaActiva("Usuarios");

        window.history.replaceState({}, "", "/administracion#publico");

        act(() => {
            window.dispatchEvent(new Event("hashchange"));
        });

        comprobarPestanaActiva("Público");
        expect(screen.getByTestId("contenido-publico")).toBeInTheDocument();
    });

    it("sincroniza la pestaña al navegar atrás o adelante mediante popstate", () => {
        window.history.replaceState({}, "", "/administracion#publicaciones");

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));
        comprobarPestanaActiva("Usuarios");

        window.history.replaceState({}, "", "/administracion#publicaciones");

        act(() => {
            window.dispatchEvent(new PopStateEvent("popstate"));
        });

        comprobarPestanaActiva("Publicaciones");
        expect(screen.getByTestId("contenido-publicaciones")).toBeInTheDocument();
    });

    it("limpia las suscripciones al desmontarse", () => {
        const removeEventListener = vi.spyOn(window, "removeEventListener");

        const { unmount } = renderizarContenedor();

        unmount();

        expect(removeEventListener).toHaveBeenCalledWith(
            "hashchange",
            expect.any(Function),
        );
        expect(removeEventListener).toHaveBeenCalledWith(
            "popstate",
            expect.any(Function),
        );

        removeEventListener.mockRestore();
    });

    it("utiliza el snapshot de servidor cuando window no está disponible", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        mocks.simularVentanaNoDisponible = true;

        renderizarContenedor();

        mocks.simularVentanaNoDisponible = false;

        comprobarPestanaActiva("Publicaciones");
        expect(screen.getByTestId("contenido-publicaciones")).toBeInTheDocument();
    });
});