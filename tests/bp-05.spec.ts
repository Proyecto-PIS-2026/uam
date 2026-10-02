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
    const sinResultados = page.getByRole("status").filter({
      hasText: "No hay publicaciones que coincidan con la búsqueda.",
    });

    // Leemos el catálogo visible para comprobar los resultados sin depender de IDs.
    async function leerPublicaciones(): Promise<Publicacion[]> {
      const nombres = await tarjetas.getByRole("heading").allTextContents();
      const operadores = await tarjetas.locator("xpath=(.//p[@title])[1]").allTextContents();
      const presentaciones = await tarjetas.locator('span[title^="por "]').allTextContents();
      const categorias = await tarjetas.getByText("Cat.", { exact: true })
        .locator("xpath=following-sibling::span").allTextContents();
      const calibres = await tarjetas.getByText("Calibre", { exact: true })
        .locator("xpath=following-sibling::span/span[1]").allTextContents();
      const textos = await tarjetas.allTextContents();

      return nombres.map((nombre, indice) => ({
        nombre: nombre.trim(),
        operador: operadores[indice].trim(),
        presentacion: presentaciones[indice].trim().slice(4),
        categoria: categorias[indice].trim(),
        calibre: calibres[indice].trim(),
        precio: textos[indice].includes("Consultar precio")
          ? null
          : Number(textos[indice].match(/\$\s*([\d.,]+)/)![1].replace(/\./g, "").replace(",", ".")),
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
      await page.getByRole("option", { name: opcion, exact: true }).click({
        timeout: 5_000,
      });
    }

    async function ordenar(opcion: string) {
      await page.getByRole("button", { name: "Ordenar por" }).click();
      await page.getByRole("button", { name: opcion, exact: true }).click();
    }

    await page.setViewportSize(pantalla.viewport);
    await page.goto(rutaListado);
    await expect(tarjetas.first()).toBeVisible();

    const publicaciones = await leerPublicaciones();
    await ordenar("Sin ordenar");
    const publicacionesSinOrdenar = await leerPublicaciones();
    await ordenar("A-Z");
    await comprobarResultados(publicaciones);
    const producto = publicaciones.find((publicacion) =>
      publicacion.nombre.includes(" - ") && publicacion.precio !== null && publicacion.precio > 0,
    )!;
    expect(producto).toBeDefined();

    const [especie, variedad] = producto.nombre.split(" - ");
    const especieConTilde = publicaciones.map((publicacion) => publicacion.nombre.split(" - ")[0])
      .find((nombre) => /[áéíóú]/i.test(nombre))!;
    expect(especieConTilde).toBeDefined();

    await test.step("BP-05.1: buscar por nombre, coincidencias parciales y sin tildes", async () => {
      function sinTildes(nombre: string) {
        return nombre.toLocaleLowerCase("es").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }

      const coincidencias = publicaciones.filter((publicacion) =>
        sinTildes(publicacion.nombre).includes(sinTildes(especieConTilde)),
      );
      expect(coincidencias.length).toBeLessThan(publicaciones.length);

      await busqueda.fill(especieConTilde);
      await comprobarResultados(coincidencias);

      await busqueda.fill(especieConTilde.normalize("NFD").replace(/[\u0300-\u036f]/g, ""));
      await comprobarResultados(coincidencias);

      const nombreParcial = especieConTilde.slice(0, -1);
      await busqueda.fill(nombreParcial);
      await comprobarResultados(publicaciones.filter((publicacion) =>
        sinTildes(publicacion.nombre).includes(sinTildes(nombreParcial)),
      ));

      await busqueda.fill("producto-inexistente-bp-05");
      await comprobarResultados([]);

      await busqueda.fill("");
      await comprobarResultados(publicaciones);
    });

    await test.step("BP-05.2: aplicar y combinar filtros avanzados", async () => {
      if (pantalla.nombre === "móvil") {
        await page.getByRole("button", { name: "Más filtros" }).click();
      }

      // Probamos cada límite por separado y luego un rango inclusivo.
      const precios = [...new Set(publicaciones.map((publicacion) => publicacion.precio)
        .filter((precio): precio is number => precio !== null))].sort((a, b) => a - b);
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
      await expect.poll(async () => (await leerPublicaciones()).map((publicacion) => publicacion.precio))
        .toEqual(publicaciones.filter((publicacion) => publicacion.precio !== null && publicacion.precio >= limite)
          .map((publicacion) => publicacion.precio!).sort((a, b) => b - a));
      await precioMinimo.fill("");
      await ordenar("A-Z");
      await comprobarResultados(publicaciones);

      // Categoría y calibre también se pueden aplicar sin seleccionar especie.
      await seleccionar("Categoría", producto.categoria);
      await comprobarResultados(publicaciones.filter((publicacion) => publicacion.categoria === producto.categoria));
      await seleccionar("Categoría", "Todas");
      await comprobarResultados(publicaciones);

      await seleccionar("Calibre", producto.calibre);
      await comprobarResultados(publicaciones.filter((publicacion) => publicacion.calibre === producto.calibre));
      await seleccionar("Calibre", "Todos");
      await comprobarResultados(publicaciones);

      await seleccionar("Especie", especie);
      let esperadas = publicaciones.filter((publicacion) => publicacion.nombre.split(" - ")[0] === especie);
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
      await comprobarResultados(esperadas.filter((publicacion) =>
        publicacion.precio !== null && publicacion.precio >= producto.precio!,
      ));

      await precioMinimo.fill("");
      await precioMaximo.fill(String(producto.precio));
      await comprobarResultados(esperadas.filter((publicacion) =>
        publicacion.precio !== null && publicacion.precio <= producto.precio!,
      ));

      await precioMinimo.fill(String(producto.precio));
      esperadas = esperadas.filter((publicacion) => publicacion.precio === producto.precio);
      await comprobarResultados(esperadas);

      // La búsqueda y el ordenamiento conservan los filtros seleccionados.
      await busqueda.fill(especie);
      await ordenar("Mayor Precio");
      await comprobarResultados(esperadas);

      await precioMaximo.fill("");
      await precioMinimo.fill(String(Math.max(...publicaciones.map((publicacion) => publicacion.precio ?? 0)) + 1));
      await comprobarResultados([]);

      await page.getByRole("button", { name: "Limpiar filtros" }).click();
      await expect(busqueda).toHaveValue("");
      await expect(precioMinimo).toHaveValue("");
      await expect(precioMaximo).toHaveValue("");
      for (const campo of ["Especie", "Variedad", "Presentación", "Categoría"]) {
        await expect(page.getByRole("combobox", { name: campo, exact: true })).toHaveText("Todas");
      }
      await expect(page.getByRole("combobox", { name: "Calibre", exact: true })).toHaveText("Todos");
      await comprobarResultados(publicaciones);
    });

    await test.step("BP-05.3: ordenar por precio y alfabéticamente", async () => {
      const precios = publicaciones.map((publicacion) => publicacion.precio)
        .filter((precio): precio is number => precio !== null);
      expect(new Set(precios).size).toBeGreaterThan(1);
      const sinPrecio = publicaciones.length - precios.length;

      for (const opcion of ["Menor Precio", "Mayor Precio"]) {
        await ordenar(opcion);
        await expect(tarjetas).toHaveCount(publicaciones.length);
        const esperados = [...precios].sort((a, b) => opcion === "Menor Precio" ? a - b : b - a);
        await expect.poll(async () => (await leerPublicaciones()).map((publicacion) => publicacion.precio))
          .toEqual([...esperados, ...Array<null>(sinPrecio).fill(null)]);
      }

      const alfabeticas = [...publicaciones].sort((a, b) => {
        const [especieA, variedadA = "-"] = a.nombre.split(" - ");
        const [especieB, variedadB = "-"] = b.nombre.split(" - ");
        return especieA.localeCompare(especieB, "es", { sensitivity: "base" })
          || variedadA.localeCompare(variedadB, "es", { sensitivity: "base" });
      });

      await ordenar("A-Z");
      await comprobarResultados(alfabeticas);
      await ordenar("Z-A");
      await expect(tarjetas.getByRole("heading")).toHaveText(alfabeticas.map((publicacion) => publicacion.nombre).reverse());

      await ordenar("Sin ordenar");
      await comprobarResultados(publicacionesSinOrdenar);

      await ordenar("Z-A");
      await page.getByRole("button", { name: "Limpiar filtros" }).click();
      await comprobarResultados(alfabeticas);

      await busqueda.fill("producto-inexistente-bp-05");
      await ordenar("Mayor Precio");
      await comprobarResultados([]);
      await page.getByRole("button", { name: "Limpiar filtros" }).click();
      await comprobarResultados(alfabeticas);
    });
  });
}
