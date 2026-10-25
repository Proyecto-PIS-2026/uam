import "dotenv/config";
import { readdirSync } from "node:fs";

import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import postgres from "@prisma/orm-postgres/runtime";
import { all } from "@prisma/orm-postgres/orm-client";

import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };
import { cargarConsultaUam, type ConsultaUam } from "./catalogo-consulta";
import { crearOfertasDemo, type OfertaDemo } from "./ofertas-demo";
import { crearOfertasProductoresDemo } from "./ofertas-productores-demo";

const prisma = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL!,
});

const codigosPais: Record<string, string> = {
  ARGENTINA: "AR",
  BOLIVIA: "BO",
  BRASIL: "BR",
  CHILE: "CL",
  ECUADOR: "EC",
  EGIPTO: "EG",
  ESPAÑA: "ES",
  PARAGUAY: "PY",
  PERU: "PE",
  URUGUAY: "UY",
};

const nombresCalibre: Record<string, string> = {
  C: "CHICO",
  EG: "EXTRAGRANDE",
  G: "GRANDE",
  M: "MEDIANO",
  SV: "SIN VARIACIÓN",
};

const nombresUnidad: Record<string, string> = {
  CAB: "Cabeza",
  DOC: "Docena",
  KG: "Kilogramo",
  Unidad: "Unidad",
};

type LocalDemo = { nave: string; numero: string; finContrato: string | null };
type OperadorDemo = {
  username: string;
  passwordHash: string;
  nombreFantasia: string;
  whatsApp: string;
  locales: LocalDemo[];
};
type ProductorDemo = {
  username: string;
  passwordHash: string;
  nombreFantasia: string;
  whatsApp: string;
  pais: string;
  ubicacionNombre: string;
  ubicacionUrl: string;
};

