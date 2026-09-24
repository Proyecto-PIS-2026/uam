import { render, screen, fireEvent, act } from "@testing-library/react";
import styles from "./FiltrosPublicaciones.module.css";
import FiltrosPublicaciones, { type PublicacionListado } from "./FiltrosPublicaciones";

const publicaciones: PublicacionListado[] = [
    {
        id: 1,
        precio: 100,
        foto: null,
        especie: "Manzana",
        variedad: "Gala",
        presentacion: "Caja",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "099000001",
        },
    },
];

const publicacionesVariedadUnica: PublicacionListado[] = [
    {
        ...publicaciones[0],
        especie: "Pera",
        variedad: "-",
    },
];

const publicacionesPrueba: PublicacionListado[] = [
    {
        id: 1,
        precio: 100,
        foto: null,
        especie: "Manzana",
        variedad: "Gala",
        presentacion: "Caja",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        operador: {
            id: 1,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "099000001",
        },
    },
    {
        id: 2,
        precio: 200,
        foto: null,
        especie: "Manzana",
        variedad: "Red",
        presentacion: "Bolsa",
        categoria: "II",
        calibre: "Mediano",
        codigoCalibre: "M",
        operador: {
            id: 2,
            nombreFantasia: "Mercado Verde",
            whatsApp: "099000002",
        },
    },
    {
        id: 3,
        precio: 300,
        foto: null,
        especie: "Pera",
        variedad: "Williams",
        presentacion: "Caja",
        categoria: "I",
        calibre: "Grande",
        codigoCalibre: "G",
        operador: {
            id: 3,
            nombreFantasia: "Frutas del Sur",
            whatsApp: "099000003",
        },
    },
    {
        id: 4,
        precio: 400,
        foto: null,
        especie: "Pera",
        variedad: "Packham",
        presentacion: "Bolsa",
        categoria: "E",
        calibre: "Pequeño",
        codigoCalibre: "P",
        operador: {
            id: 4,
            nombreFantasia: "Mercado Verde",
            whatsApp: "099000004",
        },
    },
];

const publicacionesPresentacion: PublicacionListado[] = [
    {
        ...publicacionesPrueba[0],
        id: 1,
        variedad: "Gala",
        presentacion: "Caja",
    },
    {
        ...publicacionesPrueba[0],
        id: 5,
        variedad: "Gala",
        presentacion: "Bolsa",
    },
];

const publicacionesConPrecioNulo: PublicacionListado[] = [
    {
        ...publicacionesPrueba[0],
        id: 5,
        precio: null,
    },
    {
        ...publicacionesPrueba[1],
        id: 6,
        precio: 200,
    },
    {
        ...publicacionesPrueba[2],
        id: 7,
        precio: null,
    },
];

