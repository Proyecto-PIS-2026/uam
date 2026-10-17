import { test, expect, type Page, type APIRequestContext } from "@playwright/test";
import { iniciarSesionOperador } from "./autenticacion";

const rutaHistoricos = "/precios-historicos?species_id=1&producto=Acelga&variedad=-&pais=URUGUAY&calibre=C&categoria=I";

type Operador = { id: number; nombre: string };

async function obtenerOperadores(request: APIRequestContext): Promise<Operador[]> {
  const respuesta = await request.get("/api/publicaciones");
  expect(respuesta.status()).toBe(200);
  const { operadores } = await respuesta.json();
  expect(operadores.length).toBeGreaterThan(0);
  return operadores;
}

function rutasAdministrativas(operador: Operador) {
  return [
    "/administracion",
    "/alta-usuario",
    `/gestion-operadores/${operador.id}`,
    `/gestion-operadores/${operador.id}/editar`,
  ];
}

async function iniciarSesion(page: Page, rol: "PRODUCTOR" | "ADMINISTRADOR") {
  const usuario = process.env[`E2E_${rol}_USU`];
  const contrasena = process.env[`E2E_${rol}_PASS`];
  if (!usuario || !contrasena) {
    throw new Error(`Configure E2E_${rol}_USU y E2E_${rol}_PASS con las credenciales de la seed.`);
  }

  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico o nombre de usuario").fill(usuario);
  await page.getByLabel("Contraseña", { exact: true }).fill(contrasena);
  await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/inicio");
  expect((await page.context().cookies()).some((cookie) => cookie.name === "uam_sesion")).toBe(true);
}

function enlaceAdministracion(page: Page) {
  return page.getByRole("navigation", { name: "Navegación principal", exact: true })
    .getByRole("link", { name: "Administración", exact: true });
}

async function consultarHistoricos(page: Page) {
  await page.goto(rutaHistoricos);
  await expect(page).toHaveURL((url) => url.pathname === "/precios-historicos");
  await expect(page.getByRole("heading", { name: "Histórico de Acelga", exact: true })).toBeVisible();
}

