
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { createElement } from "react";
import type { RolUsuario } from "@/modulos/identidad-acceso/autenticacion/sesiones";
import * as autorizacion from "@/modulos/identidad-acceso/autorizacion/permisos";
import { usePathname } from "next/navigation";
import estilos from "./HeaderPublico.module.css";
import HeaderPublico from "./HeaderPublico";
import { cerrarSesionYVolverAlInicio } from "@/modulos/identidad-acceso/autenticacion/accionCerrarSesion";
import { useContadorNotificaciones } from "@/modulos/notificaciones/use-contador-notificaciones";

vi.mock("@/modulos/notificaciones/use-contador-notificaciones", () => ({ useContadorNotificaciones: vi.fn() }));

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));
vi.mock("next/image", () => ({
    default: ({
        alt,
        src,
        className,
        onError,
    }: {
        alt?: string;
        src?: string;
        className?: string;
        onError?: () => void;
    }) => createElement("img", { role: "img", alt: alt ?? "", "data-src": src, className, onError }),
}));
vi.mock("next/link", () => ({
    default: ({
        children,
        onClick,
        ...props
    }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a
            {...props}
            onClick={(evento) => {
                evento.preventDefault();
                onClick?.(evento);
            }}
        >
            {children}
        </a>
    ),
}));
vi.mock("@mui/icons-material/Menu", () => ({ default: () => <span data-testid="menu-icon"/> }));
vi.mock("@mui/icons-material/Close", () => ({ default: () => <span data-testid="close-icon"/> }));
vi.mock("@/modulos/identidad-acceso/autenticacion/accionCerrarSesion", () => ({
    cerrarSesionYVolverAlInicio: vi.fn(),
}));

const consultarRutaSimulada = vi.mocked(usePathname);
const cerrarSesionSimulada = vi.mocked(cerrarSesionYVolverAlInicio);

function obtenerOrdenDirecto(navegacion: HTMLElement) {
    return Array.from(navegacion.children).map((elemento) => {
        if (elemento instanceof HTMLAnchorElement) {
            const ruta = elemento.getAttribute("href");
            if (ruta === "/notificaciones") return "Notificaciones";
            if (ruta?.startsWith("/mi-perfil")) return "Mi perfil";
            return elemento.textContent?.trim() ?? "";
        }
        return elemento.querySelector(":scope > button")?.textContent?.trim() ?? "";
    }).filter((nombre): nombre is string => nombre.length > 0);
}

