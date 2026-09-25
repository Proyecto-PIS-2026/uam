import { render, screen, fireEvent } from "@testing-library/react";
import { usePathname } from "next/navigation";
import styles from "./HeaderPublico.module.css";
import HeaderPublico from "./HeaderPublico";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/image", () => ({ default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (<img {...props}/>) }));
vi.mock("next/link", () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (<a {...props}>{children}</a>) }));
vi.mock("@mui/icons-material/Menu", () => ({ default: () => <span data-testid="menu-icon"/> }));
vi.mock("@mui/icons-material/Close", () => ({ default: () => <span data-testid="close-icon"/> }));

const mockUsePathname = vi.mocked(usePathname);

describe("HeaderPublico", () => {
    beforeEach(() => { mockUsePathname.mockReturnValue("/inicio") });

    it("renderiza el logo y las opciones del menú", () => {
        render(<HeaderPublico/>);
        expect(screen.getByAltText("Unidad Agroalimentaria Metropolitana")).toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "Inicio" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Catálogo" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Listado de operadores" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Perfil público de operador" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Mi mercado" })).toHaveLength(2);
    });

    it("marca como activa la opción correspondiente a la ruta actual", () => {
        mockUsePathname.mockReturnValue("/publicaciones");
        render(<HeaderPublico/>);
        const enlacesCatalogo = screen.getAllByRole("link", { name: "Catálogo" });
        expect(enlacesCatalogo[0]).toHaveClass(styles.enlaceActivo);
        expect(enlacesCatalogo[1]).not.toHaveClass(styles.enlaceActivo);
    });

    it("no marca como activa ninguna opción cuando la ruta no coincide", () => {
        mockUsePathname.mockReturnValue("/otra-ruta");
        render(<HeaderPublico/>);
        const enlaces = screen.getAllByRole("link");
        enlaces.forEach((enlace) => { expect(enlace).not.toHaveClass("enlaceActivo") });
    });

    it("inicialmente muestra el botón para abrir el menú", () => {
        render(<HeaderPublico/>);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("abre el menú móvil al hacer click", () => {
        render(<HeaderPublico />);
        const boton = screen.getByRole("button", {  name: "Abrir menú" });
        fireEvent.click(boton);
        expect(screen.getByRole("button", {  name: "Cerrar menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "true");
    });

    it("cierra el menú móvil al volver a hacer click", () => {
        render(<HeaderPublico/>);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        const botonCerrar = screen.getByRole("button", { name: "Cerrar menú" });
        fireEvent.click(botonCerrar);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("cierra el menú móvil al seleccionar una opción", () => {
        render(<HeaderPublico/>);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        const enlacesCatalogo = screen.getAllByRole("link", { name: "Catálogo" });
        fireEvent.click(enlacesCatalogo[1]);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("los enlaces tienen las rutas correspondientes", () => {
        render(<HeaderPublico/>);
        expect(screen.getAllByRole("link", { name: "Inicio" })[0]).toHaveAttribute("href", "/inicio");
        expect(screen.getAllByRole("link", { name: "Catálogo" })[0]).toHaveAttribute("href", "/publicaciones");
        expect(screen.getAllByRole("link", { name: "Listado de operadores" })[0]).toHaveAttribute("href", "/operadores");
        expect(screen.getAllByRole("link", { name: "Perfil público de operador" })[0]).toHaveAttribute("href", "/operadores/1");
        expect(screen.getAllByRole("link", { name: "Mi mercado" })[0]).toHaveAttribute("href", "/COMPLETAR-RUTA-MI-MERCADO");
    });

    it("el menú móvil tiene el atributo aria-controls correspondiente", () => {
        render(<HeaderPublico/>);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).toHaveAttribute("aria-controls", "menu-mobile");
        expect(screen.getByRole("navigation", { name: "Navegación móvil" })).toHaveAttribute("id", "menu-mobile");
    });
});