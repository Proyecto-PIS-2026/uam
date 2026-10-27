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
    const escuchar = mocks.mapa.on.mock.calls.filter(([nombre]) => nombre === "click").at(-1)![1] as (evento: { latlng: { lat: number; lng: number } }) => void;
    await act(async () => escuchar({ latlng: { lat: latitud, lng: longitud } }));
}

function respuesta(datos: unknown, status = 200) {
    return Promise.resolve(new Response(JSON.stringify(datos), { status }));
}

function respuestaPendiente() {
    let resolver!: (respuesta: Response) => void;
    const promesa = new Promise<Response>((resolve) => { resolver = resolve; });
    return { promesa, resolver };
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

    it("conserva la selección provisional al recibir otro objeto con la misma ubicación confirmada", async () => {
        const vista = await abrirMapa(ubicacion);
        vi.mocked(fetch).mockImplementationOnce(() => respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } }));
        await marcar(-34.8, -56.1);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={{ ...ubicacion }} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        expect(screen.getByText("Ruta 8, Canelones")).toBeInTheDocument();
        expect(mocks.crearMapa).toHaveBeenCalledOnce();
        expect(mocks.mapa.remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ latitud: -34.8, longitud: -56.1, departamento: "Canelones", nombreLugar: "Ruta 8" });
    });

    it("restaura una ubicación confirmada distinta y descarta la identificación que estaba pendiente", async () => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        const vista = await abrirMapa(ubicacion);
        await marcar(-34.8, -56.1);
        const actualizada = { latitud: -34.7, longitud: -56, departamento: "Canelones", nombreLugar: "Ruta 8" };
        vista.rerender(<LeafletLocationPicker abierto coordenadas={actualizada} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        await act(async () => pendiente.resolver(await respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 1" } })));
        expect(screen.getByText("Ruta 8, Canelones")).toBeInTheDocument();
        expect(mocks.mapa.setView).toHaveBeenLastCalledWith([-34.7, -56], 14);
        expect(mocks.marcador.setLatLng).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(actualizada);
    });

    it.each(["Cancelar", "Cerrar mapa"])("descarta la selección provisional al %s y reabrir", async (nombre) => {
        const vista = await abrirMapa(ubicacion);
        vi.mocked(fetch).mockImplementationOnce(() => respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } }));
        await marcar(-34.8, -56.1);
        expect(screen.getByText("Ruta 8, Canelones")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: nombre }));
        vista.rerender(<LeafletLocationPicker abierto={false} coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        expect(screen.getByText("Ruta 5, Montevideo")).toBeInTheDocument();
        expect(screen.queryByText("Ruta 8, Canelones")).not.toBeInTheDocument();
        expect(mocks.mapa.setView).toHaveBeenLastCalledWith([-34.9, -56.2], 14);
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it("reabre sin selección cuando nunca se confirmó una ubicación", async () => {
        const vista = await abrirMapa();
        await marcar();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        vista.rerender(<LeafletLocationPicker abierto={false} coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        expect(screen.queryByText("Ruta 5, Montevideo")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeDisabled();
    });

    it.each([200, 500])("descarta una respuesta anterior (%s) cuando ya se eligió otro punto", async (status) => {
        const anterior = respuestaPendiente();
        const reciente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(anterior.promesa).mockReturnValueOnce(reciente.promesa);
        await abrirMapa(ubicacion);
        await marcar(-34.8, -56.1);
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeDisabled();
        await marcar(-34.7, -56);
        await act(async () => reciente.resolver(await respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } })));
        await act(async () => anterior.resolver(await respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 1" } }, status)));
        expect(screen.getByText("Ruta 8, Canelones")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.marcador.setLatLng).toHaveBeenCalledExactlyOnceWith([-34.7, -56]);
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ latitud: -34.7, longitud: -56, departamento: "Canelones", nombreLugar: "Ruta 8" });
    });

    it.each([200, 500])("descarta una identificación pendiente (%s) después de cerrar y reabrir", async (status) => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        const vista = await abrirMapa(ubicacion);
        await marcar(-34.8, -56.1);
        vista.rerender(<LeafletLocationPicker abierto={false} coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        await act(async () => pendiente.resolver(await respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } }, status)));
        expect(screen.getByText("Ruta 5, Montevideo")).toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.marcador.setLatLng).not.toHaveBeenCalled();
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
        { address: { country_code: "uy", state: "Departamento de Paysandu", road: "Ruta 3" }, nombre: "Ruta 3", departamento: "Paysandú" },
        { address: { country_code: "uy", state: "Uruguay", county: "San José Department", road: "Ruta 1" }, nombre: "Ruta 1", departamento: "San José" },
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
        { datos: { address: { country_code: "uy", state: "Ciudad de la Costa" } }, status: 200, error: "No pudimos identificar el departamento. Seleccioná nuevamente el punto en el mapa." },
        { datos: { address: { country_code: "ar", state: "Buenos Aires" } }, status: 200, error: "La ubicación debe estar dentro de Uruguay." },
        { datos: { address: { country_code: "uy" } }, status: 200, error: "No pudimos identificar el departamento. Seleccioná nuevamente el punto en el mapa." },
        { datos: {}, status: 500, error: "No pudimos identificar la ubicación. Revisá tu conexión e intentá nuevamente." },
    ])("rechaza la ubicación: $error", async ({ datos, status, error }) => {
        vi.stubGlobal("fetch", vi.fn(() => respuesta(datos, status)));
        await abrirMapa(ubicacion); await marcar();
        expect(screen.getByRole("alert")).toHaveTextContent(error);
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeDisabled();
        expect(mocks.alConfirmar).not.toHaveBeenCalled();
    });

    it("informa un fallo de red al identificar la ubicación", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch: internal proxy")));
        await abrirMapa(); await marcar();
        expect(screen.getByRole("alert")).toHaveTextContent("No pudimos identificar la ubicación. Revisá tu conexión e intentá nuevamente.");
        expect(screen.queryByText(/Failed to fetch|internal proxy/)).not.toBeInTheDocument();
    });

    it("identifica el departamento de un punto anterior antes de permitir confirmarlo", async () => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        await abrirMapa({ ...ubicacion, departamento: "" });
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeDisabled();
        await act(async () => pendiente.resolver(await respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 5" } })));
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
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

    it.each([200, 500])("descarta una búsqueda pendiente (%s) después de cerrar y reabrir", async (status) => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        const vista = await abrirMapa(ubicacion);
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mercado" } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        vista.rerender(<LeafletLocationPicker abierto={false} coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        await act(async () => pendiente.resolver(await respuesta([{ place_id: 1, display_name: "Mercado Modelo", lat: "-34.8", lon: "-56.1" }], status)));
        expect(screen.getByRole("searchbox")).toHaveValue("");
        expect(screen.queryByRole("list")).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeEnabled();
    });

    it("descarta el error de una búsqueda anterior después de marcar otro punto", async () => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mercado" } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        await marcar();
        await act(async () => pendiente.resolver(await respuesta([], 500)));
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Usar esta ubicación" })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Usar esta ubicación" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it.each([
        { status: 200, error: "No se encontraron lugares para esa búsqueda." },
        { status: 500, error: "No pudimos buscar el lugar. Revisá tu conexión e intentá nuevamente." },
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
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos buscar el lugar. Revisá tu conexión e intentá nuevamente.");
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
