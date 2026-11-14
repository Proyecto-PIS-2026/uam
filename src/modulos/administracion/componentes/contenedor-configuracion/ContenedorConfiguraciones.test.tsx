import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ContenedorConfiguraciones from "./ContenedorConfiguraciones";

const mocks = vi.hoisted(() => ({
    push: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push }),
}));

const paneles = [
    { id: "estadisticas", nombre: "Estadísticas", contenido: "Contenido estadísticas" },
    { id: "usuarios", nombre: "Usuarios", contenido: "Contenido usuarios" },
    { id: "general", nombre: "General", contenido: "Contenido general" },
    { id: "catalogos", nombre: "Catálogos", contenido: "Contenido catálogos" },
] as const;

function preparar() {
    return render(
        <ContenedorConfiguraciones
            estadisticas={<div>Contenido estadísticas</div>}
            usuarios={<div>Contenido usuarios</div>}
            general={<div>Contenido general</div>}
            catalogos={<div>Contenido catálogos</div>}
        />,
    );
}

function comprobarPestana(nombre: typeof paneles[number]["nombre"]) {
    for (const panel of paneles) {
        expect(screen.getByRole("button", { name: panel.nombre })).toHaveAttribute("aria-pressed", String(panel.nombre === nombre));

        if (panel.nombre === nombre) {
            expect(screen.getByText(panel.contenido)).toBeInTheDocument();
        } else {
            expect(screen.queryByText(panel.contenido)).not.toBeInTheDocument();
        }
    }
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
    it("muestra las pestañas en el orden Estadísticas, Usuarios, General y Catálogos", () => {
        preparar();
        const grupo = screen.getByRole("group", { name: "Secciones de configuración" });
        expect(within(grupo).getAllByRole("button").map((boton) => boton.textContent)).toEqual(["Estadísticas", "Usuarios", "General", "Catálogos"]);
    });

    it("muestra Estadísticas inicialmente cuando la URL no tiene hash", () => {
        preparar();
        comprobarPestana("Estadísticas");
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it.each(paneles)("muestra $nombre cuando la URL inicial tiene su hash", ({ id, nombre }) => {
        window.history.replaceState({}, "", `/administracion#${id}`);
        preparar();
        comprobarPestana(nombre);
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("usa Estadísticas si el hash inicial es desconocido", () => {
        window.history.replaceState({}, "", "/administracion#inexistente");
        preparar();
        comprobarPestana("Estadísticas");
    });

    it.each([
        { id: "usuarios", nombre: "Usuarios" },
        { id: "general", nombre: "General" },
        { id: "catalogos", nombre: "Catálogos" },
    ] as const)("cambia inmediatamente a $nombre y solicita actualizar la URL", ({ id, nombre }) => {
        preparar();
        fireEvent.click(screen.getByRole("button", { name: nombre }));
        comprobarPestana(nombre);
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith(`/administracion#${id}`, { scroll: false });
    });

    it("permite volver a Estadísticas desde Usuarios", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "Estadísticas" }));
        comprobarPestana("Estadísticas");
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/administracion#estadisticas", { scroll: false });
    });

    it("permite cambiar de Usuarios a General", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "General" }));
        comprobarPestana("General");
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/administracion#general", { scroll: false });
    });

    it("conserva los parámetros de consulta al cambiar de pestaña", () => {
        window.history.replaceState({}, "", "/administracion?origen=panel#general");
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));
        expect(mocks.push).toHaveBeenCalledExactlyOnceWith("/administracion?origen=panel#usuarios", { scroll: false });
    });

    it.each(paneles)("no solicita navegar si la URL ya corresponde a $nombre", ({ id, nombre }) => {
        window.history.replaceState({}, "", `/administracion#${id}`);
        preparar();
        fireEvent.click(screen.getByRole("button", { name: nombre }));
        comprobarPestana(nombre);
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("sincroniza la selección cuando cambia el hash", () => {
        preparar();
        navegar("/administracion#usuarios", "hashchange");
        comprobarPestana("Usuarios");
        navegar("/administracion#general", "hashchange");
        comprobarPestana("General");
        navegar("/administracion#estadisticas", "hashchange");
        comprobarPestana("Estadísticas");
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it("sincroniza la selección al navegar por el historial", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();
        navegar("/administracion#general", "popstate");
        comprobarPestana("General");
        navegar("/administracion#estadisticas", "popstate");
        comprobarPestana("Estadísticas");
        navegar("/administracion#usuarios", "popstate");
        comprobarPestana("Usuarios");
        expect(mocks.push).not.toHaveBeenCalled();
    });

    it.each(["hashchange", "popstate"] as const)("permite que un evento %s reemplace una selección local", (evento) => {
        preparar();
        fireEvent.click(screen.getByRole("button", { name: "Usuarios" }));
        comprobarPestana("Usuarios");
        navegar("/administracion#general", evento);
        comprobarPestana("General");
    });

    it("vuelve a Estadísticas cuando se elimina el hash", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();
        navegar("/administracion", "hashchange");
        comprobarPestana("Estadísticas");
    });

    it("usa Estadísticas cuando la navegación introduce un hash desconocido", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        preparar();
        navegar("/administracion#desconocido", "popstate");
        comprobarPestana("Estadísticas");
    });

    it("relaciona los botones con el panel de contenido", () => {
        const { container } = preparar();
        expect(screen.getByRole("group", { name: "Secciones de configuración" })).toBeInTheDocument();
        for (const panel of paneles) {
            expect(screen.getByRole("button", { name: panel.nombre })).toHaveAttribute("aria-controls", "panel-configuracion");
        }
        expect(container.querySelector("#panel-configuracion")).toHaveTextContent("Contenido estadísticas");
    });

    it("renderiza Estadísticas en el servidor independientemente del hash del navegador", () => {
        window.history.replaceState({}, "", "/administracion#usuarios");
        const html = renderToString(
            <ContenedorConfiguraciones
                estadisticas={<div>Contenido estadísticas</div>}
                usuarios={<div>Contenido usuarios</div>}
                general={<div>Contenido general</div>}
                catalogos={<div>Contenido catálogos</div>}
            />,
        );
        expect(html).toContain("Contenido estadísticas");
        expect(html).not.toContain("Contenido usuarios");
        expect(html).not.toContain("Contenido general");
        expect(html).not.toContain("Contenido catálogos");
    });
});
