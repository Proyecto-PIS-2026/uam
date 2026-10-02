import "dotenv/config";
import { readdirSync } from "node:fs";

import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import postgres from "@prisma/orm-postgres/runtime";
import { all } from "@prisma/orm-postgres/orm-client";

import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };
import { cargarConsultaUam, type ConsultaUam } from "./catalogo-consulta";
import { crearOfertasDemo } from "./ofertas-demo";

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

const departamentos = [
  ["MO", "MONTEVIDEO"], ["SA", "SALTO"], ["CA", "CANELONES"],
  ["SJ", "SAN JOSE"], ["RO", "ROCHA"], ["TA", "TACUAREMBO"],
  ["TT", "TREINTA Y TRES"], ["SO", "SORIANO"], ["RN", "RIO NEGRO"],
  ["RI", "RIVERA"], ["PA", "PAYSANDU"], ["MA", "MALDONADO"],
  ["LA", "LAVALLEJA"], ["FD", "FLORIDA"], ["FS", "FLORES"],
  ["DU", "DURAZNO"], ["CO", "COLONIA"], ["CL", "CERRO LARGO"],
  ["AR", "ARTIGAS"],
] as const;

type LocalDemo = { nave: string; numero: string; finContrato: string | null };
type OperadorDemo = {
  username: string;
  passwordHash: string;
  nombreFantasia: string;
  whatsApp: string;
  locales: LocalDemo[];
};

// Cuentas ficticias para la demostración. Se conservan los hashes de la seed
// anterior; los números de WhatsApp son intencionalmente ficticios.
const operadores: OperadorDemo[] = [
  {
    username: "mercado_verde",
    passwordHash: "$2b$10$cQoQ65pnEH0aqvETVNLt0evxHpSvfIZ4IUHfQ/aIAb1I17CcwcYSq",
    nombreFantasia: "Mercado Verde UAM",
    whatsApp: "+598901",
    locales: [{ nave: "A", numero: "001", finContrato: null }],
  },
  {
    username: "frutas_del_plata",
    passwordHash: "$2b$10$sffK9RFZOeyGbAd1EKdmouBu0hSmSMInVEmOjXufYKGnexy0uRUQS",
    nombreFantasia: "Frutas del Plata",
    whatsApp: "+598902",
    locales: [{ nave: "A", numero: "010", finContrato: "2030-03-31T23:59:59Z" }],
  },
  {
    username: "granja_del_sur",
    passwordHash: "$2b$10$hcFh6d9lPWUZJo4.TZKSReBgsuzUPU8j598LrnEP8kFtG.6fB2UyO",
    nombreFantasia: "Granja del Sur",
    whatsApp: "+598903",
    locales: [{ nave: "A", numero: "020", finContrato: "2030-09-30T23:59:59Z" }],
  },
  {
    username: "huerta_central",
    passwordHash: "$2b$10$5Ap30NxcFM2NhwMGYao81O4Sh49yA3WgsPOBDlwifFq78Ory1aE3.",
    nombreFantasia: "Huerta Central",
    whatsApp: "+598904",
    locales: [{ nave: "B", numero: "030", finContrato: "2030-06-30T23:59:59Z" }],
  },
  {
    username: "agro_este",
    passwordHash: "$2b$10$08TXVIEBi.JgB.wuFmh8RONjENJhsIacxUFJyOEnFtZgPj.JqxFsW",
    nombreFantasia: "Agro del Este",
    whatsApp: "+598905",
    locales: [{ nave: "B", numero: "040", finContrato: "2030-11-30T23:59:59Z" }],
  },
  {
    username: "campos_litoral",
    passwordHash: "$2b$10$q/vpYvqL1IduoatRIQ0qyeybbvXlkWN8Ms5i3iFQQavdOGsT/2Pdm",
    nombreFantasia: "Campos del Litoral",
    whatsApp: "+598906",
    locales: [{ nave: "C", numero: "050", finContrato: "2031-01-31T23:59:59Z" }],
  },
  {
    username: "produccion_oriental",
    passwordHash: "$2b$10$6d8ZWAtEocxK7bTCMHZefOVU3TtWCjafo01UPYDWUKo5tY./MwV6i",
    nombreFantasia: "Producción Oriental",
    whatsApp: "+598907",
    locales: [{ nave: "C", numero: "060", finContrato: "2030-08-31T23:59:59Z" }],
  },
  {
    username: "cosechas_norte",
    passwordHash: "$2b$10$ZC4MeCqmvsrSAim4k2VhX.zeYbpJD9P7F2FSHLygtiUujXa4ncWg6",
    nombreFantasia: "Cosechas del Norte",
    whatsApp: "+598908",
    locales: [{ nave: "D", numero: "070", finContrato: "2030-10-31T23:59:59Z" }],
  },
  {
    username: "frescos_del_prado",
    passwordHash: "$2b$10$m6jaAE1ikpjRuCuvNsjaZOjJn42gy0sEJAd1l5nD8RzrViF0YePwu",
    nombreFantasia: "Frescos del Prado",
    whatsApp: "+598909",
    locales: [{ nave: "D", numero: "080", finContrato: "2030-12-31T23:59:59Z" }],
  },
  {
    username: "cooperativa_4_estaciones",
    passwordHash: "$2b$10$q4Ubqfv9LSrTDW4438zvneZU5ig10PxXryvebftDjlV2DsvXl6hBy",
    nombreFantasia: "Cooperativa 4 Estaciones",
    whatsApp: "+598910",
    locales: [
      { nave: "A", numero: "100", finContrato: null },
      { nave: "A", numero: "101", finContrato: "2025-12-31T23:59:59Z" },
    ],
  },
  {
    username: "agro_montevideo",
    passwordHash: "$2b$10$sb3gkjNqaUx4/vYuMXfQ0eei.PqEvNUIaYZA5o7tfGc9E6Rzb5OH.",
    nombreFantasia: "Agro Montevideo",
    whatsApp: "+598911",
    locales: [
      { nave: "B", numero: "120", finContrato: "2030-10-31T23:59:59Z" },
      { nave: "C", numero: "145", finContrato: null },
    ],
  },
  {
    username: "mercado_rural_olivos",
    passwordHash: "$2b$10$a9PJnKXLnlYb1MJYSR38Zuq1OSJmvDD7d7xrJSIZDbyLJW1aRvIEO",
    nombreFantasia: "Mercado Rural Los Olivos",
    whatsApp: "+598912",
    locales: [
      { nave: "D", numero: "160", finContrato: "2031-03-31T23:59:59Z" },
      { nave: "D", numero: "161", finContrato: "2031-03-31T23:59:59Z" },
      { nave: "A", numero: "180", finContrato: null },
    ],
  },
];

