import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UbicacionSeleccionada } from "./LeafletLocationPicker";
import UbicacionesEdicionProductor, { type UbicacionEdicionProductor } from "./UbicacionesEdicionProductor";

const mocks = vi.hoisted(() => ({ alCambiar: vi.fn(), alGuardar: vi.fn(), mapa: vi.fn() }));
vi.mock("./LeafletLocationPicker", () => ({
    default: (props: { abierto: boolean; coordenadas: UbicacionSeleccionada | null; alCerrar: () => void; alConfirmar: (ubicacion: UbicacionSeleccionada) => void }) => {
        mocks.mapa(props);
        return props.abierto ? <div role="dialog" aria-label="Seleccionar ubicación">
            <form onSubmit={(evento) => evento.preventDefault()}><button type="submit">Buscar en mapa</button></form>
            <button type="button" onClick={props.alCerrar}>Cancelar mapa</button>
            <button type="button" onClick={() => props.alConfirmar({ latitud: -34.5, longitud: -56.1, departamento: "Canelones", nombreLugar: "Quinta nueva" })}>Confirmar punto</button>
            <button type="button" onClick={() => props.alConfirmar({ latitud: -34.5, longitud: -56.1, departamento: "Canelones", nombreLugar: null })}>Confirmar departamento</button>
        </div> : null;
    },
}));

const iniciales: UbicacionEdicionProductor[] = [
    { clave: 8, nombreUbicacion: "Quinta original", urlMaps: "https://maps.app.goo.gl/corto" },
    { clave: 13, nombreUbicacion: "Depósito", urlMaps: "https://www.google.com/maps?q=-34.8,-56.2" },
];

function Controlado({ ubicaciones = iniciales, deshabilitado = false }: { ubicaciones?: UbicacionEdicionProductor[]; deshabilitado?: boolean }) {
    const [lista, setLista] = useState(ubicaciones);
    return <div data-testid="contenedor-drawer"><form aria-label="Editar publicación" onSubmit={(evento) => { evento.preventDefault(); mocks.alGuardar(); }}>
        <UbicacionesEdicionProductor ubicaciones={lista} deshabilitado={deshabilitado} alCambiar={(nueva) => { mocks.alCambiar(nueva); setLista(nueva); }} />
    </form></div>;
}

function desplegar() {
    fireEvent.click(screen.getByRole("button", { name: "Cambiar ubicación" }));
}

beforeEach(() => vi.clearAllMocks());

