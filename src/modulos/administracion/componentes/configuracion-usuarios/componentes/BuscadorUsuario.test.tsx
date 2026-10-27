import { fireEvent, render, screen } from "@testing-library/react";
import type { ChangeEvent, ReactNode } from "react";
import BuscadorUsuario from "./BuscadorUsuario";

interface MockTextFieldProps {
    label?: string;
    select?: boolean;
    value?: string;
    type?: string;
    onChange?: (evento: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    children?: ReactNode;
    slotProps?: {
        input?: {
            startAdornment?: ReactNode;
        };
        select?: unknown;
    };
}

interface MockSelectProps {
    value?: string;
    onChange?: (evento: ChangeEvent<HTMLSelectElement>) => void;
    children?: ReactNode;
    renderValue?: (valor: unknown) => ReactNode;
    inputProps?: { "aria-label"?: string };
}

vi.mock("@mui/material/TextField", () => ({
    default: ({
        label,
        select,
        value,
        type,
        onChange,
        children,
        slotProps,
    }: MockTextFieldProps) => {
        if (select) {
            return (
                <label>
                    {label}
                    <select
                        aria-label={label}
                        value={value}
                        onChange={onChange}
                    >
                        {children}
                    </select>
                </label>
            );
        }

        return (
            <label>
                {label}
                <span>{slotProps?.input?.startAdornment}</span>
                <input
                    aria-label={label}
                    type={type}
                    value={value}
                    onChange={onChange}
                />
            </label>
        );
    },
}));

vi.mock("@mui/material/Select", () => ({
    default: ({
        value,
        onChange,
        children,
        renderValue,
        inputProps,
    }: MockSelectProps) => (
        <>
            <div data-testid="valor-selector-movil">
                {renderValue?.(value)}
            </div>
            <select
                aria-label={inputProps?.["aria-label"]}
                value={value}
                onChange={onChange}
            >
                {children}
            </select>
        </>
    ),
}));

vi.mock("@mui/material/MenuItem", () => ({
    default: ({
        value,
        children,
    }: {
        value: string;
        children?: ReactNode;
    }) => <option value={value}>{children}</option>,
}));

vi.mock("@mui/icons-material/Search", () => ({
    default: (props: { "aria-hidden"?: boolean }) => (
        <span
            data-testid="icono-busqueda"
            aria-hidden={props["aria-hidden"]}
        />
    ),
}));

vi.mock("@mui/icons-material/FilterList", () => ({
    default: (props: { "aria-hidden"?: boolean }) => (
        <span
            data-testid="icono-filtro"
            aria-hidden={props["aria-hidden"]}
        />
    ),
}));

vi.mock("@mui/icons-material/LockResetOutlined", () => ({
    default: (props: { "aria-hidden"?: boolean }) => (
        <span
            data-testid="icono-restablecimiento"
            aria-hidden={props["aria-hidden"]}
        />
    ),
}));

describe("BuscadorUsuario", () => {
    it("renderiza el buscador, los selectores y todos los roles disponibles", () => {
        const onBusquedaChange = vi.fn();
        const onTipoUsuarioChange = vi.fn();
        const onRestablecimientoChange = vi.fn();

        render(
            <BuscadorUsuario
                busqueda=""
                onBusquedaChange={onBusquedaChange}
                tipoUsuario="TODOS"
                onTipoUsuarioChange={onTipoUsuarioChange}
                restablecimiento="TODOS"
                onRestablecimientoChange={onRestablecimientoChange}
            />,
        );

        expect(
            screen.getByRole("searchbox", { name: "Buscar usuarios" }),
        ).toHaveValue("");

        expect(screen.getByLabelText("Rol")).toHaveValue("TODOS");
        expect(
            screen.getByLabelText("Filtrar por rol"),
        ).toHaveValue("TODOS");

        expect(screen.getByTestId("icono-busqueda")).toHaveAttribute(
            "aria-hidden",
            "true",
        );
        const iconosFiltro = [
            screen.getByTestId("icono-filtro"),
            screen.getByTestId("icono-restablecimiento"),
        ];
        iconosFiltro.forEach((icono) => {
            expect(icono).toHaveAttribute("aria-hidden", "true");
        });

        expect(screen.getAllByRole("option")).toHaveLength(12);

        for (const rol of [
            "Todos",
            "Administrador",
            "Operador",
            "Productor",
        ]) {
            expect(screen.getAllByRole("option", { name: rol })).toHaveLength(
                rol === "Todos" ? 4 : 2,
            );
        }

        expect(
            document.querySelector("[data-opcion-mas-larga]"),
        ).toHaveAttribute("data-opcion-mas-larga", "Administrador");

        const selectoresMoviles = screen.getAllByTestId("valor-selector-movil");

        expect(selectoresMoviles).toHaveLength(2);

        selectoresMoviles.forEach((selector, indice) => {
            expect(selector).toContainElement(iconosFiltro[indice]);
        });
    });

    it("notifica los cambios en el texto de búsqueda", () => {
        const onBusquedaChange = vi.fn();
        const onTipoUsuarioChange = vi.fn();
        const onRestablecimientoChange = vi.fn();

        render(
            <BuscadorUsuario
                busqueda="ana"
                onBusquedaChange={onBusquedaChange}
                tipoUsuario="TODOS"
                onTipoUsuarioChange={onTipoUsuarioChange}
                restablecimiento="TODOS"
                onRestablecimientoChange={onRestablecimientoChange}
            />,
        );

        const buscador = screen.getByRole("searchbox", {
            name: "Buscar usuarios",
        });

        expect(buscador).toHaveValue("ana");

        fireEvent.change(buscador, {
            target: { value: "  ana@example.com  " },
        });

        expect(onBusquedaChange).toHaveBeenCalledTimes(1);
        expect(onBusquedaChange).toHaveBeenCalledWith("  ana@example.com  ");
        expect(onTipoUsuarioChange).not.toHaveBeenCalled();
    });

    it("notifica los cambios de rol desde el selector de escritorio", () => {
        const onBusquedaChange = vi.fn();
        const onTipoUsuarioChange = vi.fn();
        const onRestablecimientoChange = vi.fn();

        render(
            <BuscadorUsuario
                busqueda=""
                onBusquedaChange={onBusquedaChange}
                tipoUsuario="TODOS"
                onTipoUsuarioChange={onTipoUsuarioChange}
                restablecimiento="TODOS"
                onRestablecimientoChange={onRestablecimientoChange}
            />,
        );

        fireEvent.change(screen.getByLabelText("Rol"), {
            target: { value: "ADMINISTRADOR" },
        });

        fireEvent.change(screen.getByLabelText("Rol"), {
            target: { value: "OPERADOR" },
        });

        fireEvent.change(screen.getByLabelText("Rol"), {
            target: { value: "PRODUCTOR" },
        });

        fireEvent.change(screen.getByLabelText("Rol"), {
            target: { value: "TODOS" },
        });

        expect(onTipoUsuarioChange).toHaveBeenCalledTimes(4);
        expect(onTipoUsuarioChange).toHaveBeenNthCalledWith(1, "ADMINISTRADOR");
        expect(onTipoUsuarioChange).toHaveBeenNthCalledWith(2, "OPERADOR");
        expect(onTipoUsuarioChange).toHaveBeenNthCalledWith(3, "PRODUCTOR");
        expect(onTipoUsuarioChange).toHaveBeenNthCalledWith(4, "TODOS");
        expect(onBusquedaChange).not.toHaveBeenCalled();
    });

    it("notifica los cambios de rol desde el selector móvil", () => {
        const onBusquedaChange = vi.fn();
        const onTipoUsuarioChange = vi.fn();
        const onRestablecimientoChange = vi.fn();

        render(
            <BuscadorUsuario
                busqueda=""
                onBusquedaChange={onBusquedaChange}
                tipoUsuario="OPERADOR"
                onTipoUsuarioChange={onTipoUsuarioChange}
                restablecimiento="TODOS"
                onRestablecimientoChange={onRestablecimientoChange}
            />,
        );

        expect(screen.getByLabelText("Filtrar por rol")).toHaveValue("OPERADOR");

        fireEvent.change(screen.getByLabelText("Filtrar por rol"), {
            target: { value: "PRODUCTOR" },
        });

        expect(onTipoUsuarioChange).toHaveBeenCalledTimes(1);
        expect(onTipoUsuarioChange).toHaveBeenCalledWith("PRODUCTOR");
        expect(onBusquedaChange).not.toHaveBeenCalled();
    });

    it.each(["Restablecimiento", "Filtrar por restablecimiento"])(
        "conserva los cambios del filtro %s",
        (nombre) => {
            const onBusquedaChange = vi.fn();
            const onTipoUsuarioChange = vi.fn();
            const onRestablecimientoChange = vi.fn();

            render(
                <BuscadorUsuario
                    busqueda=""
                    onBusquedaChange={onBusquedaChange}
                    tipoUsuario="TODOS"
                    onTipoUsuarioChange={onTipoUsuarioChange}
                    restablecimiento="TODOS"
                    onRestablecimientoChange={onRestablecimientoChange}
                />,
            );

            const selector = screen.getByRole("combobox", { name: nombre });
            expect(selector).toHaveValue("TODOS");

            fireEvent.change(selector, { target: { value: "SOLICITADO" } });
            fireEvent.change(selector, { target: { value: "TODOS" } });

            expect(onRestablecimientoChange).toHaveBeenCalledTimes(2);
            expect(onRestablecimientoChange).toHaveBeenNthCalledWith(1, "SOLICITADO");
            expect(onRestablecimientoChange).toHaveBeenNthCalledWith(2, "TODOS");
            expect(onBusquedaChange).not.toHaveBeenCalled();
            expect(onTipoUsuarioChange).not.toHaveBeenCalled();
        },
    );
});