// Cuentas ficticias para operadores
const operadores: OperadorDemo[] = [
  {
    username: "jorge_ferias",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$K4IA1fPuZ+wv52EpTs1TKw$t6qq7i1RXCFvBL8ynMDqygSzkZyAmYfg7sNuuUOp89g",
    nombreFantasia: "Jorge Ferias",
    whatsApp: "+598901",
    locales: [{ nave: "E", numero: "141", finContrato: null }],
  },
  {
    username: "pablo_sappa",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$MAEH2MceCsjnUe6cwEEURA$te2PRZyGC7GWqYgC6PCgovCI4gwEn/ZL4RoGtDQ78wA",
    nombreFantasia: "Pablo Sappa",
    whatsApp: "+598902",
    locales: [{ nave: "E", numero: "133", finContrato: null }],
  },
  {
    username: "diego_figueroa",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$ibPWvwk23j0DcJ839kJbCA$SRrZLg1UukNZmAoDYCZlA/DJkJe6cLAqpa0yJN6k/50",
    nombreFantasia: "Diego Figueroa",
    whatsApp: "+598903",
    locales: [{ nave: "E", numero: "145", finContrato: null }],
  },
  {
    username: "bacigalupi",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$s/tJmTFhqgoLLVSerY0/uQ$IRGzM/96Z/Hv479Ehdp0/7jL9mWFaFh40kmdG9b0HvM",
    nombreFantasia: "Bacigalupi",
    whatsApp: "+598904",
    locales: [{ nave: "E", numero: "153", finContrato: null }],
  },
  {
    username: "lucas_blanco",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$cEA05xUnAtO8XVj2QcSr9w$88hDMm4BhNpj00sH6JG1j++s+KQaaVqtS9EWiezAnFw",
    nombreFantasia: "Lucas Blanco",
    whatsApp: "+598905",
    locales: [{ nave: "E", numero: "155", finContrato: null }],
  },
  {
    username: "britos_hns",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$kXL+RQyLagCeFvt6r46/YA$sm9g277w7Rg4OeMvgR6EyrZIQdFQDMEa87NNj1muMs0",
    nombreFantasia: "Britos HNS",
    whatsApp: "+598906",
    locales: [{ nave: "B", numero: "145", finContrato: null }],
  },
  {
    username: "ciro_gentile",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$wp+H0TFEtFvYNUXI74NhBQ$Y+4EUQ5qUptk4YxeXpj5oSyvDb+7SVTpJfqhQkT1F1E",
    nombreFantasia: "Ciro Gentile",
    whatsApp: "+598907",
    locales: [{ nave: "A", numero: "067", finContrato: null }],
  },
  {
    username: "guarino",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$SiPsuyJseyZYMDe8MB8tmw$19M1jlWHvnDhQtpbzObwIsCExx9abwy3U6jmQMfWhcY",
    nombreFantasia: "Guarino",
    whatsApp: "+598908",
    locales: [{ nave: "D", numero: "104", finContrato: null }],
  },
  {
    username: "pizzorno",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$8iblwtvtgMvzvciqCdxHgw$fOV0uuuPMiSQuzR0ptMXKeKDOJr7ZrSWWt70A22jysc",
    nombreFantasia: "Pizzorno",
    whatsApp: "+598909",
    locales: [{ nave: "B", numero: "146", finContrato: null }],
  },
  {
    username: "don_juan",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$eP2CcV5iF0kGSKbXC3NL6Q$xy3wUpU9cxoZ8OwnDcHdzmp7qjd+ErIGy7AkvguOUVk",
    nombreFantasia: "Don Juan",
    whatsApp: "+598910",
    locales: [{ nave: "D", numero: "073", finContrato: null }],
  },
  {
    username: "caporale",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$+SmLY7VYyYOCIqMpRK3nxw$1Bn3l13o3mf/DUK9Q73RYgZ34r0EJ8hBBGw4fGt1bGs",
    nombreFantasia: "Caporale",
    whatsApp: "+598911",
    locales: [{ nave: "B", numero: "022", finContrato: null }],
  },
  {
    username: "punto_natural",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$M7xzr88jeWqVW7I2w/ll0g$q8DJV7/GgMB8v0EFAqtIlT1QG8BlLtI/J392pBshgt8",
    nombreFantasia: "Punto Natural",
    whatsApp: "+598912",
    locales: [{ nave: "A", numero: "114", finContrato: null }],
  },
  {
    username: "pepe",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$iLAhvm1ZfOBPmjbqKetp+A$Sg4bfwglcDLPd21F79qQAuoFuMrtIBW8TOejAR1zAXs",
    nombreFantasia: "Pepe",
    whatsApp: "+598913",
    locales: [{ nave: "B", numero: "129", finContrato: null }],
  },
  {
    username: "sandias_de_rivera",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$9e5EcKR4CIEBPlrudekZGg$+YJ57x4Csd89F4KduAi8rV1tv6okOrSbKmr4egqEmQo",
    nombreFantasia: "Sandias de Rivera",
    whatsApp: "+598914",
    locales: [{ nave: "Tinglado", numero: "N10", finContrato: null }],
  },
  {
    username: "citricola_salto_grande",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$MlFfwYUza0xMHH2RQpnrzQ$b+DeIlmkKBgm63h6xbGXSXL2tMw9h8rYVevsmIBb6xk",
    nombreFantasia: "Citricola Salto Grande",
    whatsApp: "+598915",
    locales: [{ nave: "A", numero: "025", finContrato: null }],
  },
];

