
import { act, fireEvent, render, screen } from "@testing-library/react";
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

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

// Permite simular la ejecución del snapshot de servidor y
// comprobar la rama en la que window no está disponible.
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

            const descriptor = Object.getOwnPropertyDescriptor(
                globalThis,
                "window",
            );

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
                    Object.defineProperty(
                        globalThis,
                        "window",
                        descriptor,
                    );
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
            estadisticas={
                <div data-testid="contenido-estadisticas">
                    Contenido estadísticas
                </div>
            }
            publicaciones={
                <div data-testid="contenido-publicaciones">
                    Contenido publicaciones
                </div>
            }
            usuarios={
                <div data-testid="contenido-usuarios">
                    Contenido usuarios
                </div>
            }
            publica={
                <div data-testid="contenido-publico">
                    Contenido público
                </div>
            }
        />,
    );
}

function obtenerBoton(etiqueta: string) {
    return screen.getByRole("button", {
        name: etiqueta,
    });
}

function comprobarPestanaActiva(etiqueta: string) {
    expect(obtenerBoton(etiqueta)).toHaveAttribute(
        "aria-pressed",
        "true",
    );

    for (const otraEtiqueta of [
        "Estadísticas",
        "Publicaciones",
        "Usuarios",
        "Público",
    ]) {
        if (otraEtiqueta !== etiqueta) {
            expect(obtenerBoton(otraEtiqueta)).toHaveAttribute(
                "aria-pressed",
                "false",
            );
        }
    }
}

