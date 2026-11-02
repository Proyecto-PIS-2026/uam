import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContenedorConfiguraciones from "./ContenedorConfiguraciones";

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push }),
}));

function preparar() {
    return render(
        <ContenedorConfiguraciones
            general={<div>Contenido general</div>}
            usuarios={<div>Contenido usuarios</div>}
        />,
    );
}

function comprobarPestana(nombre: "General" | "Usuarios") {
    const otra = nombre === "General" ? "Usuarios" : "General";
    expect(screen.getByRole("button", { name: nombre })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: otra })).toHaveAttribute("aria-pressed", "false");
}

function navegar(url: string, evento: "hashchange" | "popstate") {
    act(() => {
        window.history.replaceState({}, "", url);
        window.dispatchEvent(new Event(evento));
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/administracion");
});

afterEach(() => {
    cleanup();
    window.history.replaceState({}, "", "/");
});

describe("ContenedorConfiguraciones", () => {
    it("muestra General inicialmente cuando la URL no tiene hash", () => {
        preparar();
        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
        expect(screen.queryByText("Contenido usuarios")).not.toBeInTheDocument();
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("muestra Usuarios cuando la URL inicial tiene su hash", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();

        comprobarPestana("Usuarios");
        expect(screen.getByText("Contenido usuarios")).toBeInTheDocument();
        expect(screen.queryByText("Contenido general")).not.toBeInTheDocument();
    });

    it("usa General si el hash inicial es desconocido", () => {
        window.history.replaceState({}, "", "/administracion#inexistente");
        preparar();

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
    });

    it("cambia inmediatamente a Usuarios y solicita actualizar la URL", () => {
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));

        comprobarPestana("Usuarios");
        expect(screen.getByText("Contenido usuarios")).toBeInTheDocument();
        expect(screen.queryByText("Contenido general")).not.toBeInTheDocument();
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/administracion#usuarios", { scroll: false });
    });

    it("permite volver a General desde Usuarios", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();

        fireEvent.click(screen.getByRole("button", { name: "General" }));

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/administracion#general", { scroll: false });
    });

    it("conserva los parámetros de consulta al cambiar de pestaña", () => {
        window.history.replaceState({}, "", "/administracion?origen=panel#general");
        preparar();

        fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));

        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/administracion?origen=panel#usuarios", { scroll: false });
    });

    it("no solicita navegar si la URL ya corresponde a la pestaña seleccionada", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();

        fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));

        comprobarPestana("Usuarios");
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("sincroniza la selección cuando cambia el hash", () => {
        preparar();

        navegar("/administracion#usuarios", "hashchange");

        comprobarPestana("Usuarios");
        expect(screen.getByText("Contenido usuarios")).toBeInTheDocument();

        navegar("/administracion#general", "hashchange");

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("sincroniza la selección al navegar por el historial", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();

        navegar("/administracion#general", "popstate");

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();

        navegar("/administracion#usuarios", "popstate");

        comprobarPestana("Usuarios");
        expect(screen.getByText("Contenido usuarios")).toBeInTheDocument();
    });

    it("permite que un cambio de URL reemplace una selección local", () => {
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));
        comprobarPestana("Usuarios");

        navegar("/administracion#general", "hashchange");

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
    });

    it("vuelve a General cuando se elimina el hash", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();

        navegar("/administracion", "hashchange");

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
    });

    it("usa General cuando la navegación introduce un hash desconocido", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();

        navegar("/administracion#desconocido", "popstate");

        comprobarPestana("General");
        expect(screen.getByText("Contenido general")).toBeInTheDocument();
    });

    it("relaciona los botones con el panel de contenido", () => {
        const { container } = preparar();
        expect(screen.getByRole("group", { name: "Secciones de configuración" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "General" })).toHaveAttribute("aria-controls", "panel-configuracion");
        expect(screen.getByRole("button", { name: "Usuarios" })).toHaveAttribute("aria-controls", "panel-configuracion");
        expect(container.querySelector("#panel-configuracion")).toHaveTextContent("Contenido general");
    });

    it("renderiza General en el servidor independientemente del hash del navegador", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");

        const html = renderToString(
            <ContenedorConfiguraciones
                general={<div>Contenido general</div>}
                usuarios={<div>Contenido usuarios</div>}
            />,
        );

        expect(html).toContain("Contenido general");
        expect(html).not.toContain("Contenido usuarios");
    });
});