// Cuentas ficticias de productores: cinco de Uruguay y una de Ecuador.
// Contrase?a de demostraci?n de cada cuenta: su username seguido de 123.
const productores: ProductorDemo[] = [
  {
    username: "productor_norte_salto",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$r8FWOPWH8przF2hXAjO0qw$SmSPTM6BPmSA0jkdENdN8uJQpQLYhJawXXgwALnyhdA",
    nombreFantasia: "Citrícola Salto Norte",
    whatsApp: "+5989201",
    pais: "URUGUAY",
    ubicacionNombre: "Ruta 3 km 500, Salto",
    ubicacionUrl: "https://goo.gl/maps/salto1",
  },
  {
    username: "productor_canelones_verde",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$SLF1W8e9+mVlRQsuPDn/KA$sG1U78dT2h9T7r/bBmJGxujpgDb0ekWNRS+MFPw3ONU",
    nombreFantasia: "Finca Canelones Verde",
    whatsApp: "+5989202",
    pais: "URUGUAY",
    ubicacionNombre: "Camino Vecinal s/n, Canelones",
    ubicacionUrl: "https://goo.gl/maps/canelones1",
  },
  {
    username: "productor_san_jose_agro",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$syrG2rc/YnqA5GWdrQ1LwQ$Jbuqy5uyTh+gpVJ7iK/SlhtQnrGXbxf5u9X632o61AQ",
    nombreFantasia: "Agro San José",
    whatsApp: "+5989203",
    pais: "URUGUAY",
    ubicacionNombre: "Ruta 1 km 45, San José",
    ubicacionUrl: "https://goo.gl/maps/sanjose1",
  },
  {
    username: "productor_tacuarembo_frut",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$hSBPTiyItcVXUrDBo6Ri0w$oJdYxOiaT/bxbqV0VJfmIsGIFn1Ct9CNhYovoIDY8fk",
    nombreFantasia: "Frutas Tacuarembó",
    whatsApp: "+5989204",
    pais: "URUGUAY",
    ubicacionNombre: "Ruta 5 km 380, Tacuarembó",
    ubicacionUrl: "https://goo.gl/maps/tacuarembo1",
  },
  {
    username: "productor_maldonado_organico",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$0CDoB3lRSSvd8YobFcr/8A$tTMwF0CFe1r1pinmCypzlL0u9IGbVQ/KD7xoTvrkkgQ",
    nombreFantasia: "Orgánicos Maldonado",
    whatsApp: "+5989205",
    pais: "URUGUAY",
    ubicacionNombre: "Camino de los Raudales, Maldonado",
    ubicacionUrl: "https://goo.gl/maps/maldonado1",
  },
  {
    username: "bananera_ecuatoriana_sa",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$AU1enfjMXPLU8l2Fu7vQFw$sMLxeZn0bNe1NgR4jJ16w/OToxsGjKwUwnwcbePGQAE",
    nombreFantasia: "Bananera Ecuatoriana S.A.",
    whatsApp: "+593991234567",
    pais: "ECUADOR",
    ubicacionNombre: "Km 14 Vía a Daule, Guayaquil, Ecuador",
    ubicacionUrl: "https://goo.gl/maps/ecuadorbananas",
  },
];

const operadorInhabilitado: OperadorDemo = {
  username: "inhabilitado",
  passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$gsYjd8+zDf3IHr7hvAcfnQ$mOFyOjyASAOdkTDem0CjhQeshmx8AnhHNDv48pqDYCA",
  nombreFantasia: "Operador Inhabilitado",
  whatsApp: "+598918",
  locales: [{ nave: "E", numero: "999", finContrato: "2020-12-31T23:59:59Z" }],
};

type KgPorUnidad = Parameters<typeof prisma.orm.public.Presentacion.create>[0]["kgPorUnidad"];
type PrecioPublicacion = Parameters<typeof prisma.orm.public.Publicacion.create>[0]["precio"];

function clave(...partes: Array<string | number>): string {
  return JSON.stringify(partes);
}

function cantidadUnidadesDemo(indice: number, unidad: string): number | null {
  if (indice % 4 !== 0) return null;

  const variacion = Math.floor(indice / 4) % 5;
  if (unidad === "KG") return 100 + variacion * 50;
  if (unidad === "DOC") return 12 + variacion * 6;
  if (unidad === "CAB") return 40 + variacion * 20;
  return 20 + variacion * 10;
}

function idRequerido(mapa: Map<string, number>, llave: string, descripcion: string): number {
  const id = mapa.get(llave);
  if (id === undefined) throw new Error(`No se encontró ${descripcion} en el catálogo de la seed.`);
  return id;
}

