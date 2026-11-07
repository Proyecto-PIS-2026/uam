import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import type { PerfilPropioOperador as Perfil } from "../../consultasPerfilPropio";
import PerfilPropioOperador from "./PerfilPropioOperador";

vi.mock("next/image", () => ({
    default: ({
        src,
        alt,
        onError,
    }: {
        src: string;
        alt?: string;
        onError?: () => void;
    }) =>
        createElement("img", {
            src,
            alt: alt ?? "",
            onError,
        }),
}));

vi.mock("./FormularioPerfilPropio", () => ({
    default: ({ alCancelar }: { alCancelar: () => void }) => (
        <div>
            <span>Formulario simulado</span>
            <button type="button" onClick={alCancelar}>
                Cancelar edición
            </button>
        </div>
    ),
}));

const perfil: Perfil = {
    id: 7,
    nombre: "Frutas del Norte",
    nombreUsuario: "frutas",
    contacto: "+59899123456",
    fotoPerfil: null,
    comentario: "Licencia: 2999-11-05 - 2999-11-12\n\nConsultar disponibilidad.",
    enLicencia: true,
    locales: [
        { nave: "B", local: "20", finContrato: "2029-03-31" },
        { nave: "A", local: "2", finContrato: null },
    ],
};

describe("PerfilPropioOperador", () => {
    it("muestra los datos, locales, licencia y mensaje", () => {
        render(
            <PerfilPropioOperador
                perfil={perfil}
                cambioContrasenaHabilitado
            />,
        );

        expect(
            screen.getByRole("heading", {
                name: "Frutas del Norte",
            }),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Usuario: frutas"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Teléfono: +59899123456"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Vence: 31/03/2029"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Sin fecha de fin"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Fecha: 05/11/2999 - 12/11/2999"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("Consultar disponibilidad."),
        ).toBeInTheDocument();

        expect(
            screen.getByRole("link", {
                name: "Cambiar contraseña",
            }),
        ).toHaveAttribute(
            "href",
            "/mi-perfil/cambiar-contrasena",
        );
    });

    it("oculta el acceso al cambio de contraseña cuando está deshabilitado", () => {
        render(
            <PerfilPropioOperador
                perfil={perfil}
                cambioContrasenaHabilitado={false}
            />,
        );

        expect(
            screen.queryByRole("link", {
                name: "Cambiar contraseña",
            }),
        ).not.toBeInTheDocument();
    });

    it("muestra el estado vacío y permite entrar y salir de edición", () => {
        const perfilSinDatos = {
            ...perfil,
            locales: [],
            enLicencia: false,
            comentario: null,
            contacto: null,
        };

        render(
            <PerfilPropioOperador perfil={perfilSinDatos} />,
        );

        expect(
            screen.getByText("Sin locales registrados"),
        ).toBeInTheDocument();

        expect(
            screen.getByText("No hay licencia registrada."),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Editar",
            }),
        );

        expect(
            screen.getByText("Formulario simulado"),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", {
                name: "Cancelar edición",
            }),
        );

        expect(
            screen.getByRole("heading", {
                name: "Frutas del Norte",
            }),
        ).toBeInTheDocument();
    });
});