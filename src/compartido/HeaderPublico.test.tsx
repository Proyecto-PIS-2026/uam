import { render, screen, fireEvent, within } from "@testing-library/react";
import type { RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import { usePathname } from "next/navigation";
import estilos from "./HeaderPublico.module.css";
import HeaderPublico from "./HeaderPublico";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/image", () => ({
    default: ({
        alt,
        src,
        className,
    }: {
        alt?: string;
        src?: string;
        className?: string;
    }) => (
        <span role="img" aria-label={alt} data-src={src} className={className}/>
    ),
}));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (<a {...props}>{children}</a>) }));
vi.mock("@mui/icons-material/Menu", () => ({ default: () => <span data-testid="menu-icon"/> }));
vi.mock("@mui/icons-material/Close", () => ({ default: () => <span data-testid="close-icon"/> }));

const consultarRutaSimulada = vi.mocked(usePathname);

describe("HeaderPublico", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        consultarRutaSimulada.mockReturnValue("/inicio");
    });

    it("no ofrece cerrar sesion cuando no hay operador autenticado", () => {
        render(<HeaderPublico rolUsuario={null} />);

        expect(screen.queryByRole("button", { name: "Abrir menú de usuario" }))
            .not.toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Cerrar sesión" }))
            .not.toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "Iniciar sesión" })).toHaveLength(2);
    });

    it("cierra el desplegable al pulsar fuera del menu de usuario", () => {
        render(<HeaderPublico rolUsuario="OPERADOR" />);
        const botonMenu = screen.getByRole("button", { name: "Abrir menú de usuario" });
        fireEvent.click(botonMenu);

        fireEvent.pointerDown(document.body);

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        expect(botonMenu).toHaveAttribute("aria-expanded", "false");
    });

    it("conserva el desplegable abierto al pulsar dentro", () => {
        render(<HeaderPublico rolUsuario="PRODUCTOR" />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú de usuario" }));

        fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

        expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("permite cerrar y volver a abrir el desplegable con su boton", () => {
        render(<HeaderPublico rolUsuario="ADMINISTRADOR" />);
        const botonMenu = screen.getByRole("button", { name: "Abrir menú de usuario" });
        fireEvent.click(botonMenu);
        fireEvent.pointerDown(botonMenu);
        fireEvent.click(botonMenu);

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();

        fireEvent.click(botonMenu);
        expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("renderiza el logo y las opciones del menú", () => {
        render(<HeaderPublico rolUsuario={null} />);
        expect(screen.getByRole("img", { name: "Unidad Agroalimentaria Metropolitana" })).toHaveAttribute("data-src", "/Logo.PNG");
        expect(screen.getAllByRole("link", { name: "Inicio" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Publicaciones" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Operadores" })).toHaveLength(2);
        expect(screen.queryByRole("link", { name: "Mi mercado" })).not.toBeInTheDocument();
    });

    it.each([
        { rol: "OPERADOR" as const, ruta: "/mi-mercado" },
        { rol: "PRODUCTOR" as const, ruta: "/mi-mercado/productor" },
    ])("muestra Mi mercado de $rol en ambos menus principales", ({ rol, ruta }) => {
        render(<HeaderPublico rolUsuario={rol} />);

        const enlaces = screen.getAllByRole("link", { name: "Mi mercado" });
        expect(enlaces).toHaveLength(2);
        for (const enlace of enlaces) expect(enlace).toHaveAttribute("href", ruta);
        expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    });

    it.each([null, "ADMINISTRADOR"] as const)(
        "oculta Mi mercado para el rol %s",
        (rolUsuario) => {
            render(<HeaderPublico rolUsuario={rolUsuario} />);

            expect(screen.queryByRole("link", { name: "Mi mercado" })).not.toBeInTheDocument();
        },
    );

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as RolUsuario[])(
        "deja solo Cerrar sesion en el desplegable de %s",
        (rolUsuario) => {
            render(<HeaderPublico rolUsuario={rolUsuario} />);
            fireEvent.click(screen.getByRole("button", { name: "Abrir menú de usuario" }));

            const menuUsuario = within(screen.getByRole("menu"));
            expect(menuUsuario.getAllByRole("menuitem")).toHaveLength(1);
            expect(menuUsuario.getByRole("menuitem", { name: "Cerrar sesión" })).toBeInTheDocument();
            expect(menuUsuario.queryByRole("link")).not.toBeInTheDocument();
            expect(menuUsuario.queryByText("Mi perfil")).not.toBeInTheDocument();
            expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();
        },
    );

    it("marca Mi mercado como activo en la pagina del productor", () => {
        consultarRutaSimulada.mockReturnValue("/mi-mercado/productor");
        render(<HeaderPublico rolUsuario="PRODUCTOR" />);

        for (const enlace of screen.getAllByRole("link", { name: "Mi mercado" })) {
            expect(enlace).toHaveAttribute("aria-current", "page");
        }
    });

    it("marca como activa la opción correspondiente a la ruta actual", () => {
        consultarRutaSimulada.mockReturnValue("/publicaciones");
        render(<HeaderPublico rolUsuario={null} />);
        const enlacesPublicaciones = screen.getAllByRole("link", { name: "Publicaciones" });
        expect(enlacesPublicaciones[0]).toHaveClass(estilos.enlaceActivo);
        expect(enlacesPublicaciones[1]).not.toHaveClass(estilos.enlaceActivo);
    });

    it("marca Mi mercado como activo al entrar al operador indicado por nombre", () => {
        consultarRutaSimulada.mockReturnValue("/mi-mercado/Frutas%20del%20Norte");
        render(<HeaderPublico rolUsuario="OPERADOR" />);
        expect(screen.getAllByRole("link", { name: "Mi mercado" })[0]).toHaveAttribute("aria-current", "page");
    });

    it("no marca como activa ninguna opción cuando la ruta no coincide", () => {
        consultarRutaSimulada.mockReturnValue("/otra-ruta");
        render(<HeaderPublico rolUsuario={null} />);
        const enlaces = screen.getAllByRole("link");
        enlaces.forEach((enlace) => { expect(enlace).not.toHaveClass("enlaceActivo") });
    });

    it("inicialmente muestra el botón para abrir el menú", () => {
        render(<HeaderPublico rolUsuario={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("abre el menú móvil al hacer click", () => {
        render(<HeaderPublico rolUsuario={null} />);
        const boton = screen.getByRole("button", {  name: "Abrir menú" });
        fireEvent.click(boton);
        expect(screen.getByRole("button", {  name: "Cerrar menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "true");
    });

    it("cierra el menú móvil al volver a hacer click", () => {
        render(<HeaderPublico rolUsuario={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        const botonCerrar = screen.getByRole("button", { name: "Cerrar menú" });
        fireEvent.click(botonCerrar);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("cierra el menú móvil al seleccionar una opción", () => {
        render(<HeaderPublico rolUsuario={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        const enlacesPublicaciones = screen.getAllByRole("link", { name: "Publicaciones" });
        fireEvent.click(enlacesPublicaciones[1]);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("los enlaces tienen las rutas correspondientes", () => {
        render(<HeaderPublico rolUsuario={null} />);
        expect(screen.getAllByRole("link", { name: "Inicio" })[0]).toHaveAttribute("href", "/inicio");
        expect(screen.getAllByRole("link", { name: "Publicaciones" })[0]).toHaveAttribute("href", "/publicaciones");
        expect(screen.getAllByRole("link", { name: "Operadores" })[0]).toHaveAttribute("href", "/operadores");
        expect(screen.queryByRole("link", { name: "Mi mercado" })).not.toBeInTheDocument();
    });
    it("el menú móvil tiene el atributo aria-controls correspondiente", () => {
        render(<HeaderPublico rolUsuario={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).toHaveAttribute("aria-controls", "menu-mobile");
        expect(screen.getByRole("navigation", { name: "Navegación móvil" })).toHaveAttribute("id", "menu-mobile");
    });
    it("cierra el menú móvil al hacer click sobre el overlay", () => {
        const { container } = render(<HeaderPublico rolUsuario={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
        const overlay = container.querySelector(`.${estilos.overlayMenu}`);
        expect(overlay).toBeInTheDocument();
        fireEvent.mouseDown(overlay!);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });
});
