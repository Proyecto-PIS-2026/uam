import { useState } from "react";
import { createPortal } from "react-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { UbicacionSeleccionada } from "./LeafletLocationPicker";
import UbicacionesEdicionProductor, { type UbicacionEdicionProductor } from "./UbicacionesEdicionProductor";

const mocks = vi.hoisted(() => ({ alCambiar: vi.fn(), alGuardar: vi.fn(), mapa: vi.fn() }));
vi.mock("./LeafletLocationPicker", () => ({
    default: function Mapa(props: {
        abierto: boolean; modo?: "agregar" | "editar"; nombreInicial?: string;
        coordenadas: UbicacionSeleccionada | null; alCerrar: () => void;
        alConfirmar: (ubicacion: UbicacionSeleccionada) => void;
    }) {
        mocks.mapa(props);
        const [nombre, setNombre] = useState(props.nombreInicial || "Quinta nueva");
        const punto = { latitud: -34.5, longitud: -56.1, departamento: "Canelones", nombreLugar: nombre };
        return props.abierto ? createPortal(<div role="dialog" aria-label="Punto de retiro">
            <label>Nombre del punto de retiro<input value={nombre} onChange={(evento) => setNombre(evento.target.value)} /></label>
            <button type="button" onClick={props.alCerrar}>Cancelar mapa</button>
            <button type="button" onClick={() => props.alConfirmar(punto)}>Confirmar punto</button>
            <button type="button" onClick={() => props.alConfirmar({ ...punto, departamento: "Desconocido" })}>Confirmar departamento inválido</button>
            <button type="button" onClick={() => props.alConfirmar({ ...punto, latitud: Number.NaN })}>Confirmar coordenadas inválidas</button>
        </div>, document.body) : null;
    },
}));

const iniciales: UbicacionEdicionProductor[] = [
    { clave: 8, nombreUbicacion: "Quinta original", urlMaps: "https://maps.app.goo.gl/corto" },
    { clave: 13, nombreUbicacion: "Depósito", urlMaps: "https://www.google.com/maps?q=-34.8,-56.2" },
];

function Controlado({ ubicaciones = iniciales, deshabilitado = false }: { ubicaciones?: UbicacionEdicionProductor[]; deshabilitado?: boolean }) {
    const [lista, setLista] = useState(ubicaciones);
    return <form aria-label="Editar publicación" onSubmit={(evento) => { evento.preventDefault(); mocks.alGuardar(); }}>
        <UbicacionesEdicionProductor ubicaciones={lista} deshabilitado={deshabilitado} alCambiar={(nueva) => { mocks.alCambiar(nueva); setLista(nueva); }} />
    </form>;
}

function confirmar(nombre = "Quinta nueva") {
    fireEvent.change(screen.getByLabelText("Nombre del punto de retiro"), { target: { value: nombre } });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar punto", exact: true }));
}

beforeEach(() => vi.clearAllMocks());

