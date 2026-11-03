import { test, expect } from "@playwright/test";

const rutaListado = "/publicaciones";

type Publicacion = {
    nombre: string;
    operador: string;
    presentacion: string;
    categoria: string;
    calibre: string;
    precio: number | null;
};

function obtenerEspecie(publicacion: Publicacion) {
    return publicacion.nombre.split(" - ")[0];
}

function sinTildes(texto: string) {
    return texto.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function ordenarPorEspecie(publicaciones: Publicacion[], descendente = false) {
    return [...publicaciones].sort((a, b) => {
        const comparacion = sinTildes(obtenerEspecie(a)).localeCompare(sinTildes(obtenerEspecie(b)), "es");
        return descendente ? -comparacion : comparacion;
    });
}

for (const pantalla of [
    { nombre: "escritorio", viewport: { width: 1280, height: 900 } },
    { nombre: "móvil", viewport: { width: 390, height: 844 } },
]) {
    test(`BP-05: búsqueda, filtros y ordenamiento de productos (${pantalla.nombre})`, async ({ page }) => {
        test.slow();

        const tarjetas = page.getByRole("button", { name: /^Ver detalles de / });
        const busqueda = page.getByRole("searchbox", { name: "Buscar publicaciones" });
        const precioMinimo = page.getByRole("textbox", { name: "Precio Mínimo" });
        const precioMaximo = page.getByRole("textbox", { name: "Precio Máximo" });
        const sinResultados = page.getByRole("status").filter({ hasText: "No hay publicaciones que coincidan con la búsqueda." });

        async function leerPublicaciones(): Promise<Publicacion[]> {
            return tarjetas.evaluateAll((elementos) => elementos.map((tarjeta) => {
                const nombre = tarjeta.querySelector("h3")?.textContent?.trim();
                const operador = tarjeta.querySelector("p[title]")?.getAttribute("title");
                const presentacion = tarjeta.querySelector('span[title^="por "]')?.getAttribute("title")?.slice(4).trim() ?? "";
                const etiquetas = Array.from(tarjeta.querySelectorAll("span"));
                const etiquetaCategoria = etiquetas.find((elemento) => elemento.textContent?.trim() === "Cat.");
                const etiquetaCalibre = etiquetas.find((elemento) => elemento.textContent?.trim() === "Calibre");
                const categoria = etiquetaCategoria?.nextElementSibling?.textContent?.trim();
                const calibre = etiquetaCalibre?.nextElementSibling?.firstElementChild?.textContent?.trim();
                const texto = tarjeta.textContent ?? "";
                const coincidenciaPrecio = texto.match(/\$\s*([\d.,]+)/);

                if (!nombre || operador == null || categoria == null || calibre == null) {
                    throw new Error("La estructura de la tarjeta no permite leer sus datos.");
                }

                if (!texto.includes("Consultar precio") && !coincidenciaPrecio) {
                    throw new Error(`No se pudo leer el precio de ${nombre}.`);
                }

                return {
                    nombre,
                    operador: operador.trim(),
                    presentacion,
                    categoria,
                    calibre,
                    precio: texto.includes("Consultar precio") ? null : Number(coincidenciaPrecio![1].replace(/\./g, "").replace(",", ".")),
                };
            }));
        }

        async function comprobarResultados(esperadas: Publicacion[]) {
            await expect(tarjetas).toHaveCount(esperadas.length);
            await expect.poll(leerPublicaciones).toEqual(esperadas);

            if (esperadas.length === 0) {
                await expect(sinResultados).toBeVisible();
            } else {
                await expect(sinResultados).toHaveCount(0);
            }
        }

        async function seleccionar(campo: string, opcion: string) {
            await page.getByRole("combobox", { name: campo, exact: true }).click();
            await page.getByRole("option", { name: opcion, exact: true }).click();
        }

        async function ordenar(opcion: string) {
            await page.getByRole("button", { name: "Ordenar por" }).click();
            await page.getByRole("menuitemradio", { name: opcion, exact: true }).click();
        }

        await page.setViewportSize(pantalla.viewport);
        await page.goto(rutaListado);
        await expect(tarjetas.first()).toBeVisible();

        // Más vendidas no tiene una opción propia en este menú.
        await page.getByRole("button", { name: "Ordenar por" }).click();
        await expect(page.getByRole("menu")).toBeVisible();
        const seleccionInicial = page.getByRole("menuitemradio", { checked: true });
        const restauraOrdenPredeterminado = await seleccionInicial.count() > 0;
        const nombreOrdenInicial = restauraOrdenPredeterminado ? (await seleccionInicial.innerText()).trim() : null;
        await page.keyboard.press("Escape");
        await expect(page.getByRole("menu")).not.toBeVisible();

        const publicacionesIniciales = await leerPublicaciones();
        const especiesEsperadas = ordenarPorEspecie(publicacionesIniciales).map(obtenerEspecie);

        await ordenar("A-Z");
        await expect(tarjetas).toHaveCount(publicacionesIniciales.length);
        await expect.poll(async () => (await leerPublicaciones()).map(obtenerEspecie)).toEqual(especiesEsperadas);

        const publicaciones = await leerPublicaciones();

        async function comprobarOrdenTrasLimpiar(ordenConservado: string, publicacionesConservadas: Publicacion[]) {
            const ordenEsperado = nombreOrdenInicial ?? ordenConservado;
            const esperadas = restauraOrdenPredeterminado ? publicacionesIniciales : publicacionesConservadas;

            await page.getByRole("button", { name: "Ordenar por" }).click();
            await expect(page.getByRole("menuitemradio", { name: ordenEsperado, exact: true })).toHaveAttribute("aria-checked", "true");
            await page.keyboard.press("Escape");
            await expect(page.getByRole("menu")).not.toBeVisible();
            await comprobarResultados(esperadas);
        }

        const producto = publicaciones.find((publicacion) =>
            publicacion.nombre.includes(" - ") &&
            publicacion.precio !== null &&
            publicacion.precio > 0 &&
            publicacion.presentacion !== "" &&
            publicacion.categoria !== "-" &&
            publicacion.calibre !== "-"
        );
        expect(producto, "Debe existir una publicación con datos completos para probar los filtros combinados").toBeDefined();
        if (!producto) throw new Error("No hay una publicación con los datos necesarios para probar los filtros.");

        const [especie, variedad] = producto.nombre.split(" - ");
        const especieConTilde = publicaciones.map(obtenerEspecie).find((nombre) => /[áéíóú]/i.test(nombre));
        expect(especieConTilde).toBeDefined();
        if (!especieConTilde) throw new Error("Debe existir una especie con tilde para probar la búsqueda.");

        await test.step("BP-05.1: buscar por nombre, coincidencias parciales y sin tildes", async () => {
            const coincidencias = publicaciones.filter((publicacion) => sinTildes(publicacion.nombre).includes(sinTildes(especieConTilde)));
            expect(coincidencias.length).toBeLessThan(publicaciones.length);

            await busqueda.fill(especieConTilde);
            await comprobarResultados(coincidencias);

            await busqueda.fill(sinTildes(especieConTilde));
            await comprobarResultados(coincidencias);

            const nombreParcial = especieConTilde.slice(0, -1);
            await busqueda.fill(nombreParcial);
            await comprobarResultados(publicaciones.filter((publicacion) => sinTildes(publicacion.nombre).includes(sinTildes(nombreParcial))));

            await busqueda.fill("producto-inexistente-bp-05");
            await comprobarResultados([]);

            await busqueda.fill("");
            await comprobarResultados(publicaciones);
        });

        await test.step("BP-05.2: aplicar y combinar filtros avanzados", async () => {
            if (pantalla.nombre === "móvil") {
                await page.getByRole("button", { name: "Más filtros" }).click();
            }

            const precios = [...new Set(publicaciones.map((publicacion) => publicacion.precio).filter((precio): precio is number => precio !== null))].sort((a, b) => a - b);
            expect(precios.length).toBeGreaterThan(2);
            const limite = precios[Math.floor(precios.length / 2)];

            await precioMinimo.fill(String(limite));
            await comprobarResultados(publicaciones.filter((publicacion) => publicacion.precio !== null && publicacion.precio >= limite));

            await precioMinimo.fill("");
            await precioMaximo.fill(String(limite));
            await comprobarResultados(publicaciones.filter((publicacion) => publicacion.precio !== null && publicacion.precio <= limite));

            await precioMinimo.fill(String(limite));
            await comprobarResultados(publicaciones.filter((publicacion) => publicacion.precio === limite));

            await precioMaximo.fill("");
            await ordenar("Mayor Precio");
            const preciosEsperados = publicaciones.filter((publicacion) => publicacion.precio !== null && publicacion.precio >= limite).map((publicacion) => publicacion.precio!).sort((a, b) => b - a);
            await expect.poll(async () => (await leerPublicaciones()).map((publicacion) => publicacion.precio)).toEqual(preciosEsperados);

            await precioMinimo.fill("");
            await ordenar("A-Z");
            await comprobarResultados(publicaciones);

            await seleccionar("Categoría", producto.categoria);
            await comprobarResultados(publicaciones.filter((publicacion) => publicacion.categoria === producto.categoria));

            await seleccionar("Categoría", "Todas");
            await comprobarResultados(publicaciones);

            await seleccionar("Calibre", producto.calibre);
            await comprobarResultados(publicaciones.filter((publicacion) => publicacion.calibre === producto.calibre));

            await seleccionar("Calibre", "Todos");
            await comprobarResultados(publicaciones);

            await seleccionar("Especie", especie);
            let esperadas = publicaciones.filter((publicacion) => obtenerEspecie(publicacion) === especie);
            await comprobarResultados(esperadas);

            await seleccionar("Variedad", variedad);
            esperadas = esperadas.filter((publicacion) => publicacion.nombre === producto.nombre);
            await comprobarResultados(esperadas);

            await seleccionar("Presentación", producto.presentacion);
            esperadas = esperadas.filter((publicacion) => publicacion.presentacion === producto.presentacion);
            await comprobarResultados(esperadas);

            await seleccionar("Categoría", producto.categoria);
            esperadas = esperadas.filter((publicacion) => publicacion.categoria === producto.categoria);
            await comprobarResultados(esperadas);

            await seleccionar("Calibre", producto.calibre);
            esperadas = esperadas.filter((publicacion) => publicacion.calibre === producto.calibre);
            await comprobarResultados(esperadas);

            await precioMinimo.fill(String(producto.precio));
            await comprobarResultados(esperadas.filter((publicacion) => publicacion.precio !== null && publicacion.precio >= producto.precio!));

            await precioMinimo.fill("");
            await precioMaximo.fill(String(producto.precio));
            await comprobarResultados(esperadas.filter((publicacion) => publicacion.precio !== null && publicacion.precio <= producto.precio!));

            await precioMinimo.fill(String(producto.precio));
            esperadas = esperadas.filter((publicacion) => publicacion.precio === producto.precio);
            await comprobarResultados(esperadas);

            await busqueda.fill(especie);
            await ordenar("Mayor Precio");
            await comprobarResultados(esperadas);

            await precioMaximo.fill("");
            await precioMinimo.fill(String(Math.max(...publicaciones.map((publicacion) => publicacion.precio ?? 0)) + 1));
            await comprobarResultados([]);

            await ordenar("A-Z");
            await page.getByRole("button", { name: "Limpiar filtros" }).click();
            await expect(busqueda).toHaveValue("");
            await expect(precioMinimo).toHaveValue("");
            await expect(precioMaximo).toHaveValue("");

            for (const campo of ["Especie", "Variedad", "Presentación", "Categoría"]) {
                await expect(page.getByRole("combobox", { name: campo, exact: true })).toHaveText("Todas");
            }

            await expect(page.getByRole("combobox", { name: "Calibre", exact: true })).toHaveText("Todos");
            await comprobarOrdenTrasLimpiar("A-Z", publicaciones);

            await ordenar("A-Z");
            await comprobarResultados(publicaciones);
        });

        await test.step("BP-05.3: ordenar por precio y alfabéticamente", async () => {
            const precios = publicaciones.map((publicacion) => publicacion.precio).filter((precio): precio is number => precio !== null);
            expect(new Set(precios).size).toBeGreaterThan(1);
            const sinPrecio = publicaciones.length - precios.length;

            for (const opcion of ["Menor Precio", "Mayor Precio"]) {
                await ordenar(opcion);
                await expect(tarjetas).toHaveCount(publicaciones.length);
                const esperados = [...precios].sort((a, b) => opcion === "Menor Precio" ? a - b : b - a);
                await expect.poll(async () => (await leerPublicaciones()).map((publicacion) => publicacion.precio)).toEqual([...esperados, ...Array<null>(sinPrecio).fill(null)]);
            }

            await ordenar("A-Z");
            await comprobarResultados(publicaciones);

            const publicacionesDescendentes = ordenarPorEspecie(publicaciones, true);
            await ordenar("Z-A");
            await comprobarResultados(publicacionesDescendentes);

            await page.getByRole("button", { name: "Limpiar filtros" }).click();
            await comprobarOrdenTrasLimpiar("Z-A", publicacionesDescendentes);

            await busqueda.fill("producto-inexistente-bp-05");
            await ordenar("Mayor Precio");
            await comprobarResultados([]);

            await ordenar("A-Z");
            await page.getByRole("button", { name: "Limpiar filtros" }).click();
            await comprobarOrdenTrasLimpiar("A-Z", publicaciones);
        });
    });
}