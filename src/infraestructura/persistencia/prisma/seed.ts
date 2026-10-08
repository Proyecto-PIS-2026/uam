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
type ProductorDemo = {
  username: string;
  passwordHash: string;
  whatsApp: string;
};

// Cuentas ficticias para la demostración. Las contraseñas se entregan junto
// con la documentación de la seed; los números de WhatsApp son ficticios.
const operadores: OperadorDemo[] = [
  {
    username: "jorge_ferias",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$fDUJ3Y1DptTIBU2IPjyqxw$Q0HyF4LnyUKJ1VubZRupwxZ3BfUEgMDk2K1ut/HOPVQ",
    nombreFantasia: "Jorge Ferias",
    whatsApp: "+598901",
    locales: [{ nave: "E", numero: "141", finContrato: null }],
  },
  {
    username: "pablo_sappa",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$2iKaSnHzDhvP359veoZwGw$iaLrSa6gwc7seCwotqAcFAU4InC7UJrJHAxX8h82wD8",
    nombreFantasia: "Pablo Sappa",
    whatsApp: "+598902",
    locales: [{ nave: "E", numero: "133", finContrato: null }],
  },
  {
    username: "diego_figueroa",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$Ygr+aXrMD+nTFSzqLuUidQ$+e04s9eIV1KCoSZZKeXH4jpH2TbfUi9s9yIyrk54s74",
    nombreFantasia: "Diego Figueroa",
    whatsApp: "+598903",
    locales: [{ nave: "E", numero: "145", finContrato: null }],
  },
  {
    username: "bacigalupi",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$/SB9RgUcKNoiiq4HPplZUQ$ClK4lJPCPm59vHHd29TLa6V6CEmLQdPiQJZGeKPZzd0",
    nombreFantasia: "Bacigalupi",
    whatsApp: "+598904",
    locales: [{ nave: "E", numero: "153", finContrato: null }],
  },
  {
    username: "lucas_blanco",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$n4evH5GByMDzpGbEmuK2aA$+OVfHqeLA5N9zthMqU2H2G277MJ2zwmSyPUlYnMgmdQ",
    nombreFantasia: "Lucas Blanco",
    whatsApp: "+598905",
    locales: [{ nave: "E", numero: "155", finContrato: null }],
  },
  {
    username: "britos_hns",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$hF/AFXqrOlAQ2mC1k/1dXQ$r6vWhyIo+US0rQq53m9cl9JeH4CyowVzgWBRAVvg6YQ",
    nombreFantasia: "Britos HNS",
    whatsApp: "+598906",
    locales: [{ nave: "B", numero: "145", finContrato: null }],
  },
  {
    username: "ciro_gentile",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$7Cd96JLCSvnk7fg/Y2+8EA$lK2htJFM2CKJuibqqYWk9mUnwbQ6edhVNYJ7MgXixUs",
    nombreFantasia: "Ciro Gentile",
    whatsApp: "+598907",
    locales: [{ nave: "A", numero: "067", finContrato: null }],
  },
  {
    username: "guarino",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$8NDsUPFEKNPhG6mlelqs5A$phXmGWz+scLp0mn4WIM35s/kNuO92ZkilAa2XPRc6Jc",
    nombreFantasia: "Guarino",
    whatsApp: "+598908",
    locales: [{ nave: "D", numero: "104", finContrato: null }],
  },
  {
    username: "pizzorno",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$cKXbLw5hEujDXRL0HjCKjQ$7YHrm9Ux3OyCITod5/bwR6AyXuQVxyyq+1lXB5VeQV8",
    nombreFantasia: "Pizzorno",
    whatsApp: "+598909",
    locales: [{ nave: "B", numero: "146", finContrato: null }],
  },
  {
    username: "don_juan",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$qasEF9MSpl/4Kqh40XRtKg$vbI0lscZ7NZXwSZEK3Z8d9g8IdfZ16TdOePnztkfjZM",
    nombreFantasia: "Don Juan",
    whatsApp: "+598910",
    locales: [{ nave: "D", numero: "073", finContrato: null }],
  },
  {
    username: "caporale",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$Noa0h8guBFaFWakrLxud/Q$o7pScj68SzUoMtX5uOMr1NKZ9F+q1s4VikoRMmwvQbQ",
    nombreFantasia: "Caporale",
    whatsApp: "+598911",
    locales: [{ nave: "B", numero: "022", finContrato: null }],
  },
  {
    username: "punto_natural",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$tPD9noGDYv/08hC9PsAGGA$3sN2+Db1wHPx04DA9qi85qTOsn3qn0BPoV13idJB588",
    nombreFantasia: "Punto Natural",
    whatsApp: "+598912",
    locales: [{ nave: "A", numero: "114", finContrato: null }],
  },
  {
    username: "pepe",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$3m7FFcopb5dKatLr/9Cnyg$XEFqkUGoG4lf8afc+KZMm/X4T1NVTB9UjiYCYp5V+Kc",
    nombreFantasia: "Pepe",
    whatsApp: "+598913",
    locales: [{ nave: "B", numero: "129", finContrato: null }],
  },
  {
    username: "sandias_de_rivera",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$o5bddB5RA8QlINWQ4aijtQ$JNJW9/LSSFUYO6iueMK/rbE1PqgH9bLZbHPtHY8Nm6U",
    nombreFantasia: "Sandias de Rivera",
    whatsApp: "+598914",
    locales: [{ nave: "Tinglado", numero: "N10", finContrato: null }],
  },
  {
    username: "citricola_salto_grande",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$hBwC5uJalTgD+u8rhAspDw$UUi12ANxsGWAB20q1Y2FXKXahM6IV+oQ7xMdOTlqJBk",
    nombreFantasia: "Citricola Salto Grande",
    whatsApp: "+598915",
    locales: [{ nave: "A", numero: "025", finContrato: null }],
  },
];

const productores: ProductorDemo[] = [
  {
    username: "productor_demo_norte",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$ckq4Kc750Ib5KIEnIa7Q+A$bSZqcZIXHYmeIw1bvC+nKzbCgt46Ox69fOJuCXtoYmE",
    whatsApp: "+598916",
  },
  {
    username: "productora_demo_sur",
    passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$OaZBVkmJYX60JCnI5LE+pA$BrS2NtPChLQ8iaXYVyBFVtXBJpw39gn9b6vm47ST/oc",
    whatsApp: "+598917",
  },
];

const operadorInhabilitado: OperadorDemo = {
  username: "inhabilitado",
  passwordHash: "$argon2id$v=19$m=65536,p=4,t=3$ZhGcSpOqe3QcvBo5fhrK6w$wNmdXW5yMPkMtRVhnQqHLSWki8NmdyTVaacdN0XOoQU",
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

async function crearOperadores(archivos: Map<string, string>) {
  const todosLosOperadores = [...operadores, operadorInhabilitado];
  const nombresNave = new Set(todosLosOperadores.flatMap((operador) => operador.locales.map((local) => local.nave)));
  for (const nombreNave of nombresNave) {
    await prisma.orm.public.Nave.create({ nombreNave });
  }

  const usuarioAdmin = await prisma.orm.public.Usuario.create({
    username: "admin",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$Qv57p7oX1yOvmzQUhP4E9w$VKE7w99CmdB0qBEIPya5FmH2mjehnzj8juyKMX9/rBo",
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
  // La lectura y la validación ocurren antes del primer DELETE. El TXT es la
  // única fuente del catálogo; no se consulta el CSV antiguo.
  const consulta = cargarConsultaUam();
  const conversiones = validarFuente(consulta);
  const ofertas = crearOfertasDemo(consulta);
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