describe("UbicacionesEdicionProductor", () => {
    it("muestra un resumen compacto sin modificar los enlaces ni desplegar campos", () => {
        render(<Controlado />);
        expect(screen.getByText("Quinta original · Depósito")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Cambiar ubicación" })).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("permite desplegar, editar y volver a compactar sin persistir", () => {
        render(<Controlado />);
        desplegar();
        expect(screen.getByLabelText("Enlace de Google Maps 1")).toHaveValue(iniciales[0].urlMaps);
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "Quinta editada" } });
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([{ ...iniciales[0], nombreUbicacion: "Quinta editada" }, iniciales[1]]);
        fireEvent.click(screen.getByRole("button", { name: "Cambiar ubicación" }));
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(screen.getByText("Quinta editada · Depósito")).toBeInTheDocument();
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });

    it("agrega y elimina puntos con claves estables y conserva las ubicaciones restantes", () => {
        render(<Controlado />);
        desplegar();
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([...iniciales, { clave: 14, nombreUbicacion: "", urlMaps: "" }]);
        fireEvent.click(screen.getByRole("button", { name: "Eliminar punto de retiro 2" }));
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([iniciales[0], { clave: 14, nombreUbicacion: "", urlMaps: "" }]);
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([iniciales[0], { clave: 14, nombreUbicacion: "", urlMaps: "" }, { clave: 15, nombreUbicacion: "", urlMaps: "" }]);
    });

    it("ofrece seleccionar ubicación cuando no hay puntos y limita el alta a veinte", () => {
        const vista = render(<Controlado ubicaciones={[]} />);
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar ubicación de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("");
        vista.unmount();
        render(<Controlado ubicaciones={Array.from({ length: 20 }, (_, indice) => ({ ...iniciales[0], clave: indice + 1 }))} />);
        desplegar();
        expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBeDisabled();
    });

    it("precarga las coordenadas q=lat,lon y conserva el nombre del punto", () => {
        render(<Controlado />);
        desplegar();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 2" }));
        expect(mocks.mapa).toHaveBeenLastCalledWith(expect.objectContaining({ coordenadas: { latitud: -34.8, longitud: -56.2, departamento: "", nombreLugar: "Depósito" } }));
    });

    it.each(["https://maps.app.goo.gl/corto", "https://goo.gl/maps/legado", "https://www.google.com/maps?q=Montevideo", "https://www.google.com/maps?q=999,-56", "enlace legado"])("conserva un enlace no convertible al cancelar el mapa: %s", (urlMaps) => {
        render(<Controlado ubicaciones={[{ ...iniciales[0], urlMaps }]} />);
        desplegar();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        expect(mocks.mapa).toHaveBeenLastCalledWith(expect.objectContaining({ coordenadas: null }));
        fireEvent.click(screen.getByRole("button", { name: "Cancelar mapa" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Enlace de Google Maps 1")).toHaveValue(urlMaps);
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("confirmar el mapa modifica solamente el punto seleccionado", () => {
        render(<Controlado />);
        desplegar();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 2" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar punto" }));
        expect(mocks.alCambiar).toHaveBeenCalledExactlyOnceWith([iniciales[0], { clave: 13, nombreUbicacion: "Quinta nueva", urlMaps: "https://www.google.com/maps?q=-34.5,-56.1" }]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });

    it("usa el departamento cuando el mapa no devuelve nombre del lugar", () => {
        render(<Controlado />);
        desplegar();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Confirmar departamento" }));
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Canelones");
    });

    it("mantiene el buscador fuera del formulario de edición e impide guardar al buscar", () => {
        render(<Controlado />);
        desplegar();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        const dialogo = screen.getByRole("dialog");
        expect(screen.getByTestId("contenedor-drawer")).toContainElement(dialogo);
        expect(screen.getByRole("form", { name: "Editar publicación" })).not.toContainElement(dialogo);
        fireEvent.submit(within(dialogo).getByRole("button", { name: "Buscar en mapa" }).closest("form")!);
        expect(mocks.alGuardar).not.toHaveBeenCalled();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("impide abrir o editar mientras se guardan los cambios", () => {
        const vista = render(<UbicacionesEdicionProductor ubicaciones={iniciales} deshabilitado={false} alCambiar={mocks.alCambiar} />);
        desplegar();
        vista.rerender(<UbicacionesEdicionProductor ubicaciones={iniciales} deshabilitado alCambiar={mocks.alCambiar} />);
        expect(screen.getByRole("button", { name: "Cambiar ubicación" })).toBeDisabled();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("Escape cierra sólo el mapa, conserva el borrador y devuelve el foco al botón de origen", () => {
        const alPresionarFueraDelMapa = vi.fn();
        render(<div onKeyDown={alPresionarFueraDelMapa}><Controlado /></div>);
        desplegar();
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro 1"), { target: { value: "Quinta editada sin guardar" } });
        mocks.alCambiar.mockClear();
        const botonOrigen = screen.getByRole("button", { name: "Seleccionar en mapa punto de retiro 1" });
        fireEvent.click(botonOrigen);
        const buscador = screen.getByRole("button", { name: "Buscar en mapa" });
        buscador.focus();
        fireEvent.keyDown(buscador, { key: "Escape" });
        expect(alPresionarFueraDelMapa).not.toHaveBeenCalled();
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.getByLabelText("Nombre del punto de retiro 1")).toHaveValue("Quinta editada sin guardar");
        expect(screen.getByLabelText("Enlace de Google Maps 1")).toHaveValue(iniciales[0].urlMaps);
        expect(botonOrigen).toHaveFocus();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });
});