type KgPorUnidad = Parameters<typeof prisma.orm.public.Presentacion.create>[0]["kgPorUnidad"];
type PrecioPublicacion = Parameters<typeof prisma.orm.public.Publicacion.create>[0]["precio"];

function clave(...partes: Array<string | number>): string {
  return JSON.stringify(partes);
}

function idRequerido(mapa: Map<string, number>, llave: string, descripcion: string): number {
  const id = mapa.get(llave);
  if (id === undefined) throw new Error(`No se encontró ${descripcion} en el catálogo de la seed.`);
  return id;
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
  // El esquema sólo admite dos decimales: no inventamos precisión para los
  // productos cuyo peso de la fuente tiene tres decimales.
  if (Math.abs(peso * 100 - centesimos) > 0.000001) return null;
  return (centesimos / 100).toFixed(2) as unknown as KgPorUnidad;
}

async function limpiarBase() {
  await prisma.orm.public.Notificacion.where(() => all()).deleteAll();
  await prisma.orm.public.PublicacionOperador.where(() => all()).deleteAll();
  await prisma.orm.public.PublicacionProductor.where(() => all()).deleteAll();
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
  await prisma.orm.public.Especie.where(() => all()).deleteAll();
  await prisma.orm.public.Calibre.where(() => all()).deleteAll();
  await prisma.orm.public.Pais.where(() => all()).deleteAll();
  await prisma.orm.public.Departamento.where(() => all()).deleteAll();
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

  for (const [codigoDepartamento, nombreDepartamento] of departamentos) {
    await prisma.orm.public.Departamento.create({ codigoDepartamento, nombreDepartamento });
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
          const peso = conversiones.get(llave);
          if (peso === undefined) throw new Error(`Falta conversión para ${llave}`);
          const presentacion = await prisma.orm.public.Presentacion.create({
            uamId: null,
            nombrePresentacion: nombresUnidad[unidad],
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

async function crearOperadores() {
  for (const nombreNave of ["A", "B", "C", "D"]) {
    await prisma.orm.public.Nave.create({ nombreNave });
  }

  const usuarioAdmin = await prisma.orm.public.Usuario.create({
    username: "admin",
    passwordHash: "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW",
    rol: "ADMINISTRADOR",
    twoFactorEnabled: false,
  });
  await prisma.orm.public.Administrador.create({ usuarioId: usuarioAdmin.id, email: "admin@uam.com.uy" });

  const naveIds = new Map<string, number>();
  for (const nave of await prisma.orm.public.Nave.all()) naveIds.set(nave.nombreNave, nave.id);

  const operadorIds = new Map<string, number>();
  for (const datos of operadores) {
    const usuario = await prisma.orm.public.Usuario.create({
      username: datos.username,
      passwordHash: datos.passwordHash,
      rol: "OPERADOR",
      twoFactorEnabled: false,
    });
    const operador = await prisma.orm.public.Operador.create({
      usuarioId: usuario.id,
      nombreFantasia: datos.nombreFantasia,
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
  // La lectura y la validación ocurren antes del primer DELETE. El TXT es la
  // única fuente del catálogo; no se consulta el CSV antiguo.
  const consulta = cargarConsultaUam();
  const conversiones = validarFuente(consulta);
  const ofertas = crearOfertasDemo(consulta);
  const archivos = archivosGenericos();

  console.log(`Cargando catálogo de la consulta UAM del ${consulta.survey_date}...`);
  await limpiarBase();

  const { paisIds, calibreIds } = await crearDatosBase(consulta);
  const { presentacionIds, categoriaIds, cantidadVariedades } =
    await crearCatalogo(consulta, conversiones, archivos);
  const operadorIds = await crearOperadores();

  let conPrecio = 0;
  let sinPrecio = 0;
  let noDisponibles = 0;
  let inactivas = 0;
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

    const publicacion = await prisma.orm.public.Publicacion.create({
      fecha: Temporal.Instant.fromEpochMilliseconds(Date.now() - (indice % 15) * 86_400_000),
      publicacionDisponible: oferta.available,
      publicacionActiva: oferta.active,
      precio,
      foto: null,
      tipoPublicacion: "OPERADOR",
      presentacionId,
      categoriaId,
      calibreId,
    });
    await prisma.orm.public.PublicacionOperador.create({ publicacionId: publicacion.id, operadorId, paisId });

    if (oferta.price === null) sinPrecio++; else conPrecio++;
    if (!oferta.available) noDisponibles++;
    if (!oferta.active) inactivas++;
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
    publicaciones: ofertas.length,
    conPrecio,
    sinPrecio,
    noDisponibles,
    inactivas,
  });
  console.log("Seed completada.");
}

main()
  .catch((error) => {
    console.error("Error ejecutando seed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.close();
  });