describe("UbicacionesEdicionProductor", () => {
    it("muestra los puntos y sus acciones directamente sin cambiar los datos guardados", () => {
        render(<Controlado ubicaciones={[{ ...iniciales[0], departamento: "Montevideo" }, iniciales[1]]} />);
        const puntos = within(screen.getByRole("list")).getAllByRole("listitem");
        expect(puntos).toHaveLength(2);
        expect(within(puntos[0]).getByText("Quinta original")).toBeInTheDocument();
        expect(within(puntos[0]).getByText(/Departamento:.*Montevideo/)).toBeInTheDocument();
        expect(within(puntos[1]).getByText("Depósito")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Editar punto de retiro 1" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Quitar punto de retiro 2" })).toBeEnabled();
        expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("agregar abre directamente el mapa y cancelar no crea una fila vacía", () => {
        render(<Controlado ubicaciones={[]} />);
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        expect(mocks.mapa).toHaveBeenLastCalledWith(expect.objectContaining({ modo: "agregar", coordenadas: null }));
        expect(screen.getByRole("dialog", { name: "Punto de retiro" })).toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar mapa" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /^Editar punto de retiro/ })).not.toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });

    it("agrega solo al confirmar, normaliza el nombre y conserva claves estables al quitar y agregar", () => {
        render(<Controlado />);
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        confirmar(" Quinta nueva ");
        const nueva = { clave: 14, nombreUbicacion: "Quinta nueva", urlMaps: "https://www.google.com/maps?q=-34.5,-56.1", departamento: "Canelones" };
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([...iniciales, nueva]);
        fireEvent.click(screen.getByRole("button", { name: "Quitar punto de retiro 2" }));
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([iniciales[0], nueva]);
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        confirmar("Segundo retiro");
        expect(mocks.alCambiar).toHaveBeenLastCalledWith([iniciales[0], nueva, { ...nueva, clave: 15, nombreUbicacion: "Segundo retiro" }]);
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });

    it("limita el alta a veinte y la habilita nuevamente al quitar un punto", () => {
        render(<Controlado ubicaciones={Array.from({ length: 20 }, (_, indice) => ({ ...iniciales[0], clave: indice + 1 }))} />);
        expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Quitar punto de retiro 20" }));
        expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBeEnabled();
    });

    it("precarga coordenadas, nombre y modo de edición sin modificar el punto al abrirlo", () => {
        render(<Controlado />);
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 2" }));
        expect(mocks.mapa).toHaveBeenLastCalledWith(expect.objectContaining({ modo: "editar", nombreInicial: "Depósito", coordenadas: { latitud: -34.8, longitud: -56.2, departamento: "", nombreLugar: "Depósito" } }));
        expect(screen.getByLabelText("Nombre del punto de retiro")).toHaveValue("Depósito");
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it.each(["https://maps.app.goo.gl/corto", "https://goo.gl/maps/legado", "https://www.google.com/maps?q=Montevideo", "https://www.google.com/maps?q=999,-56", "enlace legado"])("conserva el nombre y el enlace legado al cancelar: %s", (urlMaps) => {
        render(<Controlado ubicaciones={[{ ...iniciales[0], urlMaps }]} />);
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 1" }));
        expect(mocks.mapa).toHaveBeenLastCalledWith(expect.objectContaining({ coordenadas: null, nombreInicial: "Quinta original" }));
        fireEvent.change(screen.getByLabelText("Nombre del punto de retiro"), { target: { value: "No guardar" } });
        fireEvent.click(screen.getByRole("button", { name: "Cancelar mapa" }));
        expect(screen.getByText("Quinta original")).toBeInTheDocument();
        expect(screen.queryByText("No guardar")).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/Enlace de Google Maps/)).not.toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("confirmar la edición modifica solamente el punto seleccionado", () => {
        render(<Controlado />);
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 2" }));
        confirmar();
        expect(mocks.alCambiar).toHaveBeenCalledExactlyOnceWith([iniciales[0], { clave: 13, nombreUbicacion: "Quinta nueva", urlMaps: "https://www.google.com/maps?q=-34.5,-56.1", departamento: "Canelones" }]);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "x".repeat(201)])("no incorpora un punto con nombre inválido", (nombre) => {
        render(<Controlado ubicaciones={[]} />);
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        confirmar(nombre);
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it.each(["Confirmar departamento inválido", "Confirmar coordenadas inválidas"])("no incorpora datos incompletos: %s", (accion) => {
        render(<Controlado ubicaciones={[]} />);
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto de retiro" }));
        fireEvent.click(screen.getByRole("button", { name: accion }));
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("permite quitar todos los puntos sin agregar otros implícitamente", () => {
        render(<Controlado ubicaciones={[iniciales[0]]} />);
        fireEvent.click(screen.getByRole("button", { name: "Quitar punto de retiro 1" }));
        expect(mocks.alCambiar).toHaveBeenCalledExactlyOnceWith([]);
        expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Agregar punto de retiro" })).toBeEnabled();
        expect(mocks.alGuardar).not.toHaveBeenCalled();
    });

    it("impide agregar, editar o quitar mientras se guarda la publicación", () => {
        render(<Controlado deshabilitado />);
        for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 1" }));
        fireEvent.click(screen.getByRole("button", { name: "Quitar punto de retiro 1" }));
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });

    it("no recrea un punto eliminado mientras se estaba editando", () => {
        const vista = render(<UbicacionesEdicionProductor ubicaciones={iniciales} deshabilitado={false} alCambiar={mocks.alCambiar} />);
        fireEvent.click(screen.getByRole("button", { name: "Editar punto de retiro 1" }));
        vista.rerender(<UbicacionesEdicionProductor ubicaciones={[iniciales[1]]} deshabilitado={false} alCambiar={mocks.alCambiar} />);
        const confirmarPunto = screen.queryByRole("button", { name: "Confirmar punto", exact: true });
        if (confirmarPunto) fireEvent.click(confirmarPunto);
        expect(mocks.alCambiar).not.toHaveBeenCalled();
    });
});