describe("FiltrosPublicaciones", () => {

    afterEach(() => { vi.useRealTimers() });

    it("renderiza los controles principales", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones}/>);

        // Buscador y filtros principales
        expect(screen.getByLabelText("Buscar publicaciones")).toBeInTheDocument();
        expect(screen.getByLabelText("Especie")).toBeInTheDocument();
        expect(screen.getByLabelText("Precio Mínimo")).toBeInTheDocument();
        expect(screen.getByLabelText("Precio Máximo")).toBeInTheDocument();

        // Botones principales
        expect(screen.getByRole("button", { name: /más filtros/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /ordenar por/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /limpiar filtros/i })).toBeInTheDocument();

        // Filtros adicionales
        expect(screen.getByLabelText("Variedad")).toBeInTheDocument();
        expect(screen.getByLabelText("Presentación")).toBeInTheDocument();
        expect(screen.getByLabelText("Calibre")).toBeInTheDocument();
        expect(screen.getByLabelText("Categoría")).toBeInTheDocument();

        // Opciones de ordenamiento
        expect(screen.getByRole("button", { name: /sin ordenar/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /menor precio/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /mayor precio/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^a-z$/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /^z-a$/i })).toBeInTheDocument();
    });

    // Tests de estado inicial
    it("mantiene cerrados inicialmente los filtros adicionales y el ordenamiento", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones}/>);
        const filtrosExtendidos = document.querySelector(`.${styles.filtrosExtendidos}`);
        const listaOrdenamiento = document.querySelector(`.${styles.listaOrdenamiento}`);
        expect(filtrosExtendidos).toBeInTheDocument();
        expect(listaOrdenamiento).toBeInTheDocument();
        expect(document.querySelector(`.${styles.filtrosAbiertos}`)).not.toBeInTheDocument();
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
    });

    it("abre y cierra los filtros adicionales al hacer click en Más filtros", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones}/>);
        const layoutFiltros = document.querySelector(`.${styles.layoutFiltros}`);
        const botonMasFiltros = screen.getByRole("button", { name: /más filtros/i });
        expect(layoutFiltros).not.toHaveClass(styles.filtrosAbiertos);
        fireEvent.click(botonMasFiltros);
        expect(layoutFiltros).toHaveClass(styles.filtrosAbiertos);
        fireEvent.click(botonMasFiltros);
        expect(layoutFiltros).not.toHaveClass(styles.filtrosAbiertos);
    });

    it("abre y cierra las opciones de ordenamiento al hacer click en Ordenar por", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones}/>);
        const listaOrdenamiento = document.querySelector(`.${styles.listaOrdenamiento}`);
        const botonOrdenar = screen.getByRole("button", { name: /ordenar por/i });

        // Filtros ordenamientos antes de abrir
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
        fireEvent.click(botonOrdenar);

        // Filtros ordenamientos abiertos
        expect(listaOrdenamiento).toHaveClass(styles.listaOrdenamientoAbierta);

        // Filtros ordenamientos cerradis
        fireEvent.click(botonOrdenar);
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
    });

    it("renderiza correctamente los campos de búsqueda y precio", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        expect(buscador).toHaveAttribute("type", "search");
        expect(precioMinimo).toHaveAttribute("type", "number");
        expect(precioMinimo).toHaveAttribute("min", "0");
        expect(precioMinimo).toHaveAttribute("inputmode", "numeric");
        expect(precioMinimo).toHaveAttribute("placeholder", "$ 0");
        expect(precioMaximo).toHaveAttribute("type", "number");
        expect(precioMaximo).toHaveAttribute("min", "0");
        expect(precioMaximo).toHaveAttribute("inputmode", "numeric");
        expect(precioMaximo).toHaveAttribute("placeholder", "Sin límite");
    });

    it("cierra el menú de ordenamiento al seleccionar una opción", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        const listaOrdenamiento = document.querySelector(`.${styles.listaOrdenamiento}`);
        const botonOrdenar = screen.getByRole("button", { name: /ordenar por/i });
        fireEvent.click(botonOrdenar);
        expect(listaOrdenamiento).toHaveClass(styles.listaOrdenamientoAbierta);
        fireEvent.click(screen.getByRole("button", { name: /menor precio/i }));
        expect(listaOrdenamiento).not.toHaveClass(styles.listaOrdenamientoAbierta);
    });

    it("marca inicialmente Sin ordenar como opción activa", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        const sinOrdenar = screen.getByRole("button", {  name: /sin ordenar/i });
        expect(sinOrdenar).toHaveClass(styles.opcionOrdenamientoActiva);
    });

    it("cambia visualmente la opción activa del ordenamiento", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        const botonOrdenar = screen.getByRole("button", {  name: /ordenar por/i });
        fireEvent.click(botonOrdenar);
        const sinOrdenar = screen.getByRole("button", { name: /sin ordenar/i });
        const menorPrecio = screen.getByRole("button", { name: /menor precio/i });
        expect(sinOrdenar).toHaveClass(styles.opcionOrdenamientoActiva);
        fireEvent.click(menorPrecio);
        expect(menorPrecio).toHaveClass(styles.opcionOrdenamientoActiva);
        expect(sinOrdenar).not.toHaveClass(styles.opcionOrdenamientoActiva);
    });

    it("muestra la cantidad de publicaciones inicial", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        expect(screen.getByText("1 publicación")).toBeInTheDocument();
    });

    it("muestra el plural cuando hay varias publicaciones", () => {
        const variasPublicaciones = [
            publicaciones[0],
            {
                ...publicaciones[0],
                id: 2,
            },
        ];
        render(<FiltrosPublicaciones publicaciones={variasPublicaciones}/>);
        expect(screen.getByText("2 publicaciones")).toBeInTheDocument();
    });

    it("inicia los filtros con sus valores por defecto", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        expect(screen.getByLabelText("Especie")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Variedad")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Presentación")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Categoría")).toHaveTextContent("Todas");
        expect(screen.getByLabelText("Calibre")).toHaveTextContent("Todos");
    });

    it("habilita los filtros dependientes de forma secuencial", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const presentacion = screen.getByLabelText("Presentación");
        // Antes de seleccionar especie
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(presentacion).toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        // Despues de seleccionar especie
        expect(variedad).not.toHaveAttribute("aria-disabled");
        expect(presentacion).toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        // Despues de seleccionar variedad
        expect(presentacion).not.toHaveAttribute("aria-disabled");
    });

    it('selecciona automáticamente la variedad "-" y habilita Presentación', () => {
        render(<FiltrosPublicaciones publicaciones={publicacionesVariedadUnica}/>);
        const especie = screen.getByLabelText("Especie");
        const variedad = screen.getByLabelText("Variedad");
        const presentacion = screen.getByLabelText("Presentación");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(presentacion).toHaveAttribute("aria-disabled", "true");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Pera" }));
        expect(variedad).toHaveTextContent("-");
        expect(variedad).toHaveAttribute("aria-disabled", "true");
        expect(presentacion).not.toHaveAttribute("aria-disabled");
    });

    it("limpia los filtros al hacer click en Limpiar filtros", () => {
        render(<FiltrosPublicaciones publicaciones={publicaciones} />);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(buscador, { target: { value: "manzana" } });
        fireEvent.change(precioMinimo, { target: { value: "50" } });
        fireEvent.change(precioMaximo, { target: { value: "200" } });
        expect(buscador).toHaveValue("manzana");
        expect(precioMinimo).toHaveValue(50);
        expect(precioMaximo).toHaveValue(200);
        fireEvent.click(screen.getByRole("button", { name: /limpiar filtros/i }));
        expect(buscador).toHaveValue("");
        expect(precioMinimo).toHaveValue(null);
        expect(precioMaximo).toHaveValue(null);
    });

    it("muestra la cantidad de publicaciones al filtrar por especie", () => {
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        expect(screen.getByText("2 publicaciones")).toBeInTheDocument();
    });

    it("devuelve las publicaciones filtradas por especie mediante alFiltrar", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado[0].especie).toBe("Manzana");
        expect(resultado[1].especie).toBe("Manzana");
    });

    it("filtra las publicaciones por variedad", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].variedad).toBe("Gala");
    });

    it("filtra las publicaciones por presentación", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPresentacion} alFiltrar={alFiltrar}/>);
        const especie = screen.getByLabelText("Especie");
        fireEvent.mouseDown(especie);
        fireEvent.click(screen.getByRole("option", { name: "Manzana" }));
        const variedad = screen.getByLabelText("Variedad");
        fireEvent.mouseDown(variedad);
        fireEvent.click(screen.getByRole("option", { name: "Gala" }));
        const presentacion = screen.getByLabelText("Presentación");
        fireEvent.mouseDown(presentacion);
        fireEvent.click(screen.getByRole("option", { name: "Caja" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].presentacion).toBe("Caja");
    });

    it("filtra las publicaciones por categoría", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const categoria = screen.getByLabelText("Categoría");
        fireEvent.mouseDown(categoria);
        fireEvent.click(screen.getByRole("option", { name: "E" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].categoria).toBe("E");
    });

    it("filtra las publicaciones por calibre", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const calibre = screen.getByLabelText("Calibre");
        fireEvent.mouseDown(calibre);
        fireEvent.click(screen.getByRole("option", { name: "Pequeño" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].calibre).toBe("Pequeño");
    });

    it("filtra las publicaciones por búsqueda de texto", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        fireEvent.change(buscador, { target: { value: "manzana" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.especie === "Manzana")).toBe(true); 
    });

    it("filtra las publicaciones por nombre de operador", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        fireEvent.change(buscador, { target: { value: "Mercado Verde" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.operador.nombreFantasia === "Mercado Verde")).toBe(true);
    });

    it("filtra las publicaciones por precio minimo", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        fireEvent.change(precioMinimo, { target: { value: "250" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado[0].precio).toBe(300);
        expect(resultado[1].precio).toBe(400);
        fireEvent.change(precioMinimo, { target: { value: "250" } });
        fireEvent.change(precioMinimo, { target: { value: "-10" } });
        expect(precioMinimo).toHaveValue(250);
    });

    it("filtra las publicaciones por precio maximo", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(precioMaximo, { target: { value: "250" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado[0].precio).toBe(100);
        expect(resultado[1].precio).toBe(200);
        fireEvent.change(precioMaximo, { target: { value: "250" } });
        fireEvent.change(precioMaximo, { target: { value: "-10" } });
        expect(precioMaximo).toHaveValue(250);
    });

    it("filtra las publicaciones por rango de precio", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(precioMinimo, { target: { value: "150" } });
        fireEvent.change(precioMaximo, { target: { value: "350" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(2);
        expect(resultado.every((publicacion) => publicacion.precio !== null && publicacion.precio >= 150 && publicacion.precio <= 350)).toBe(true)
    });

    it("no devuelve publicaciones cuando el rango de precio es inválido", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones  publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const precioMinimo = screen.getByLabelText("Precio Mínimo");
        const precioMaximo = screen.getByLabelText("Precio Máximo");
        fireEvent.change(precioMinimo, { target: { value: "350" } });
        fireEvent.change(precioMaximo, { target: { value: "150" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado =  alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(0);
    });

    it("ordena las publicaciones por precio ascendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.precio)).toEqual([100, 200, 300, 400]);
    });

    it("ordena las publicaciones por precio descendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Mayor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => publicacion.precio)).toEqual([400, 300, 200, 100]);
    });

    it("ordena las publicaciones alfabéticamente de A a Z", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "A-Z" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => [publicacion.especie, publicacion.variedad])).toEqual([["Manzana", "Gala"], ["Manzana", "Red"], ["Pera", "Packham"], ["Pera", "Williams"]]);
    });

    it("ordena las publicaciones alfabéticamente de Z a A", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar} />);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Z-A" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado.map((publicacion) => [ publicacion.especie, publicacion.variedad])).toEqual([["Pera", "Williams"], ["Pera", "Packham"], ["Manzana", "Red"], ["Manzana", "Gala"]]);
    });


    it("filtra por varias palabras sin distinguir mayúsculas y minúsculas", () => {
        vi.useFakeTimers();
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} alFiltrar={alFiltrar}/>);
        const buscador = screen.getByLabelText("Buscar publicaciones");
        fireEvent.change(buscador, { target: { value: "MANZANA mercado" } });
        act(() => { vi.advanceTimersByTime(750) });
        const resultado = alFiltrar.mock.calls.at(-1)?.[0] as PublicacionListado[];
        expect(resultado).toHaveLength(1);
        expect(resultado[0].id).toBe(2);
        expect(resultado[0].especie).toBe("Manzana");
        expect(resultado[0].operador.nombreFantasia).toBe("Mercado Verde");
    });

    it("permite volver a seleccionar Sin ordenar", () => {
        render(<FiltrosPublicaciones publicaciones={publicacionesPrueba} />);
        const botonOrdenar = screen.getByRole("button", { name: "Ordenar por" });
        fireEvent.click(botonOrdenar);
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        fireEvent.click(botonOrdenar);
        const sinOrdenar = screen.getByRole("button", {name: "Sin ordenar"});
        fireEvent.click(sinOrdenar);
        expect(sinOrdenar).toHaveClass(styles.opcionOrdenamientoActiva);
    });

    it("coloca las publicaciones sin precio al final al ordenar por precio", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesConPrecioNulo} alFiltrar={alFiltrar}/>);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Menor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(3);
        expect(resultado[0].precio).toBe(200);
        expect(resultado[1].precio).toBeNull();
        expect(resultado[2].precio).toBeNull();
    });

    it("mantiene las publicaciones sin precio al final al ordenar por precio descendente", () => {
        const alFiltrar = vi.fn();
        render(<FiltrosPublicaciones publicaciones={publicacionesConPrecioNulo} alFiltrar={alFiltrar}/>);
        fireEvent.click(screen.getByRole("button", { name: "Ordenar por" }));
        fireEvent.click(screen.getByRole("button", { name: "Mayor Precio" }));
        const resultado = alFiltrar.mock.calls.at(-1)?.[0];
        expect(resultado).toHaveLength(3);
        expect(resultado[0].precio).toBe(200);
        expect(resultado[1].precio).toBeNull();
        expect(resultado[2].precio).toBeNull();
    });
});