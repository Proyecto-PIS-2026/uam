import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    crearMapa: vi.fn(), capa: vi.fn(), crearMarcador: vi.fn(),
    mapa: { setView: vi.fn(), on: vi.fn(), remove: vi.fn(), invalidateSize: vi.fn() },
    marcador: { addTo: vi.fn(), setLatLng: vi.fn() },
    alConfirmar: vi.fn(), alCerrar: vi.fn(),
}));
vi.mock("leaflet", () => ({ map: mocks.crearMapa, tileLayer: mocks.capa, circleMarker: mocks.crearMarcador }));

import LeafletLocationPicker from "./LeafletLocationPicker";

const ubicacion = { latitud: -34.9, longitud: -56.2, departamento: "Montevideo", nombreLugar: "Ruta 5" };

async function abrirMapa(coordenadas: typeof ubicacion | null = null) {
    const vista = render(<LeafletLocationPicker abierto coordenadas={coordenadas} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
    await waitFor(() => expect(mocks.mapa.on).toHaveBeenCalledWith("click", expect.any(Function)));
    return vista;
}

async function marcar(latitud = -34.9, longitud = -56.2) {
    const escuchar = mocks.mapa.on.mock.calls.find(([nombre]) => nombre === "click")![1] as (evento: { latlng: { lat: number; lng: number } }) => void;
    await act(async () => escuchar({ latlng: { lat: latitud, lng: longitud } }));
}

function respuesta(datos: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(datos), { status }));
}

describe("LeafletLocationPicker", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        mocks.crearMapa.mockReturnValue(mocks.mapa);
        mocks.mapa.setView.mockReturnValue(mocks.mapa);
        mocks.capa.mockReturnValue({ addTo: vi.fn() });
        mocks.crearMarcador.mockReturnValue(mocks.marcador);
        mocks.marcador.addTo.mockReturnValue(mocks.marcador);
        vi.stubGlobal("fetch", vi.fn(() => respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 5" } })));
    });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

    it("no carga el mapa cuando el selector está cerrado", () => {
        render(<LeafletLocationPicker abierto={false} coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(mocks.crearMapa).not.toHaveBeenCalled();
    });

    it("centra Uruguay y exige una ubicación antes de confirmar", async () => {
        await abrirMapa();
        expect(mocks.mapa.setView).toHaveBeenCalledWith([-32.5228, -55.7658], 6);
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeDisabled();
        await waitFor(() => expect(mocks.mapa.invalidateSize).toHaveBeenCalledOnce());
    });

    it("restaura una ubicación existente y la permite confirmar", async () => {
        await abrirMapa(ubicacion);
        expect(mocks.mapa.setView).toHaveBeenCalledWith([-34.9, -56.2], 14);
        expect(screen.getByText("Ruta 5, Montevideo")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it("selecciona una ubicación uruguaya y mueve el marcador al cambiarla", async () => {
        await abrirMapa(); await marcar();
        expect(screen.getByText("Ruta 5, Montevideo")).toBeInTheDocument();
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining("reverse?format=jsonv2&lat=-34.9&lon=-56.2"), { headers: { "Accept-Language": "es" } });
        await marcar(-34.8, -56.1);
        expect(mocks.crearMarcador).toHaveBeenCalledOnce();
        expect(mocks.marcador.setLatLng).toHaveBeenCalledExactlyOnceWith([-34.8, -56.1]);
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ ...ubicacion, latitud: -34.8, longitud: -56.1 });
    });

    it.each([
        { address: { country_code: "UY", county: "Canelones", neighbourhood: "Centro" }, nombre: "Centro", departamento: "Canelones" },
        { address: { country_code: "uy", state: "Salto", suburb: "Barrio Sur" }, nombre: "Barrio Sur", departamento: "Salto" },
        { address: { country_code: "uy", state: "Colonia", town: "Carmelo" }, nombre: "Carmelo", departamento: "Colonia" },
        { address: { country_code: "uy", state: "Salto", city: "Salto" }, nombre: "Salto", departamento: "Salto" },
        { address: { country_code: "uy", state: "Florida" }, nombre: "Establecimiento", departamento: "Florida", display_name: "Establecimiento, Florida" },
        { address: { country_code: "uy", state: "Durazno" }, nombre: null, departamento: "Durazno" },
    ])("obtiene el nombre de retiro disponible en la respuesta: $nombre", async ({ address, nombre, departamento, ...datos }) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta({ address, ...datos })));
        await abrirMapa(); await marcar();
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ latitud: -34.9, longitud: -56.2, departamento, nombreLugar: nombre });
    });

    it.each([
        { datos: { address: { country_code: "ar", state: "Buenos Aires" } }, status: 200, error: "La ubicación debe estar dentro de Uruguay." },
        { datos: { address: { country_code: "uy" } }, status: 200, error: "No se pudo identificar el departamento." },
        { datos: {}, status: 500, error: "No se pudo identificar la ubicación." },
    ])("rechaza la ubicación: $error", async ({ datos, status, error }) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta(datos, status)));
        await abrirMapa(ubicacion); await marcar();
        expect(screen.getByRole("alert")).toHaveTextContent(error);
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeDisabled();
        expect(mocks.alConfirmar).not.toHaveBeenCalled();
    });

    it("informa un fallo de red al identificar la ubicación", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue("Sin conexión"));
        await abrirMapa(); await marcar();
        expect(screen.getByRole("alert")).toHaveTextContent("No se pudo identificar la ubicación.");
    });

    it("busca en Uruguay, centra el resultado y confirma su dirección", async () => {
        const fetchMock = vi.fn()
            .mockImplementationOnce(() => respuesta([{ place_id: 1, display_name: "Mercado Modelo, Montevideo", lat: "-34.9", lon: "-56.2" }]))
            .mockImplementationOnce(() => respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 5" } }));
        vi.stubGlobal("fetch", fetchMock);
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: " Mercado Modelo " } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        fireEvent.click(await screen.findByRole("button", { name: "Mercado Modelo, Montevideo" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeEnabled());
        expect(fetchMock.mock.calls[0][0]).toContain("countrycodes=uy&q=Mercado%20Modelo");
        expect(mocks.mapa.setView).toHaveBeenCalledWith([-34.9, -56.2], 16);
        expect(screen.queryByRole("list", { name: "Resultados de búsqueda" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledWith(ubicacion);
    });

    it("no consulta por una búsqueda vacía", async () => {
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  " } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([
        { status: 200, error: "No se encontraron lugares para esa búsqueda." },
        { status: 500, error: "No se pudo buscar el lugar." },
    ])("informa una búsqueda sin resultados o fallida: $error", async ({ status, error }) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta([], status)));
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mercado" } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        expect(await screen.findByRole("alert")).toHaveTextContent(error);
        expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
    });

    it("limpia los resultados y recupera el buscador tras un fallo de red", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue("Sin conexión"));
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mercado" } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo buscar el lugar.");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
    });

    it.each(["Cancelar", "Cerrar mapa"])("cierra con %s y libera el mapa", async (nombre) => {
        const vista = await abrirMapa();
        fireEvent.click(screen.getByRole("button", { name: nombre }));
        expect(mocks.alCerrar).toHaveBeenCalledOnce();
        vista.unmount();
        expect(mocks.mapa.remove).toHaveBeenCalledOnce();
    });

    it("informa cuando Leaflet no puede inicializar el mapa", async () => {
        mocks.crearMapa.mockImplementation(() => { throw new Error("Mapa no disponible"); });
        render(<LeafletLocationPicker abierto coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el mapa.");
    });
});