describe("HeaderPublico", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useContadorNotificaciones).mockReturnValue({ noLeidas: 0, refrescar: vi.fn() });
        consultarRutaSimulada.mockReturnValue("/inicio");
    });

    it("no ofrece cerrar sesion cuando no hay operador autenticado", () => {
        render(<HeaderPublico sesion={null} />);

        expect(screen.queryByRole("button", { name: "Abrir menú de usuario" }))
            .not.toBeInTheDocument();
        expect(screen.queryByRole("menuitem", { name: "Cerrar sesión" }))
            .not.toBeInTheDocument();
        expect(screen.getAllByRole("link", { name: "Iniciar sesión" })).toHaveLength(2);
    });

    it.each([null, "OPERADOR", "PRODUCTOR"] as const)(
        "oculta Administración en ambos menús para el rol %s",
        (rolUsuario) => {
            render(<HeaderPublico sesion={rolUsuario ? { usuarioId: 10, rol: rolUsuario, expiraEn: 2000000000 } : null} />);
            expect(screen.queryByRole("link", { name: "Administración" })).not.toBeInTheDocument();
        },
    );

    it.each([
        { rol: "OPERADOR", ruta: "/mi-perfil" },
        { rol: "PRODUCTOR", ruta: "/mi-perfil/productor" },
    ] as const)("muestra la foto o las iniciales del $rol en los menús de escritorio y móvil", ({ rol, ruta }) => {
        const fotoPerfil = "/api/imagenes/foto-perfil";
        const sesion = { usuarioId: 10, rol, expiraEn: 2000000000 };
        const vista = render(<HeaderPublico sesion={sesion} fotoPerfil={fotoPerfil} nombrePerfil="Huerta Sur Mercado" />);

        expect(within(screen.getByRole("button", { name: "Abrir menú de usuario" }))
            .getByRole("img", { name: "Foto de perfil" })).toHaveAttribute("data-src", fotoPerfil);

        fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
        const enlacePerfil = within(screen.getByRole("navigation", { name: "Navegación móvil" }))
            .getByRole("link", { name: "Mi perfil" });
        expect(enlacePerfil).toHaveAttribute("href", ruta);
        expect(within(enlacePerfil).getByRole("img", { name: "" })).toHaveAttribute("data-src", fotoPerfil);

        fireEvent.error(within(enlacePerfil).getByRole("img", { name: "" }));
        expect(within(screen.getByRole("button", { name: "Abrir menú de usuario" })).getByText("HS")).toBeInTheDocument();
        expect(within(enlacePerfil).getByText("HS")).toBeInTheDocument();

        vista.rerender(<HeaderPublico sesion={sesion} nombrePerfil="  álamo   del  sur  " />);
        expect(within(screen.getByRole("button", { name: "Abrir menú de usuario" })).getByText("ÁD")).toBeInTheDocument();
        expect(within(enlacePerfil).getByText("ÁD")).toBeInTheDocument();
    });

    it("ofrece la ruta real de Administración al administrador en ambos menús", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        const enlaces = screen.getAllByRole("link", { name: "Administración" });
        expect(enlaces).toHaveLength(2);
        for (const enlace of enlaces) expect(enlace).toHaveAttribute("href", "/administracion");
        for (const nombre of ["Navegación principal", "Navegación móvil"]) {
            expect(within(screen.getByRole("navigation", { name: nombre })).getByRole("link", { name: "Histórico de precios" }))
                .toHaveAttribute("href", "/precios-historicos");
        }
    });

    it("ordena las opciones del administrador y coloca Administración antes de Notificaciones en el hamburger", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);

        const navegacionPrincipal = screen.getByRole("navigation", { name: "Navegación principal" });
        expect(obtenerOrdenDirecto(navegacionPrincipal)).toEqual([
            "Inicio",
            "Mercados",
            "Usuarios",
            "Precios de referencia",
            "Histórico de precios",
            "Administración",
        ]);

        fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

        const navegacionMobile = screen.getByRole("navigation", { name: "Navegación móvil" });
        expect(obtenerOrdenDirecto(navegacionMobile)).toEqual([
            "Inicio",
            "Mercados",
            "Usuarios",
            "Precios de referencia",
            "Histórico de precios",
            "Administración",
            "Notificaciones",
            "Mi perfil",
            "Cerrar sesión",
        ]);
    });

    it("cierra el desplegable al pulsar fuera del menu de usuario", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 }} />);
        const botonMenu = screen.getByRole("button", { name: "Abrir menú de usuario" });
        fireEvent.click(botonMenu);

        fireEvent.pointerDown(document.body);

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        expect(botonMenu).toHaveAttribute("aria-expanded", "false");
    });

    it("conserva el desplegable abierto al pulsar dentro", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú de usuario" }));

        fireEvent.pointerDown(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

        expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("permite cerrar y volver a abrir el desplegable con su boton", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        const botonMenu = screen.getByRole("button", { name: "Abrir menú de usuario" });
        fireEvent.click(botonMenu);
        fireEvent.pointerDown(botonMenu);
        fireEvent.click(botonMenu);

        expect(screen.queryByRole("menu")).not.toBeInTheDocument();

        fireEvent.click(botonMenu);
        expect(screen.getByRole("menu")).toBeInTheDocument();
    });

    it("renderiza el logo y las opciones del menú", () => {
        render(<HeaderPublico sesion={null} />);
        expect(screen.getByRole("img", { name: "Unidad Agroalimentaria Metropolitana" })).toHaveAttribute("data-src", "/Logo.PNG");
        expect(screen.getAllByRole("link", { name: "Inicio" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Mercado Virtual" })).toHaveLength(2);
        expect(screen.getAllByRole("link", { name: "Operadores" })).toHaveLength(2);
        expect(screen.queryByRole("link", { name: "Mi mercado" })).not.toBeInTheDocument();
    });

    it("ofrece Mercado Producción, Mi mercado, Precios de referencia e Histórico al operador en ambos menús", () => {
        consultarRutaSimulada.mockReturnValue("/mi-mercado");
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 }} />);

        for (const nombre of ["Navegación principal", "Navegación móvil"]) {
            const menu = within(screen.getByRole("navigation", { name: nombre }));
            expect(menu.getAllByRole("link")).toHaveLength(nombre === "Navegación móvil" ? 7 : 5);
            expect(menu.getByRole("link", { name: "Productores" })).toHaveAttribute("href", "/productores");
            expect(menu.getByRole("link", { name: "Mercado Producción" })).toHaveAttribute("href", "/publicaciones-productor");
            expect(menu.getByRole("link", { name: "Mi mercado" })).toHaveAttribute("href", "/mi-mercado");
            expect(menu.getByRole("link", { name: "Precios de referencia" })).toHaveAttribute("href", "/precios-referencia");
            expect(menu.getByRole("link", { name: "Histórico de precios" })).toHaveAttribute("href", "/precios-historicos");

            for (const opcion of ["Inicio", "Operadores"]) {
                expect(menu.queryByRole("link", { name: opcion })).not.toBeInTheDocument();
            }
        }

        expect(screen.getByRole("link", { name: "Ir a Mi mercado" })).toHaveAttribute("href", "/mi-mercado");
        expect(screen.queryByRole("link", { name: "Ir al inicio" })).not.toBeInTheDocument();
    });

    it("conserva la navegación pública y el destino del logo sin sesión", () => {
        render(<HeaderPublico sesion={null} />);

        for (const nombre of ["Navegación principal", "Navegación móvil"]) {
            const menu = within(screen.getByRole("navigation", { name: nombre }));
            expect(menu.getByRole("link", { name: "Inicio" })).toHaveAttribute("href", "/inicio");
            expect(menu.getByRole("link", { name: "Mercado Virtual" })).toHaveAttribute("href", "/publicaciones");
            expect(menu.getByRole("link", { name: "Operadores" })).toHaveAttribute("href", "/operadores");
            expect(menu.getByRole("link", { name: "Histórico de precios" })).toHaveAttribute("href", "/precios-historicos");
            expect(menu.queryByRole("link", { name: "Productores" })).not.toBeInTheDocument();
        }
        expect(screen.getByRole("link", { name: "Ir al inicio" })).toHaveAttribute("href", "/inicio");
    });

    it("ofrece navegación de mercado, perfil propio y notificaciones al productor", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

        for (const nombre of ["Navegación principal", "Navegación móvil"]) {
            const menu = within(screen.getByRole("navigation", { name: nombre }));
            expect(menu.getAllByRole("link")).toHaveLength(nombre === "Navegación móvil" ? 5 : 3);
            expect(menu.getByRole("link", { name: "Mi mercado" })).toHaveAttribute("href", "/mi-mercado/productor");
            expect(menu.getByRole("link", { name: "Precios de referencia" })).toHaveAttribute("href", "/precios-referencia");
            expect(menu.getByRole("link", { name: "Histórico de precios" })).toHaveAttribute("href", "/precios-historicos");
        }
        expect(screen.getByRole("link", { name: "Ir a Mi mercado" })).toHaveAttribute("href", "/mi-mercado/productor");
        expect(screen.queryByRole("link", { name: "Ir al inicio" })).not.toBeInTheDocument();

        fireEvent.click(within(screen.getByRole("navigation", { name: "Navegación móvil" })).getByRole("link", { name: "Histórico de precios" }));
        expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
    });

    it.each([
        { rol: "OPERADOR" as const, ruta: "/mi-mercado" },
        { rol: "PRODUCTOR" as const, ruta: "/mi-mercado/productor" },
    ])("muestra Mi mercado de $rol en ambos menus principales", ({ rol, ruta }) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol, expiraEn: 2000000000 }} />);

        const enlaces = screen.getAllByRole("link", { name: "Mi mercado" });
        expect(enlaces).toHaveLength(2);
        for (const enlace of enlaces) expect(enlace).toHaveAttribute("href", ruta);
        expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();
    });

    it.each([null, "ADMINISTRADOR"] as const)(
        "oculta Mi mercado para el rol %s",
        (rolUsuario) => {
            render(<HeaderPublico sesion={rolUsuario ? { usuarioId: 10, rol: rolUsuario, expiraEn: 2000000000 } : null} />);

            expect(screen.queryByRole("link", { name: "Mi mercado" })).not.toBeInTheDocument();
        },
    );

    it.each(["OPERADOR", "ADMINISTRADOR"] as RolUsuario[])(
        "muestra Mi perfil y Cerrar sesion con sus iconos en el desplegable de %s",
        (rolUsuario) => {
            render(<HeaderPublico sesion={{ usuarioId: 10, rol: rolUsuario, expiraEn: 2000000000 }} />);
            fireEvent.click(screen.getByRole("button", { name: "Abrir menú de usuario" }));

            const menuUsuario = within(screen.getByRole("menu"));
            expect(menuUsuario.getAllByRole("menuitem")).toHaveLength(3);

            const perfil = menuUsuario.getByRole("menuitem", { name: "Mi perfil" });
            expect(perfil).toHaveAttribute("href", "/mi-perfil");
            expect(perfil.tagName).toBe("A");
            expect(perfil.querySelector("svg")).not.toBeNull();

            expect(within(screen.getByRole("navigation", { name: "Navegación móvil" })).getByRole("link", { name: "Mi perfil" })).toHaveAttribute("href", "/mi-perfil");

            const notificaciones = menuUsuario.getByRole("menuitem", { name: "Notificaciones" });
            expect(notificaciones).toHaveAttribute("href", "/notificaciones");
            expect(notificaciones.tagName).toBe("A");

            const cerrarSesion = menuUsuario.getByRole("menuitem", { name: "Cerrar sesión" });
            expect(cerrarSesion).toBeInTheDocument();
            expect(cerrarSesion.tagName).toBe("BUTTON");
            expect(cerrarSesion.querySelector("svg")).not.toBeNull();
            expect(screen.queryByRole("link", { name: "Iniciar sesión" })).not.toBeInTheDocument();
        },
    );

    it("permite al productor abrir su perfil y cerrar sesión en escritorio y móvil", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú de usuario" }));
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

        const menuUsuario = within(screen.getByRole("menu"));
        expect(menuUsuario.getAllByRole("menuitem")).toHaveLength(3);
        expect(menuUsuario.getByRole("menuitem", { name: "Notificaciones" })).toHaveAttribute("href", "/notificaciones");
        expect(menuUsuario.getByRole("menuitem", { name: "Cerrar sesión" })).toBeInTheDocument();
        expect(within(screen.getByRole("navigation", { name: "Navegación móvil" })).getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
        expect(menuUsuario.getByRole("menuitem", { name: "Mi perfil" })).toHaveAttribute("href", "/mi-perfil/productor");
        expect(within(screen.getByRole("navigation", { name: "Navegación móvil" })).getByRole("link", { name: "Mi perfil" })).toHaveAttribute("href", "/mi-perfil/productor");
        expect(menuUsuario.getByRole("menuitem", { name: "Mi perfil" }).tagName).toBe("A");
        expect(menuUsuario.getByRole("menuitem", { name: "Notificaciones" }).tagName).toBe("A");
    });

    it.each([
        { ruta: "/mi-mercado/productor", nombre: "Mi mercado" },
        { ruta: "/precios-referencia", nombre: "Precios de referencia" },
        { ruta: "/precios-historicos", nombre: "Histórico de precios" },
    ])("marca $nombre como activo en la navegación del productor", ({ ruta, nombre }) => {
        consultarRutaSimulada.mockReturnValue(ruta);
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }} />);

        for (const enlace of screen.getAllByRole("link", { name: nombre })) {
            expect(enlace).toHaveAttribute("aria-current", "page");
        }
    });

    it("marca como activa la opción correspondiente a la ruta actual", () => {
        consultarRutaSimulada.mockReturnValue("/publicaciones");
        render(<HeaderPublico sesion={null} />);
        const enlacesPublicaciones = screen.getAllByRole("link", { name: "Mercado Virtual" });
        expect(enlacesPublicaciones[0]).toHaveClass(estilos.enlaceActivo);
        expect(enlacesPublicaciones[1]).toHaveClass(estilos.enlaceActivo);
    });

    it("marca Mi mercado como activo al entrar al operador indicado por nombre", () => {
        consultarRutaSimulada.mockReturnValue("/mi-mercado/Frutas%20del%20Norte");
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "OPERADOR", expiraEn: 2000000000 }} />);
        expect(screen.getAllByRole("link", { name: "Mi mercado" })[0]).toHaveAttribute("aria-current", "page");
    });

    it("no marca como activa ninguna opción cuando la ruta no coincide", () => {
        consultarRutaSimulada.mockReturnValue("/otra-ruta");
        render(<HeaderPublico sesion={null} />);
        const enlaces = screen.getAllByRole("link");
        enlaces.forEach((enlace) => { expect(enlace).not.toHaveClass("enlaceActivo") });
    });

    it("inicialmente muestra el botón para abrir el menú", () => {
        render(<HeaderPublico sesion={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("abre el menú móvil al hacer click", () => {
        render(<HeaderPublico sesion={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "true");
    });

    it("cierra el menú móvil al volver a hacer click", () => {
        render(<HeaderPublico sesion={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        const botonCerrar = screen.getByRole("button", { name: "Cerrar menú" });
        fireEvent.click(botonCerrar);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("cierra el menú móvil al seleccionar una opción", () => {
        render(<HeaderPublico sesion={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        const enlacesPublicaciones = screen.getAllByRole("link", { name: "Mercado Virtual" });
        fireEvent.click(enlacesPublicaciones[1]);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it("los enlaces tienen las rutas correspondientes", () => {
        render(<HeaderPublico sesion={null} />);
        expect(screen.getAllByRole("link", { name: "Inicio" })[0]).toHaveAttribute("href", "/inicio");
        expect(screen.getAllByRole("link", { name: "Mercado Virtual" })[0]).toHaveAttribute("href", "/publicaciones");
        expect(screen.getAllByRole("link", { name: "Operadores" })[0]).toHaveAttribute("href", "/operadores");
        expect(screen.queryByRole("link", { name: "Mi mercado" })).not.toBeInTheDocument();
    });

    it("el menú móvil tiene el atributo aria-controls correspondiente", () => {
        render(<HeaderPublico sesion={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).toHaveAttribute("aria-controls", "menu-mobile");
        expect(screen.getByRole("navigation", { name: "Navegación móvil" })).toHaveAttribute("id", "menu-mobile");
    });

    it("cierra el menú móvil al hacer click sobre el overlay", () => {
        const { container } = render(<HeaderPublico sesion={null} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        fireEvent.click(boton);
        expect(screen.getByRole("button", { name: "Cerrar menú" })).toBeInTheDocument();
        const overlay = container.querySelector(`.${estilos.overlayMenu}`);
        expect(overlay).toBeInTheDocument();
        fireEvent.mouseDown(overlay!);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toBeInTheDocument();
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)("cierra la sesión y el menú del %s al elegir la opción del menú de usuario", async (rol) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol, expiraEn: 2000000000 }} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú de usuario" }));

        fireEvent.click(screen.getByRole("menuitem", { name: "Cerrar sesión" }));

        expect(screen.getByRole("button", { name: "Abrir menú de usuario" })).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("menu")).not.toBeInTheDocument();
        await waitFor(() => {
            expect(cerrarSesionSimulada).toHaveBeenCalledOnce();
        });
    });

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)("cierra la sesión y el menú móvil del %s", async (rol) => {
        const { container } = render(<HeaderPublico sesion={{ usuarioId: 10, rol, expiraEn: 2000000000 }} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
        const menuMobile = within(screen.getByRole("navigation", { name: "Navegación móvil" }));

        fireEvent.click(menuMobile.getByRole("button", { name: "Cerrar sesión" }));

        expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByRole("navigation", { name: "Navegación móvil" })).not.toHaveClass(estilos.navegacionMobileAbierta);
        expect(container.querySelector(`.${estilos.overlayMenu}`)).not.toBeInTheDocument();
        await waitFor(() => {
            expect(cerrarSesionSimulada).toHaveBeenCalledOnce();
        });
    });

    it.each(["Navegación principal", "Navegación móvil"])("agrupa los mercados para el administrador en %s", (nombre) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        if (nombre === "Navegación móvil") fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

        const menu = within(screen.getByRole("navigation", { name: nombre }));
        const boton = menu.getByRole("button", { name: "Mercados" });
        const desplegable = document.getElementById(boton.getAttribute("aria-controls")!)!;
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(desplegable).toHaveAttribute("inert");
        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "true");
        expect(desplegable).not.toHaveAttribute("inert");
        expect(within(desplegable).getByRole("link", { name: "Operadores" })).toHaveAttribute("href", "/publicaciones");
        expect(within(desplegable).getByRole("link", { name: "Productores" })).toHaveAttribute("href", "/publicaciones-productor");
        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(desplegable).toHaveAttribute("inert");
    });

    it.each(["Navegación principal", "Navegación móvil"])("agrupa los listados de usuarios para el administrador en %s", (nombre) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        if (nombre === "Navegación móvil") fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));

        const menu = within(screen.getByRole("navigation", { name: nombre }));
        const boton = menu.getByRole("button", { name: "Usuarios" });
        const desplegable = document.getElementById(boton.getAttribute("aria-controls")!)!;
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(desplegable).toHaveAttribute("inert");
        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "true");
        expect(desplegable).not.toHaveAttribute("inert");
        expect(within(desplegable).getByRole("link", { name: "Operadores" })).toHaveAttribute("href", "/operadores");
        expect(within(desplegable).getByRole("link", { name: "Productores" })).toHaveAttribute("href", "/productores");
        fireEvent.click(boton);
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(desplegable).toHaveAttribute("inert");
    });

    it.each(["Mercados", "Usuarios"] as const)("cierra el desplegable de %s con Escape y devuelve el foco al botón", (grupo) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        const menu = within(screen.getByRole("navigation", { name: "Navegación principal" }));
        const boton = menu.getByRole("button", { name: grupo });
        fireEvent.click(boton);
        const desplegable = document.getElementById(boton.getAttribute("aria-controls")!)!;
        const enlace = within(desplegable).getByRole("link", {
            name: grupo === "Mercados" ? "Operadores" : "Operadores",
        });
        enlace.focus();
        fireEvent.keyDown(enlace, { key: "Escape", code: "Escape" });
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(boton).toHaveFocus();
        expect(desplegable).toHaveAttribute("inert");
    });

    it.each(["Mercados", "Usuarios"] as const)("cierra el desplegable de %s al pulsar fuera", (grupo) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        const menu = within(screen.getByRole("navigation", { name: "Navegación principal" }));
        const boton = menu.getByRole("button", { name: grupo });
        fireEvent.click(boton);
        fireEvent.pointerDown(document.body);
        expect(boton).toHaveAttribute("aria-expanded", "false");
    });

    it.each([
        { ruta: "/publicaciones", nombre: "Operadores", grupo: "Mercados" },
        { ruta: "/publicaciones-productor", nombre: "Productores", grupo: "Mercados" },
        { ruta: "/operadores", nombre: "Operadores", grupo: "Usuarios" },
        { ruta: "/productores", nombre: "Productores", grupo: "Usuarios" },
    ])("marca la opción activa para $ruta", ({ ruta, nombre, grupo }) => {
        consultarRutaSimulada.mockReturnValue(ruta);
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        const menu = within(screen.getByRole("navigation", { name: "Navegación principal" }));
        const boton = menu.getByRole("button", { name: grupo });
        expect(boton).toHaveClass(estilos.enlaceActivo);
        fireEvent.click(boton);
        const desplegable = document.getElementById(boton.getAttribute("aria-controls")!)!;
        expect(within(desplegable).getByRole("link", { name: nombre })).toHaveAttribute("aria-current", "page");
    });

    it("cierra el desplegable y el menú móvil al seleccionar Productores del mercado", () => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);
        fireEvent.click(screen.getByRole("button", { name: "Abrir menú" }));
        const menu = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
        const boton = menu.getByRole("button", { name: "Mercados" });
        fireEvent.click(boton);
        const desplegable = document.getElementById(boton.getAttribute("aria-controls")!)!;
        const enlace = within(desplegable).getByRole("link", { name: "Productores" });
        fireEvent.click(enlace);
        expect(boton).toHaveAttribute("aria-expanded", "false");
        expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
    });
});