function validarOperadores(ofertas: OfertaDemo[]): void {
  if (ofertas.length > 75) throw new Error(`La seed supera el máximo de 75 publicaciones: ${ofertas.length}`);
  const usuarios = new Set<string>();
  const nombres = new Set<string>();
  const ubicaciones = new Set<string>();

  for (const operador of operadores) {
    if (usuarios.has(operador.username)) throw new Error(`Usuario de operador duplicado: ${operador.username}`);
    if (nombres.has(operador.nombreFantasia)) throw new Error(`Nombre de operador duplicado: ${operador.nombreFantasia}`);
    if (operador.locales.length === 0) throw new Error(`El operador ${operador.nombreFantasia} no tiene local`);
    usuarios.add(operador.username);
    nombres.add(operador.nombreFantasia);

    for (const local of operador.locales) {
      const ubicacion = clave(local.nave, local.numero);
      if (ubicaciones.has(ubicacion)) throw new Error(`Local duplicado: ${local.nave} ${local.numero}`);
      ubicaciones.add(ubicacion);
    }
  }

  const usuariosConOfertas = new Set(ofertas.map((oferta) => oferta.operatorUsername));
  const usuariosConOfertasVisibles = new Set(ofertas.filter((oferta) => oferta.active && oferta.available).map((oferta) => oferta.operatorUsername));
  for (const username of usuariosConOfertas) {
    if (!usuarios.has(username)) throw new Error(`La oferta pertenece a un operador inexistente: ${username}`);
  }
  for (const username of usuarios) {
    if (!usuariosConOfertas.has(username)) throw new Error(`El operador ${username} no tiene publicaciones`);
    if (!usuariosConOfertasVisibles.has(username)) throw new Error(`El operador ${username} no tiene publicaciones visibles`);
  }
}

