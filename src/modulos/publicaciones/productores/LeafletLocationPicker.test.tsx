import { useState } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    crearMapa: vi.fn(), capa: vi.fn(), crearMarcador: vi.fn(),
    mapa: { setView: vi.fn(), on: vi.fn(), remove: vi.fn(), invalidateSize: vi.fn() },
    marcador: { addTo: vi.fn(), setStyle: vi.fn(), remove: vi.fn() },
    alConfirmar: vi.fn(), alCerrar: vi.fn(),
}));
vi.mock("leaflet", () => ({ map: mocks.crearMapa, tileLayer: mocks.capa, circleMarker: mocks.crearMarcador }));

import LeafletLocationPicker from "./LeafletLocationPicker";

const ubicacion = { latitud: -34.9, longitud: -56.2, departamento: "Montevideo", nombreLugar: "Ruta 5" };

async function abrirMapa(coordenadas: typeof ubicacion | null = null) {
    const vista = render(<LeafletLocationPicker abierto modo={coordenadas ? "editar" : "agregar"} coordenadas={coordenadas} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
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
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeDisabled();
        await waitFor(() => expect(mocks.mapa.invalidateSize).toHaveBeenCalled());
    });

    it("restaura una ubicación existente y la permite confirmar", async () => {
        await abrirMapa(ubicacion);
        expect(screen.getByRole("dialog", { name: "Editar punto de retiro" })).toBeInTheDocument();
        expect(mocks.mapa.setView).toHaveBeenCalledWith([-34.9, -56.2], 14);
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it("permite cambiar solamente el nombre sin volver a buscar el punto y lo recorta al confirmar", async () => {
        await abrirMapa(ubicacion);
        fireEvent.change(screen.getByLabelText(/^Nombre del punto de retiro/), { target: { value: " Entrada de la quinta " } });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ ...ubicacion, nombreLugar: "Entrada de la quinta" });
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "x".repeat(201)])("no permite confirmar un nombre vacío o demasiado largo", async (nombre) => {
        await abrirMapa(ubicacion);
        const campo = screen.getByLabelText(/^Nombre del punto de retiro/);
        fireEvent.change(campo, { target: { value: nombre } });
        fireEvent.blur(campo);
        expect(screen.getByText("Escribí un nombre de hasta 200 caracteres.")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(mocks.alConfirmar).not.toHaveBeenCalled();
    });

    it("conserva el nombre personalizado aunque la identificación de otro punto responda después", async () => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        await abrirMapa();
        await marcar();
        fireEvent.change(screen.getByLabelText(/^Nombre del punto de retiro/), { target: { value: "Entrada por el portón" } });
        await act(async () => pendiente.resolver(await respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 5" } })));
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Entrada por el portón");
        fireEvent.click(screen.getByRole("button", { name: "Agregar punto" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ ...ubicacion, nombreLugar: "Entrada por el portón" });
    });

    it("precarga el nombre de un enlace legado sin inventar coordenadas y lo conserva al elegir el punto", async () => {
        render(<LeafletLocationPicker abierto modo="editar" nombreInicial="Quinta conocida" coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.mapa.on).toHaveBeenCalledWith("click", expect.any(Function)));
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Quinta conocida");
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeDisabled();
        await marcar();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ ...ubicacion, nombreLugar: "Quinta conocida" });
    });

    it("conserva la selección provisional al recibir otro objeto con la misma ubicación confirmada", async () => {
        const vista = await abrirMapa(ubicacion);
        vi.mocked(fetch).mockImplementationOnce(() => respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } }));
        await marcar(-34.8, -56.1);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={{ ...ubicacion }} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        expect(mocks.crearMapa).toHaveBeenCalledOnce();
        expect(mocks.mapa.remove).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ latitud: -34.8, longitud: -56.1, departamento: "Canelones", nombreLugar: "Ruta 5" });
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
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 8");
        expect(mocks.mapa.setView).toHaveBeenLastCalledWith([-34.7, -56], 14);
        expect(mocks.marcador.setStyle).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(actualizada);
    });

    it.each(["Cancelar", "Cerrar mapa"])("descarta la selección provisional al %s y reabrir", async (nombre) => {
        const vista = await abrirMapa(ubicacion);
        vi.mocked(fetch).mockImplementationOnce(() => respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } }));
        await marcar(-34.8, -56.1);
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        fireEvent.click(screen.getByRole("button", { name: nombre }));
        vista.rerender(<LeafletLocationPicker abierto={false} coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).not.toHaveValue("Ruta 8");
        expect(mocks.mapa.setView).toHaveBeenLastCalledWith([-34.9, -56.2], 14);
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it("reabre sin selección cuando nunca se confirmó una ubicación", async () => {
        const vista = await abrirMapa();
        await marcar();
        fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
        vista.rerender(<LeafletLocationPicker abierto={false} coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        vista.rerender(<LeafletLocationPicker abierto coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />);
        await waitFor(() => expect(mocks.crearMapa).toHaveBeenCalledTimes(2));
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("");
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeDisabled();
    });

    it.each([200, 500])("descarta una respuesta anterior (%s) cuando ya se eligió otro punto", async (status) => {
        const anterior = respuestaPendiente();
        const reciente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(anterior.promesa).mockReturnValueOnce(reciente.promesa);
        await abrirMapa(ubicacion);
        await marcar(-34.8, -56.1);
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeDisabled();
        await marcar(-34.7, -56);
        await act(async () => reciente.resolver(await respuesta({ address: { country_code: "uy", state: "Canelones", road: "Ruta 8" } })));
        await act(async () => anterior.resolver(await respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 1" } }, status)));
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.crearMarcador).toHaveBeenLastCalledWith([-34.7, -56], expect.any(Object));
        expect(mocks.marcador.setStyle).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ latitud: -34.7, longitud: -56, departamento: "Canelones", nombreLugar: "Ruta 5" });
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
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(mocks.marcador.setStyle).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it("selecciona una ubicación uruguaya y reemplaza el marcador al cambiarla", async () => {
        await abrirMapa(); await marcar();
        expect(screen.getByLabelText(/^Nombre del punto de retiro/)).toHaveValue("Ruta 5");
        expect(fetch).toHaveBeenCalledWith(expect.stringContaining("reverse?format=jsonv2&lat=-34.9&lon=-56.2"), expect.objectContaining({ headers: { "Accept-Language": "es" }, signal: expect.any(AbortSignal) }));
        await marcar(-34.8, -56.1);
        expect(mocks.crearMarcador).toHaveBeenLastCalledWith([-34.8, -56.1], expect.any(Object));
        expect(mocks.marcador.remove).toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
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
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith({ latitud: -34.9, longitud: -56.2, departamento, nombreLugar: nombre ?? departamento });
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
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeDisabled();
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
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeDisabled();
        await act(async () => pendiente.resolver(await respuesta({ address: { country_code: "uy", state: "Montevideo", road: "Ruta 5" } })));
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
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
        await waitFor(() => expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeEnabled());
        expect(fetchMock.mock.calls[0][0]).toContain("countrycodes=uy&q=Mercado%20Modelo");
        expect(mocks.mapa.setView).toHaveBeenCalledWith([-34.9, -56.2], 16);
        expect(screen.queryByRole("list", { name: "Resultados de búsqueda" })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledWith(ubicacion);
    });

    it("no consulta por una búsqueda vacía", async () => {
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "  " } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        expect(fetch).not.toHaveBeenCalled();
    });

    it.each([200, 500])("descarta una búsqueda anterior (%s) cuando se cambia el texto", async (status) => {
        const pendiente = respuestaPendiente();
        vi.mocked(fetch).mockReturnValueOnce(pendiente.promesa);
        await abrirMapa();
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Mercado" } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        const signal = vi.mocked(fetch).mock.calls[0][1]?.signal;
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Quinta" } });
        expect(signal?.aborted).toBe(true);
        await act(async () => pendiente.resolver(await respuesta([{ place_id: 1, display_name: "Mercado anterior", lat: "-34.8", lon: "-56.1" }], status)));
        expect(screen.getByRole("searchbox")).toHaveValue("Quinta");
        expect(screen.queryByRole("list", { name: "Resultados de búsqueda" })).not.toBeInTheDocument();
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
    });

    it("un error al buscar no descarta un punto ya confirmado en el mapa", async () => {
        vi.mocked(fetch).mockReturnValueOnce(respuesta({}, 500));
        await abrirMapa(ubicacion);
        fireEvent.change(screen.getByRole("searchbox"), { target: { value: "Otra dirección" } });
        fireEvent.submit(screen.getByRole("searchbox").closest("form")!);
        expect(await screen.findByRole("alert")).toHaveTextContent("No pudimos buscar el lugar.");
        expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it("buscar desde el mapa no envía el formulario de la publicación", async () => {
        const alGuardar = vi.fn();
        const vista = render(<form aria-label="Editar publicación" onSubmit={(evento) => { evento.preventDefault(); alGuardar(); }}>
            <LeafletLocationPicker abierto coordenadas={null} alConfirmar={mocks.alConfirmar} alCerrar={mocks.alCerrar} />
        </form>);
        await waitFor(() => expect(mocks.mapa.on).toHaveBeenCalledWith("click", expect.any(Function)));
        const formulario = vista.container.querySelector("form")!;
        const buscador = screen.getByRole("searchbox");
        expect(formulario).not.toContainElement(buscador);
        vi.mocked(fetch).mockReturnValueOnce(respuesta([]));
        fireEvent.change(buscador, { target: { value: "Mercado" } });
        fireEvent.submit(buscador.closest("form")!);
        await screen.findByRole("alert");
        expect(alGuardar).not.toHaveBeenCalled();
        expect(mocks.alConfirmar).not.toHaveBeenCalled();
    });

    it("Escape cierra solamente el mapa y devuelve el foco al control que lo abrió", async () => {
        const alTecladoPadre = vi.fn();
        function Formulario() {
            const [abierto, setAbierto] = useState(false);
            return <section onKeyDown={alTecladoPadre}>
                <button type="button" onClick={() => setAbierto(true)}>Editar punto</button>
                <LeafletLocationPicker abierto={abierto} coordenadas={ubicacion} alConfirmar={mocks.alConfirmar} alCerrar={() => setAbierto(false)} />
            </section>;
        }
        render(<Formulario />);
        const origen = screen.getByRole("button", { name: "Editar punto" });
        origen.focus();
        fireEvent.click(origen);
        await waitFor(() => expect(mocks.mapa.on).toHaveBeenCalledWith("click", expect.any(Function)));
        const buscador = screen.getByRole("searchbox");
        buscador.focus();
        fireEvent.keyDown(buscador, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(origen).toHaveFocus();
        expect(alTecladoPadre).not.toHaveBeenCalled();
        expect(mocks.alConfirmar).not.toHaveBeenCalled();
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
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeEnabled();
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
        expect(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ })).toBeEnabled();
        expect(screen.getByRole("button", { name: "Buscar" })).toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: /^(Agregar punto|Guardar cambios)$/ }));
        expect(mocks.alConfirmar).toHaveBeenCalledExactlyOnceWith(ubicacion);
    });

    it.each([
        { status: 200, error: "No se encontraron lugares para esa búsqueda. Probá otra dirección o marcá el punto en el mapa." },
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
        expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo cargar el mapa. Cerralo e intentá nuevamente.");
    });
});