test("BP-04.4 CA-1 CP-01: consultas públicas sin iniciar sesión", async ({ page, context }) => {
  test.slow();

  async function consultar(ruta: string, titulo: string) {
    const respuesta = await page.goto(ruta);
    expect(respuesta?.status()).toBe(200);
    await expect(page).toHaveURL((url) =>
      url.pathname === new URL(ruta, "http://localhost").pathname,
    );
    await expect(page.getByRole("heading", { name: titulo, exact: true, level: 1 }).first()).toBeVisible();
  }

  expect((await context.cookies()).some((cookie) => cookie.name === "uam_sesion")).toBe(false);

  await test.step("Consultar el inicio y descargar la Lista Inteligente", async () => {
    await consultar("/inicio", "Mercado de hoy");

    const enlace = page.getByRole("link", { name: "Lista inteligente", exact: true });
    await expect(enlace).toBeVisible();
    const destino = await enlace.getAttribute("href");
    expect(destino).toBeTruthy();

    const archivo = await page.request.get(destino!);
    expect(archivo.status()).toBe(200);
    expect(archivo.headers()["content-type"]).toContain("application/pdf");
    expect((await archivo.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  await test.step("Consultar precios de referencia e históricos", async () => {
    await consultar("/precios-referencia", "Precios de referencia");
    await expect(page.getByRole("heading", { name: "Listado de Precios de referencia" })).toBeVisible();

    await consultar(
      "/precios-historicos?species_id=1&producto=Acelga&variedad=-&pais=URUGUAY&calibre=C&categoria=I",
      "Histórico de Acelga",
    );
    await expect(page.getByRole("form", { name: "Consultar período histórico" })).toBeVisible();
  });

  await test.step("Consultar el listado y el perfil de un Operador", async () => {
    await consultar("/operadores", "Operadores");

    const operador = page.locator('a[href^="/operadores/"]').first();
    await expect(operador).toBeVisible();
    const nombre = (await operador.locator("p").first().innerText()).trim();
    const ruta = await operador.getAttribute("href");
    expect(ruta).toBeTruthy();
    await consultar(ruta!, nombre);
    await expect(page.getByRole("heading", { name: "Publicaciones", exact: true })).toBeVisible();
  });

  await test.step("Consultar las publicaciones y el detalle de un producto", async () => {
    await consultar("/publicaciones", "Publicaciones");

    const publicacion = page.getByRole("button", { name: /^Ver detalles de / }).first();
    await expect(publicacion).toBeVisible();
    const producto = (await publicacion.getByRole("heading").innerText()).trim();
    await publicacion.click();

    const detalle = page.getByRole("dialog", { name: "Detalle de publicación" });
    await expect(detalle).toBeVisible();
    await expect(detalle).toContainText(producto.split(" - ")[0]);
    await expect(page).toHaveURL((url) => url.pathname === "/publicaciones");
  });

  expect((await context.cookies()).some((cookie) => cookie.name === "uam_sesion")).toBe(false);
});

test("BP-04.4 CA-1 CP-02: funcionalidades protegidas sin sesión", async ({ page, request }) => {
  test.slow();
  const operador = (await obtenerOperadores(request))[0];
  await page.goto("/inicio");
  await expect(enlaceAdministracion(page)).toHaveCount(0);

  const rutas = [
    "/mi-mercado",
    `/mi-mercado/${encodeURIComponent(operador.nombre)}`,
    "/publicaciones/nueva",
    "/mi-mercado/productor",
    ...rutasAdministrativas(operador),
  ];
  for (const ruta of rutas) {
    await test.step(`Solicitar ${ruta} sin sesión`, async () => {
      await page.goto(ruta);
      await expect(page).toHaveURL((url) => url.pathname === "/iniciar-sesion");
      await expect(page.getByRole("button", { name: "Iniciar sesión", exact: true })).toBeVisible();
    });
  }
});

test("BP-04.4 CA-2 CP-03: funcionalidades permitidas al Operador", async ({ page }) => {
  test.slow();
  await iniciarSesionOperador(page);
  const operadores = await obtenerOperadores(page.request);
  expect(operadores).toHaveLength(1);
  const operador = operadores[0];
  const rutaMercado = `/mi-mercado/${encodeURIComponent(operador.nombre)}`;

  await page.goto("/mi-mercado");
  await expect(page).toHaveURL((url) => url.pathname === rutaMercado);
  await page.goto(rutaMercado);
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Nueva publicación" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Aumentar precio" }).first()).toBeEnabled();
  await expect(page.getByRole("button", { name: "Disminuir precio" }).first()).toBeEnabled();
  await expect(page.getByTitle("Editar precio").first()).toBeEnabled();

  await page.getByRole("button", { name: /^Ver detalle de / }).first().click();
  const consulta = page.getByRole("dialog", { name: "Consultar publicación" });
  await expect(consulta).toBeVisible();
  await expect(consulta.getByRole("button", { name: "Editar", exact: true })).toBeEnabled();
  await expect(consulta.getByRole("button", { name: "Eliminar", exact: true })).toBeEnabled();

  await page.goto("/publicaciones/nueva");
  await expect(page).toHaveURL((url) => url.pathname === "/publicaciones/nueva");
  await expect(page.getByRole("dialog", { name: "Nueva publicación" })).toBeVisible();
  await consultarHistoricos(page);
});

test("BP-04.4 CA-2 CP-04: funcionalidades de otros roles para el Operador", async ({ page, request }) => {
  test.slow();
  const operador = (await obtenerOperadores(request))[0];
  await iniciarSesionOperador(page);
  const rutaMercado = new URL(page.url()).pathname;
  await page.goto("/inicio");
  await expect(enlaceAdministracion(page)).toHaveCount(0);

  for (const ruta of rutasAdministrativas(operador)) {
    await test.step(`Rechazar ${ruta} para el Operador`, async () => {
      await page.goto(ruta);
      await expect(page).toHaveURL((url) => url.pathname === rutaMercado);
    });
  }
  await page.goto("/mi-mercado/productor");
  await expect(page).toHaveURL((url) => url.pathname === "/inicio");
});

test("BP-04.4 CA-3 CP-05: funcionalidades permitidas al Productor", async ({ page }) => {
  await iniciarSesion(page, "PRODUCTOR");
  await page.goto("/mi-mercado/productor");
  await expect(page).toHaveURL((url) => url.pathname === "/mi-mercado/productor");
  await expect(page.getByRole("heading", { name: "Mi Mercado", exact: true })).toBeVisible();
  await consultarHistoricos(page);
});

test("BP-04.4 CA-3 CP-06: funcionalidades de otros roles para el Productor", async ({ page, request }) => {
  test.slow();
  const operador = (await obtenerOperadores(request))[0];
  await iniciarSesion(page, "PRODUCTOR");
  await expect(enlaceAdministracion(page)).toHaveCount(0);

  const rutas = [
    "/mi-mercado",
    `/mi-mercado/${encodeURIComponent(operador.nombre)}`,
    "/publicaciones/nueva",
    ...rutasAdministrativas(operador),
  ];
  for (const ruta of rutas) {
    await test.step(`Rechazar ${ruta} para el Productor`, async () => {
      await page.goto(ruta);
      await expect(page).toHaveURL((url) => url.pathname === "/inicio");
    });
  }
});

test("BP-04.4 CA-4 CP-07: funcionalidades permitidas al Administrador", async ({ page, request }) => {
  test.slow();
  const operador = (await obtenerOperadores(request))[0];
  await iniciarSesion(page, "ADMINISTRADOR");
  await expect(enlaceAdministracion(page)).toBeVisible();
  await enlaceAdministracion(page).click();
  await expect(page).toHaveURL((url) => url.pathname === "/administracion");
  await expect(page.getByRole("heading", { name: "Panel Administrativo", exact: true })).toBeVisible();

  const pantallas = [
    { ruta: "/alta-usuario", titulo: "Alta de usuario" },
    { ruta: `/gestion-operadores/${operador.id}`, titulo: operador.nombre },
    { ruta: `/gestion-operadores/${operador.id}/editar`, titulo: "Modificar operador" },
  ];
  for (const { ruta, titulo } of pantallas) {
    await test.step(`Consultar ${ruta} como Administrador`, async () => {
      const respuesta = await page.goto(ruta);
      expect(respuesta?.status()).toBe(200);
      await expect(page).toHaveURL((url) => url.pathname === ruta);
      await expect(page.getByRole("heading", { name: titulo, exact: true })).toBeVisible();
    });
  }
  await consultarHistoricos(page);
});

test("BP-04.4 CA-4 CP-08: funcionalidades de Operador para el Administrador", async ({ page }) => {
  await iniciarSesion(page, "ADMINISTRADOR");
  await page.goto("/publicaciones/nueva");
  await expect(page).toHaveURL((url) => url.pathname === "/inicio");
  await expect(page.getByRole("dialog", { name: "Nueva publicación" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Aumentar precio" })).toHaveCount(0);
});

test("BP-04.4 CA-5 CP-09: mercado de otro Operador", async ({ page, request, browser }) => {
  test.slow();
  const operadores = await obtenerOperadores(request);
  await iniciarSesionOperador(page);
  const [propio] = await obtenerOperadores(page.request);
  const ajeno = operadores.find((operador) => operador.nombre === "Jorge Ferias");
  expect(ajeno).toBeDefined();
  expect(ajeno!.id).not.toBe(propio.id);

  const visitante = await browser.newPage();
  try {
    await visitante.goto(new URL(`/operadores/${encodeURIComponent(ajeno!.nombre)}`, page.url()).toString());
    const publicacion = visitante.getByRole("button", { name: /^Ver detalles de / }).first();
    await expect(publicacion).toBeVisible();
    const nombre = await publicacion.getByRole("heading").innerText();
    const precio = await publicacion.getByText(/^(\$\s*[\d.,]+|Consultar precio)$/).first().innerText();

    try {
      await page.goto(`/mi-mercado/${encodeURIComponent(ajeno!.nombre)}`);
      await expect(page).toHaveURL((url) => url.pathname === "/inicio");
      await expect(page.getByRole("dialog", { name: "Consultar publicación" })).toHaveCount(0);
    } finally {
      await visitante.reload();
      await expect(publicacion.getByRole("heading")).toHaveText(nombre);
      await expect(publicacion.getByText(/^(\$\s*[\d.,]+|Consultar precio)$/).first()).toHaveText(precio);
    }
  } finally {
    await visitante.close();
  }
});