describe("ContenedorConfiguracionGeneral", () => {
    beforeEach(() => {
        vi.clearAllMocks();

        mocks.simularVentanaNoDisponible = false;

        window.history.replaceState(
            {},
            "",
            "/administracion",
        );
    });

    afterEach(() => {
        mocks.simularVentanaNoDisponible = false;
        vi.restoreAllMocks();
    });

    it("muestra estadísticas por defecto y los cuatro botones en orden", () => {
        renderizarContenedor();

        const botones = screen.getAllByRole("button");

        expect(
            botones.map((boton) => boton.textContent),
        ).toEqual([
            "Estadísticas",
            "Publicaciones",
            "Usuarios",
            "Público",
        ]);

        comprobarPestanaActiva("Estadísticas");

        expect(
            screen.getByTestId("contenido-estadisticas"),
        ).toBeInTheDocument();

        expect(
            screen.queryByTestId("contenido-publicaciones"),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByTestId("contenido-usuarios"),
        ).not.toBeInTheDocument();

        expect(
            screen.queryByTestId("contenido-publico"),
        ).not.toBeInTheDocument();

        expect(
            screen.getByRole("group", {
                name: "Secciones de configuración",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("button", {
                name: "Estadísticas",
            }),
        ).toHaveAttribute(
            "aria-controls",
            "panel-configuracion",
        );

        expect(
            screen.getByRole("button", {
                name: "Publicaciones",
            }),
        ).toHaveAttribute(
            "aria-controls",
            "panel-configuracion",
        );

        expect(
            screen.getByRole("button", {
                name: "Usuarios",
            }),
        ).toHaveAttribute(
            "aria-controls",
            "panel-configuracion",
        );

        expect(
            screen.getByRole("button", {
                name: "Público",
            }),
        ).toHaveAttribute(
            "aria-controls",
            "panel-configuracion",
        );
    });

    it.each([
        [
            "estadisticas",
            "Estadísticas",
            "contenido-estadisticas",
        ],
        [
            "publicaciones",
            "Publicaciones",
            "contenido-publicaciones",
        ],
        [
            "usuarios",
            "Usuarios",
            "contenido-usuarios",
        ],
        [
            "publico",
            "Público",
            "contenido-publico",
        ],
    ] as const)(
        "selecciona la pestaña %s cuando la URL contiene su hash",
        (id, etiqueta, testId) => {
            window.history.replaceState(
                {},
                "",
                `/administracion#${id}`,
            );

            renderizarContenedor();

            comprobarPestanaActiva(etiqueta);

            expect(
                screen.getByTestId(testId),
            ).toBeInTheDocument();
        },
    );

    it("vuelve a estadísticas cuando el hash no corresponde a ninguna pestaña", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion#pestana-invalida",
        );

        renderizarContenedor();

        comprobarPestanaActiva("Estadísticas");

        expect(
            screen.getByTestId("contenido-estadisticas"),
        ).toBeInTheDocument();
    });

    it("conserva estadísticas cuando la URL no tiene hash", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion?origen=menu",
        );

        renderizarContenedor();

        comprobarPestanaActiva("Estadísticas");

        expect(
            screen.getByTestId("contenido-estadisticas"),
        ).toBeInTheDocument();
    });

    it("cambia la pestaña y navega conservando la ruta y los parámetros de búsqueda", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion?origen=menu#estadisticas",
        );

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        comprobarPestanaActiva("Usuarios");

        expect(
            screen.getByTestId("contenido-usuarios"),
        ).toBeInTheDocument();

        expect(mocks.routerPush).toHaveBeenCalledWith(
            "/administracion?origen=menu#usuarios",
            { scroll: false },
        );

        fireEvent.click(obtenerBoton("Público"));

        comprobarPestanaActiva("Público");

        expect(
            screen.getByTestId("contenido-publico"),
        ).toBeInTheDocument();

        expect(mocks.routerPush).toHaveBeenLastCalledWith(
            "/administracion?origen=menu#publico",
            { scroll: false },
        );

        fireEvent.click(obtenerBoton("Publicaciones"));

        comprobarPestanaActiva("Publicaciones");

        expect(
            screen.getByTestId("contenido-publicaciones"),
        ).toBeInTheDocument();

        expect(mocks.routerPush).toHaveBeenLastCalledWith(
            "/administracion?origen=menu#publicaciones",
            { scroll: false },
        );

        fireEvent.click(obtenerBoton("Estadísticas"));

        comprobarPestanaActiva("Estadísticas");

        expect(
            screen.getByTestId("contenido-estadisticas"),
        ).toBeInTheDocument();

        // El hash original ya apunta a estadísticas.
        expect(mocks.routerPush).toHaveBeenCalledTimes(3);
    });

    it("actualiza el contenido localmente aunque la navegación no modifique inmediatamente el hash", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion#estadisticas",
        );

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        expect(
            screen.getByTestId("contenido-usuarios"),
        ).toBeInTheDocument();

        comprobarPestanaActiva("Usuarios");

        // El mock del router no cambia window.location.hash.
        expect(window.location.hash).toBe("#estadisticas");
    });

    it("no navega si se pulsa la pestaña que ya corresponde al hash actual", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion#usuarios",
        );

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        comprobarPestanaActiva("Usuarios");

        expect(mocks.routerPush).not.toHaveBeenCalled();
    });

    it("sincroniza la pestaña cuando cambia el hash", () => {
        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        comprobarPestanaActiva("Usuarios");

        window.history.replaceState(
            {},
            "",
            "/administracion#publico",
        );

        act(() => {
            window.dispatchEvent(new Event("hashchange"));
        });

        comprobarPestanaActiva("Público");

        expect(
            screen.getByTestId("contenido-publico"),
        ).toBeInTheDocument();
    });

    it("sincroniza la pestaña al navegar atrás o adelante mediante popstate", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion#estadisticas",
        );

        renderizarContenedor();

        fireEvent.click(obtenerBoton("Usuarios"));

        comprobarPestanaActiva("Usuarios");

        window.history.replaceState(
            {},
            "",
            "/administracion#publicaciones",
        );

        act(() => {
            window.dispatchEvent(
                new PopStateEvent("popstate"),
            );
        });

        comprobarPestanaActiva("Publicaciones");

        expect(
            screen.getByTestId("contenido-publicaciones"),
        ).toBeInTheDocument();
    });

    it("sincroniza la pestaña a estadísticas cuando el hash cambia a uno inválido", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion#usuarios",
        );

        renderizarContenedor();

        comprobarPestanaActiva("Usuarios");

        window.history.replaceState(
            {},
            "",
            "/administracion#invalido",
        );

        act(() => {
            window.dispatchEvent(new Event("hashchange"));
        });

        comprobarPestanaActiva("Estadísticas");

        expect(
            screen.getByTestId("contenido-estadisticas"),
        ).toBeInTheDocument();
    });

    it("limpia las suscripciones al desmontarse", () => {
        const addEventListener = vi.spyOn(
            window,
            "addEventListener",
        );

        const removeEventListener = vi.spyOn(
            window,
            "removeEventListener",
        );

        const { unmount } = renderizarContenedor();

        const suscripciones = addEventListener.mock.calls.filter(
            ([evento]) =>
                evento === "hashchange" || evento === "popstate",
        );

        expect(suscripciones.length).toBeGreaterThan(0);

        unmount();

        for (const [evento, callback] of suscripciones) {
            expect(removeEventListener).toHaveBeenCalledWith(
                evento,
                callback,
            );
        };
    });

    it("utiliza el snapshot de servidor cuando window no está disponible", () => {
        window.history.replaceState(
            {},
            "",
            "/administracion#usuarios",
        );

        mocks.simularVentanaNoDisponible = true;

        renderizarContenedor();

        mocks.simularVentanaNoDisponible = false;

        comprobarPestanaActiva("Estadísticas");

        expect(
            screen.getByTestId("contenido-estadisticas"),
        ).toBeInTheDocument();
    });
});