function archivosGenericos(): Set<string> {
  try {
    return new Set(readdirSync(new URL("../../../../public/generico/", import.meta.url)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
}

function fotoGenerica(nombreEspecie: string, archivos: Set<string>): string | null {
  const base = nombreEspecie.toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  for (const extension of [".webp", ".png", ".jpg"]) {
    const archivo = `${base}${extension}`;
    if (archivos.has(archivo)) return `/generico/${archivo}`;
  }
  return null;
}

function fotosPublicacionesDemo(consulta: ConsultaUam, ofertas: OfertaDemo[]): Map<string, string> {
  const nombresPorEspecie = new Map(consulta.types.flatMap((tipo) =>
    tipo.products.map((producto) => [producto.species_id, producto.species] as const)
  ));
  const archivos = new Set(readdirSync(new URL("../../../../public/publicaciones-demo/", import.meta.url)));
  const fotos = new Map<string, string>();
  const nombresUsados = new Set<string>();
  const nombreArchivo = (texto: string) => texto.toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  for (const oferta of ofertas) {
    const especie = nombresPorEspecie.get(oferta.speciesId);
    if (!especie) throw new Error(`No se encontró la especie ${oferta.speciesId} para su foto de publicación.`);

    const producto = oferta.variety === "-" ? especie : `${especie} ${oferta.variety}`;
    const categoria = oferta.category === "-" ? "sin-categoria" : oferta.category;
    const archivo = [oferta.operatorUsername, producto, oferta.measureUnit, oferta.caliber, categoria, oferta.country]
      .map(nombreArchivo).join("--") + ".webp";
    const llave = clave(oferta.operatorUsername, oferta.speciesId, oferta.variety,
      oferta.measureUnit, oferta.caliber, oferta.category, oferta.country);
    if (fotos.has(llave)) throw new Error(`La oferta ${producto} de ${oferta.operatorUsername} está duplicada.`);
    if (nombresUsados.has(archivo)) throw new Error(`Dos publicaciones comparten la foto ${archivo}.`);
    if (!archivos.has(archivo)) throw new Error(`Falta la foto de demostración ${archivo} para ${producto}.`);
    nombresUsados.add(archivo);
    fotos.set(llave, `/publicaciones-demo/${archivo}`);
  }

  return fotos;
}

function archivosOperadores(): Map<string, string> {
  try {
    const archivos = readdirSync(new URL("../../../../public/operadores/", import.meta.url));
    return new Map(archivos.map((archivo) => [archivo.toLocaleLowerCase("es"), archivo]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
}

function fotoOperador(nombreOperador: string, archivos: Map<string, string>): string | null {
  const base = nombreOperador.toLocaleLowerCase("es")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  for (const extension of [".webp", ".jpeg", ".jpg", ".png", ".jfif"]) {
    const archivo = archivos.get(`${base}${extension}`);
    if (archivo) return `/operadores/${encodeURIComponent(archivo)}`;
  }
  return null;
}

function validarFuente(consulta: ConsultaUam): Map<string, number> {
  const kilosPorUnidad = new Map<string, number>();

  for (const tipo of consulta.types) {
    for (const producto of tipo.products) {
      for (const variedad of producto.varieties) {
        for (const presentacion of variedad.presentations) {
          if (!codigosPais[presentacion.country]) {
            throw new Error(`País sin código ISO en la seed: ${presentacion.country}`);
          }
          const llave = clave(producto.species_id, variedad.variety, presentacion.measure_unit);
          for (const banda of presentacion.prices) {
            const conversionMinima = banda.min_un / banda.min_kg;
            const conversionMaxima = banda.max_un / banda.max_kg;
            const conversionAnterior = kilosPorUnidad.get(llave);
            if (Math.abs(conversionMinima - conversionMaxima) > 0.000001 ||
                (conversionAnterior !== undefined && Math.abs(conversionAnterior - conversionMinima) > 0.000001)) {
              throw new Error(`Conversión kg/unidad incoherente para ${producto.species} / ${variedad.variety} / ${presentacion.measure_unit}`);
            }
            kilosPorUnidad.set(llave, conversionMinima);
          }
        }
      }
    }
  }

  return kilosPorUnidad;
}

function pesoRepresentable(peso: number): KgPorUnidad {
  const centesimos = Math.round(peso * 100);
  if (Math.abs(peso * 100 - centesimos) > 0.000001) return null;
  return (centesimos / 100).toFixed(2) as unknown as KgPorUnidad;
}

async function limpiarBase() {
  await prisma.orm.public.Imagen.where(() => all()).deleteAll();
  await prisma.orm.public.Notificacion.where(() => all()).deleteAll();
  await prisma.orm.public.PublicacionOperador.where(() => all()).deleteAll();
  await prisma.orm.public.PublicacionProductor.where(() => all()).deleteAll();
  await prisma.orm.public.Ubicacion.where(() => all()).deleteAll();
  await prisma.orm.public.Publicacion.where(() => all()).deleteAll();
  await prisma.orm.public.Local.where(() => all()).deleteAll();
  await prisma.orm.public.Nave.where(() => all()).deleteAll();
  await prisma.orm.public.Operador.where(() => all()).deleteAll();
  await prisma.orm.public.Productor.where(() => all()).deleteAll();
  await prisma.orm.public.Administrador.where(() => all()).deleteAll();
  await prisma.orm.public.Usuario.where(() => all()).deleteAll();
  await prisma.orm.public.Presentacion.where(() => all()).deleteAll();
  await prisma.orm.public.Variedad.where(() => all()).deleteAll();
  await prisma.orm.public.Categoria.where(() => all()).deleteAll();
  await prisma.orm.public.HistoricoPrecios.where(() => all()).deleteAll();
  await prisma.orm.public.Especie.where(() => all()).deleteAll();
  await prisma.orm.public.Calibre.where(() => all()).deleteAll();
  await prisma.orm.public.Pais.where(() => all()).deleteAll();
  await prisma.orm.public.Configuracion.where(() => all()).deleteAll();
}

async function crearDatosBase(consulta: ConsultaUam) {
  const paises = new Set<string>();
  const calibres = new Set<string>();
  for (const tipo of consulta.types) {
    for (const producto of tipo.products) {
      for (const variedad of producto.varieties) {
        for (const presentacion of variedad.presentations) {
          paises.add(presentacion.country);
          calibres.add(presentacion.caliber);
        }
      }
    }
  }
  paises.add("ECUADOR");

  const paisIds = new Map<string, number>();
  for (const nombrePais of [...paises].sort()) {
    const pais = await prisma.orm.public.Pais.create({ codigoPais: codigosPais[nombrePais], nombrePais });
    paisIds.set(nombrePais, pais.id);
  }

  const calibreIds = new Map<string, number>();
  for (const codigoCalibre of [...calibres].sort()) {
    const calibre = await prisma.orm.public.Calibre.create({ codigoCalibre, nombreCalibre: nombresCalibre[codigoCalibre] });
    calibreIds.set(codigoCalibre, calibre.id);
  }

  return { paisIds, calibreIds };
}

async function crearCatalogo(consulta: ConsultaUam, conversiones: Map<string, number>, archivos: Set<string>) {
  const presentacionIds = new Map<string, number>();
  const categoriaIds = new Map<string, number>();
  let cantidadVariedades = 0;

  for (const tipo of consulta.types) {
    for (const producto of tipo.products) {
      const foto = fotoGenerica(producto.species, archivos);
      const especie = await prisma.orm.public.Especie.create({
        uamId: producto.species_id,
        nombreEspecie: producto.species,
        especieActiva: true,
        fotoEspecie: foto,
      });

      const codigosCategoria = new Set<string>();
      for (const variedad of producto.varieties) {
        for (const presentacion of variedad.presentations) {
          for (const banda of presentacion.prices) codigosCategoria.add(banda.category);
        }
      }
      for (const nombreCategoria of [...codigosCategoria].sort()) {
        const categoria = await prisma.orm.public.Categoria.create({ nombreCategoria, especieId: especie.id });
        categoriaIds.set(clave(producto.species_id, nombreCategoria), categoria.id);
      }

      for (const variedadFuente of producto.varieties) {
        const variedad = await prisma.orm.public.Variedad.create({
          uamId: null,
          nombreVariedad: variedadFuente.variety,
          variedadActiva: true,
          especieId: especie.id,
        });
        cantidadVariedades++;

        const unidades = [...new Set(variedadFuente.presentations.map((presentacion) => presentacion.measure_unit))];
        const unidadPredeterminada = unidades.includes("KG") ? "KG" : unidades[0];
        for (const unidad of unidades) {
          const llave = clave(producto.species_id, variedadFuente.variety, unidad);
          const peso = conversiones.get(llave) ?? 1.0;
          const presentacion = await prisma.orm.public.Presentacion.create({
            uamId: null,
            nombrePresentacion: nombresUnidad[unidad] ?? "Kilogramo",
            kgPorUnidad: pesoRepresentable(peso),
            presentacionActiva: true,
            presentacionDefault: unidad === unidadPredeterminada,
            variedadId: variedad.id,
          });
          presentacionIds.set(llave, presentacion.id);
        }
      }
    }
  }

  return { presentacionIds, categoriaIds, cantidadVariedades };
}

async function crearOperadores(archivos: Map<string, string>) {
  const todosLosOperadores = [...operadores, operadorInhabilitado];
  const nombresNave = new Set(todosLosOperadores.flatMap((operador) => operador.locales.map((local) => local.nave)));
  for (const nombreNave of nombresNave) {
    await prisma.orm.public.Nave.create({ nombreNave });
  }

  const usuarioAdmin = await prisma.orm.public.Usuario.create({
    username: "admin",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$TMmigWv06+Qfpv1bxHmq6A$MjIMGIDYAfta6dqwmaaPAI3R88r7OXrwBN4xZGk7ZQk",
    rol: "ADMINISTRADOR",
    twoFactorEnabled: false,
  });
  await prisma.orm.public.Administrador.create({ usuarioId: usuarioAdmin.id, email: "admin@uam.com.uy" });

  for (const datos of productores) {
    const usuario = await prisma.orm.public.Usuario.create({
      username: datos.username,
      passwordHash: datos.passwordHash,
      rol: "PRODUCTOR",
      twoFactorEnabled: false,
    });
    await prisma.orm.public.Productor.create({
      usuarioId: usuario.id,
      nombreFantasia: datos.nombreFantasia,
      whatsApp: datos.whatsApp,
    });
  }

  const naveIds = new Map<string, number>();
  for (const nave of await prisma.orm.public.Nave.all()) naveIds.set(nave.nombreNave, nave.id);

  const operadorIds = new Map<string, number>();
  for (const datos of todosLosOperadores) {
    const usuario = await prisma.orm.public.Usuario.create({
      username: datos.username,
      passwordHash: datos.passwordHash,
      rol: "OPERADOR",
      twoFactorEnabled: false,
    });
    const operador = await prisma.orm.public.Operador.create({
      usuarioId: usuario.id,
      nombreFantasia: datos.nombreFantasia,
      fotoPerfil: fotoOperador(datos.nombreFantasia, archivos),
      enLicencia: false,
      comentario: null,
      whatsApp: datos.whatsApp,
    });
    operadorIds.set(datos.username, operador.id);

    for (const local of datos.locales) {
      await prisma.orm.public.Local.create({
        numeroLocal: local.numero,
        finContrato: local.finContrato === null ? null : Temporal.Instant.from(local.finContrato),
        operadorId: operador.id,
        naveId: idRequerido(naveIds, local.nave, `nave ${local.nave}`),
      });
    }
  }

  return operadorIds;
}

async function main() {
  const consulta = cargarConsultaUam();
  const conversiones = validarFuente(consulta);
  const ofertas = crearOfertasDemo(consulta);
  const ofertasProductores = crearOfertasProductoresDemo(consulta);
  validarOperadores(ofertas);
  const fotosPublicaciones = fotosPublicacionesDemo(consulta, ofertas);
  const archivos = archivosGenericos();
  const fotosOperadores = archivosOperadores();

  console.log(`Cargando catálogo de la consulta UAM del ${consulta.survey_date}...`);
  await limpiarBase();

  const { paisIds, calibreIds } = await crearDatosBase(consulta);
  const { presentacionIds, categoriaIds, cantidadVariedades } =
    await crearCatalogo(consulta, conversiones, archivos);
  const operadorIds = await crearOperadores(fotosOperadores);
  const clasificaciones = new Map((await prisma.orm.public.Presentacion
    .include("variedad", (variedad) => variedad.select("id", "especieId"))
    .all()).map((presentacion) => [presentacion.id, presentacion.variedad]));

  let conPrecio = 0;
  let sinPrecio = 0;
  let noDisponibles = 0;
  let inactivas = 0;

  // Insertar publicaciones de operadores existentes
  for (const [indice, oferta] of ofertas.entries()) {
    const operadorId = idRequerido(operadorIds, oferta.operatorUsername, `operador ${oferta.operatorUsername}`);
    const presentacionId = idRequerido(presentacionIds,
      clave(oferta.speciesId, oferta.variety, oferta.measureUnit), "presentación");
    const categoriaId = idRequerido(categoriaIds,
      clave(oferta.speciesId, oferta.category), "categoría");
    const calibreId = idRequerido(calibreIds, oferta.caliber, `calibre ${oferta.caliber}`);
    const paisId = idRequerido(paisIds, oferta.country, `país ${oferta.country}`);
    const precio = oferta.price === null
      ? null
      : oferta.price.toFixed(2) as unknown as PrecioPublicacion;
    const foto = fotosPublicaciones.get(clave(oferta.operatorUsername, oferta.speciesId, oferta.variety,
      oferta.measureUnit, oferta.caliber, oferta.category, oferta.country));
    if (!foto) throw new Error(`No se encontró la foto de la publicación ${oferta.speciesId} / ${oferta.variety}.`);

    const publicacion = await prisma.orm.public.Publicacion.create({
      fecha: Temporal.Instant.fromEpochMilliseconds(Date.now() - (indice % 15) * 86_400_000),
      publicacionDisponible: oferta.available,
      publicacionActiva: oferta.active,
      precio,
      cantidadUnidades: cantidadUnidadesDemo(indice, oferta.measureUnit),
      foto,
      tipoPublicacion: "OPERADOR",
      especieId: clasificaciones.get(presentacionId)!.especieId,
      variedadId: clasificaciones.get(presentacionId)!.id,
      presentacionId,
      categoriaId,
      calibreId,
    });
    await prisma.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId, paisId });

    if (oferta.price === null) sinPrecio++; else conPrecio++;
    if (!oferta.available) noDisponibles++;
    if (!oferta.active) inactivas++;
  }

  // Obtener IDs de productores creados para asociar sus publicaciones y ubicaciones
  const productoresDb = await prisma.orm.public.Productor.all();
  const usuariosDb = await prisma.orm.public.Usuario.all();

  // Crear un mapa para buscar el username de cada usuario por su ID rápidamente
  const usuarioUsernameMap = new Map<number, string>(
    usuariosDb.map((u) => [u.id, u.username])
  );

  const productorIdsMap = new Map<string, number>();
  for (const p of productoresDb) {
    const username = usuarioUsernameMap.get(p.usuarioId);
    if (username) {
      productorIdsMap.set(username, p.id);
    }
  }

  const productoresPorUsername = new Map(productores.map((productor) => [productor.username, productor]));
  const ubicacionesDemo = [
    {
        nombreUbicacion: "Depósito Central - Salto",
        latitud: -31.388,
        longitud: -57.960,
    },
    {
        nombreUbicacion: "Chacra Los Naranjos - Zona Norte",
        latitud: -31.365,
        longitud: -57.955,
    },
    {
        nombreUbicacion: "Empaque Las Quintas - Zona Este",
        latitud: -31.390,
        longitud: -57.930,
    },
    {
        nombreUbicacion: "Depósito El Ombú - Zona Sur",
        latitud: -31.410,
        longitud: -57.950,
    },
  ];

  for (const [indice, oferta] of ofertasProductores.entries()) {
    const prodDemo = productoresPorUsername.get(oferta.producerUsername);
    if (!prodDemo) throw new Error(`Productor de demostración inexistente: ${oferta.producerUsername}`);
    const productorId = idRequerido(productorIdsMap, oferta.producerUsername, `productor ${oferta.producerUsername}`);
    const presentacionId = idRequerido(presentacionIds,
      clave(oferta.speciesId, oferta.variety, oferta.measureUnit), "presentación de productor");
    const categoriaId = idRequerido(categoriaIds,
      clave(oferta.speciesId, oferta.category), "categoría de productor");
    const calibreId = idRequerido(calibreIds, oferta.caliber, `calibre ${oferta.caliber}`);
    const paisId = idRequerido(paisIds, oferta.country, `país ${oferta.country}`);
    const precio = oferta.price === null
      ? null
      : oferta.price.toFixed(2) as unknown as PrecioPublicacion;

    const publicacion = await prisma.orm.public.Publicacion.create({
      fecha: Temporal.Instant.fromEpochMilliseconds(Date.now() - (indice % 12) * 36_000_000),
      publicacionDisponible: oferta.available,
      publicacionActiva: true,
      precio,
      cantidadUnidades: oferta.quantity,
      foto: fotoGenerica(oferta.speciesName, archivos),
      tipoPublicacion: "PRODUCTOR",
      especieId: clasificaciones.get(presentacionId)!.especieId,
      variedadId: clasificaciones.get(presentacionId)!.id,
      presentacionId,
      categoriaId,
      calibreId,
    });

    const publicacionProductor = await prisma.orm.public.PublicacionProductor.create({
      publicacionId: publicacion.id,
      productorId,
      paisId,
    });
    for (const punto of ubicacionesDemo.slice(0, oferta.cantidadUbicaciones)) {
      await prisma.orm.public.Ubicacion.create({
          nombreUbicacion: punto.nombreUbicacion,
          urlMaps: `https://www.google.com/maps?q=${encodeURIComponent(`${punto.latitud},${punto.longitud}`)}`,
          publicacionId: publicacionProductor.id,
      });
    }
  }

  await prisma.orm.public.Configuracion.create({ nombreConfiguracion: "incremento_precio", valorConfiguracion: "10" });
  await prisma.orm.public.Configuracion.create({ nombreConfiguracion: "fecha_consulta_catalogo", valorConfiguracion: consulta.survey_date });
  await prisma.orm.public.Configuracion.create({ nombreConfiguracion: "url_lista_inteligente", valorConfiguracion: "https://uam.com.uy/wp-content/uploads/2026/09/MGAP_Lista_Inteligente_PDF-1.pdf"});

  console.table({
    especies: consulta.types.reduce((total, tipo) => total + tipo.products.length, 0),
    variedades: cantidadVariedades,
    presentaciones: presentacionIds.size,
    paises: paisIds.size,
    calibres: calibreIds.size,
    operadores: operadorIds.size,
    productores: productores.length,
    publicacionesOperadores: ofertas.length,
    publicacionesProductores: ofertasProductores.length,
    conPrecio,
    sinPrecio,
    noDisponibles,
    inactivas,
  });
  console.log("Seed completada con éxito.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.close();
  });