describe("permisos de navegación", () => {
    it("oculta las opciones denegadas tanto en escritorio como en móvil", () => {
        const regla = vi.spyOn(autorizacion, "autorizado").mockReturnValue(false);
        try {
            render(<HeaderPublico sesion={{ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }} />);
            for (const nombre of ["Inicio", "Mercado Virtual", "Mercado Producción", "Operadores", "Precios de referencia", "Histórico de precios", "Mi mercado", "Administración"]) {
                expect(screen.queryByRole("link", { name: nombre })).not.toBeInTheDocument();
            }
        } finally {
            regla.mockRestore();
        }
    });
});

describe("notificaciones en el encabezado", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        consultarRutaSimulada.mockReturnValue("/inicio");
        vi.mocked(useContadorNotificaciones).mockReturnValue({ noLeidas: 3, refrescar: vi.fn() });
    });

    it.each(["OPERADOR", "PRODUCTOR", "ADMINISTRADOR"] as const)("ofrece la bandeja y traslada el contador al abrir los menús de %s", (rol) => {
        render(<HeaderPublico sesion={{ usuarioId: 10, rol, expiraEn: 2000000000 }} />);

        const hamburguesa = screen.getByRole("button", { name: "Abrir menú" });
        expect(hamburguesa).toHaveAccessibleDescription("3 notificaciones sin leer");
        expect(within(hamburguesa).getByText("3")).toBeInTheDocument();

        fireEvent.click(hamburguesa);
        expect(hamburguesa).toHaveAttribute("aria-expanded", "true");
        expect(within(hamburguesa).queryByText("3")).not.toBeInTheDocument();

        const navegacionMobile = within(screen.getByRole("navigation", { name: "Navegación móvil" }));
        const enlace = navegacionMobile.getByRole("link", { name: "Notificaciones" });
        expect(enlace).toHaveAttribute("href", "/notificaciones");
        expect(within(enlace).getByText("3")).toBeInTheDocument();

        fireEvent.click(hamburguesa);
        expect(screen.getByRole("button", { name: "Abrir menú" })).toHaveAttribute("aria-expanded", "false");
        expect(within(hamburguesa).getByText("3")).toBeInTheDocument();

        const botonUsuario = screen.getByRole("button", { name: "Abrir menú de usuario" });
        expect(within(botonUsuario).getByText("3")).toBeInTheDocument();

        fireEvent.click(botonUsuario);
        expect(botonUsuario).toHaveAttribute("aria-expanded", "true");
        expect(within(botonUsuario).queryByText("3")).not.toBeInTheDocument();

        const notificacionUsuario = screen.getByRole("menuitem", { name: "Notificaciones" });
        expect(notificacionUsuario).toHaveAttribute("href", "/notificaciones");
        expect(within(notificacionUsuario).getByText("3")).toBeInTheDocument();

        fireEvent.click(botonUsuario);
        expect(botonUsuario).toHaveAttribute("aria-expanded", "false");
        expect(within(botonUsuario).getByText("3")).toBeInTheDocument();
    });

    it("muestra 9+ cuando hay más de nueve notificaciones en ambos menús", () => {
        vi.mocked(useContadorNotificaciones).mockReturnValue({ noLeidas: 10, refrescar: vi.fn() });
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "ADMINISTRADOR", expiraEn: 2000000000 }} />);

        const hamburguesa = screen.getByRole("button", { name: "Abrir menú" });
        expect(within(hamburguesa).getByText("9+")).toBeInTheDocument();
        fireEvent.click(hamburguesa);
        expect(within(hamburguesa).queryByText("9+")).not.toBeInTheDocument();

        const enlaceNotificaciones = within(screen.getByRole("navigation", { name: "Navegación móvil" })).getByRole("link", { name: "Notificaciones" });
        expect(within(enlaceNotificaciones).getByText("9+")).toBeInTheDocument();

        fireEvent.click(hamburguesa);
        const botonUsuario = screen.getByRole("button", { name: "Abrir menú de usuario" });
        expect(within(botonUsuario).getByText("9+")).toBeInTheDocument();

        fireEvent.click(botonUsuario);
        expect(within(botonUsuario).queryByText("9+")).not.toBeInTheDocument();

        const notificacionUsuario = screen.getByRole("menuitem", { name: "Notificaciones" });
        expect(within(notificacionUsuario).getByText("9+")).toBeInTheDocument();
    });

    it("mantiene acceso a la bandeja vacía sin mostrar un contador cero", () => {
        vi.mocked(useContadorNotificaciones).mockReturnValue({ noLeidas: 0, refrescar: vi.fn() });
        render(<HeaderPublico sesion={{ usuarioId: 10, rol: "PRODUCTOR", expiraEn: 2000000000 }} />);
        const boton = screen.getByRole("button", { name: "Abrir menú" });
        expect(boton).not.toHaveAttribute("aria-describedby");
        const enlace = screen.getByRole("link", { name: "Notificaciones" });
        expect(within(enlace).queryByText("0")).not.toBeInTheDocument();
    });

    it("no ofrece notificaciones a visitantes", () => {
        vi.mocked(useContadorNotificaciones).mockReturnValue({ noLeidas: 0, refrescar: vi.fn() });
        render(<HeaderPublico sesion={null} />);
        expect(screen.queryByRole("link", { name: "Notificaciones" })).not.toBeInTheDocument();
        expect(useContadorNotificaciones).toHaveBeenCalledWith(null);
    });
});
