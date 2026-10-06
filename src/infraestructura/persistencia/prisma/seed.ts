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

// Cuentas ficticias para la demostración. Las contraseñas se entregan junto
// con la documentación de la seed; los números de WhatsApp son ficticios.
const operadores: OperadorDemo[] = [
  {
    username: "mercado_verde",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fDUJ3Y1DptTIBU2IPjyqxw$Q0HyF4LnyUKJ1VubZRupwxZ3BfUEgMDk2K1ut/HOPVQ",
    nombreFantasia: "Mercado Verde UAM",
    whatsApp: "+598901",
    locales: [{ nave: "A", numero: "001", finContrato: null }],
  },
  {
    username: "frutas_del_plata",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$2iKaSnHzDhvP359veoZwGw$iaLrSa6gwc7seCwotqAcFAU4InC7UJrJHAxX8h82wD8",
    nombreFantasia: "Frutas del Plata",
    whatsApp: "+598902",
    locales: [{ nave: "A", numero: "010", finContrato: "2030-03-31T23:59:59Z" }],
  },
  {
    username: "granja_del_sur",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$Ygr+aXrMD+nTFSzqLuUidQ$+e04s9eIV1KCoSZZKeXH4jpH2TbfUi9s9yIyrk54s74",
    nombreFantasia: "Granja del Sur",
    whatsApp: "+598903",
    locales: [{ nave: "A", numero: "020", finContrato: "2030-09-30T23:59:59Z" }],
  },
  {
    username: "huerta_central",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$/SB9RgUcKNoiiq4HPplZUQ$ClK4lJPCPm59vHHd29TLa6V6CEmLQdPiQJZGeKPZzd0",
    nombreFantasia: "Huerta Central",
    whatsApp: "+598904",
    locales: [{ nave: "B", numero: "030", finContrato: "2030-06-30T23:59:59Z" }],
  },
  {
    username: "agro_este",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$n4evH5GByMDzpGbEmuK2aA$+OVfHqeLA5N9zthMqU2H2G277MJ2zwmSyPUlYnMgmdQ",
    nombreFantasia: "Agro del Este",
    whatsApp: "+598905",
    locales: [{ nave: "B", numero: "040", finContrato: "2030-11-30T23:59:59Z" }],
  },
  {
    username: "campos_litoral",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$hF/AFXqrOlAQ2mC1k/1dXQ$r6vWhyIo+US0rQq53m9cl9JeH4CyowVzgWBRAVvg6YQ",
    nombreFantasia: "Campos del Litoral",
    whatsApp: "+598906",
    locales: [{ nave: "C", numero: "050", finContrato: "2031-01-31T23:59:59Z" }],
  },
  {
    username: "produccion_oriental",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$7Cd96JLCSvnk7fg/Y2+8EA$lK2htJFM2CKJuibqqYWk9mUnwbQ6edhVNYJ7MgXixUs",
    nombreFantasia: "Producción Oriental",
    whatsApp: "+598907",
    locales: [{ nave: "C", numero: "060", finContrato: "2030-08-31T23:59:59Z" }],
  },
  {
    username: "cosechas_norte",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$8NDsUPFEKNPhG6mlelqs5A$phXmGWz+scLp0mn4WIM35s/kNuO92ZkilAa2XPRc6Jc",
    nombreFantasia: "Cosechas del Norte",
    whatsApp: "+598908",
    locales: [{ nave: "D", numero: "070", finContrato: "2030-10-31T23:59:59Z" }],
  },
  {
    username: "frescos_del_prado",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$cKXbLw5hEujDXRL0HjCKjQ$7YHrm9Ux3OyCITod5/bwR6AyXuQVxyyq+1lXB5VeQV8",
    nombreFantasia: "Frescos del Prado",
    whatsApp: "+598909",
    locales: [{ nave: "D", numero: "080", finContrato: "2030-12-31T23:59:59Z" }],
  },
  {
    username: "cooperativa_4_estaciones",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$qasEF9MSpl/4Kqh40XRtKg$vbI0lscZ7NZXwSZEK3Z8d9g8IdfZ16TdOePnztkfjZM",
    nombreFantasia: "Cooperativa 4 Estaciones",
    whatsApp: "+598910",
    locales: [
      { nave: "A", numero: "100", finContrato: null },
      { nave: "A", numero: "101", finContrato: "2025-12-31T23:59:59Z" },
    ],
  },
  {
    username: "agro_montevideo",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$Noa0h8guBFaFWakrLxud/Q$o7pScj68SzUoMtX5uOMr1NKZ9F+q1s4VikoRMmwvQbQ",
    nombreFantasia: "Agro Montevideo",
    whatsApp: "+598911",
    locales: [
      { nave: "B", numero: "120", finContrato: "2030-10-31T23:59:59Z" },
      { nave: "C", numero: "145", finContrato: null },
    ],
  },
  {
    username: "mercado_rural_olivos",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$tPD9noGDYv/08hC9PsAGGA$3sN2+Db1wHPx04DA9qi85qTOsn3qn0BPoV13idJB588",
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
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$Qv57p7oX1yOvmzQUhP4E9w$VKE7w99CmdB0qBEIPya5FmH2mjehnzj8juyKMX9/rBo",
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
