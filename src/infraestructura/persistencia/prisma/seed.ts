import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

import "temporal-polyfill/full/global";
import "temporal-polyfill/types/global";

import postgres from "@prisma/orm-postgres/runtime";
import { all } from "@prisma/orm-postgres/orm-client";

import type { Contract } from "./contract.d";
import contractJson from "./contract.json" with { type: "json" };

const prisma = postgres<Contract>({
  contractJson,
  url: process.env.DATABASE_URL!,
});

type CsvRow = {
  grupo_id: string;
  grupo: string;
  especie_id: string;
  especie: string;
  especie_activa: string;
  variedad_id: string;
  variedad: string;
  variedad_activa: string;
  presentacion_id: string;
  presentacion: string;
  kg_por_unidad: string;
  presentacion_activa: string;
  presentacion_default: string;
};

function parseBoolean(value: string): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

type PresentacionCreateInput =
  Parameters<typeof prisma.orm.public.Presentacion.create>[0];

type KgPorUnidad = PresentacionCreateInput["kgPorUnidad"];

function parseDecimal(value: string): KgPorUnidad {
  if (!value) return null;

  const normalized = value.replace(",", ".").trim();
  const parsed = Number.parseFloat(normalized);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return parsed.toFixed(2) as unknown as KgPorUnidad;
}

async function main() {
  console.log("Iniciando proceso de Seed...");

  // 1. LIMPIEZA DE BASE DE DATOS
  console.log("Limpiando tablas de catálogo y usuarios...");

  await prisma.orm.public.Notificacion
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.PublicacionOperador
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.PublicacionProductor
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Publicacion
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Local
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Nave
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Operador
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Productor
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Administrador
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Usuario
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Presentacion
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Variedad
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Categoria
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Especie
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Calibre
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Pais
    .where(() => all())
    .deleteAll();

  await prisma.orm.public.Departamento
    .where(() => all())
    .deleteAll();
  await prisma.orm.public.Configuracion
    .where(() => all())
    .deleteAll();
    
  // 2. PAÍSES BASE
  console.log("Cargando Países...");

  const paisesData = [
    { codigoPais: "AF", nombrePais: "AFGANISTÁN" },
    { codigoPais: "AL", nombrePais: "ALBANIA" },
    { codigoPais: "DE", nombrePais: "ALEMANIA" },
    { codigoPais: "AD", nombrePais: "ANDORRA" },
    { codigoPais: "AO", nombrePais: "ANGOLA" },
    { codigoPais: "AI", nombrePais: "ANGUILA" },
    { codigoPais: "AQ", nombrePais: "ANTÁRTIDA" },
    { codigoPais: "AG", nombrePais: "ANTIGUA Y BARBUDA" },
    { codigoPais: "SA", nombrePais: "ARABIA SAUDÍ" },
    { codigoPais: "DZ", nombrePais: "ARGELIA" },
    { codigoPais: "AR", nombrePais: "ARGENTINA" },
    { codigoPais: "AM", nombrePais: "ARMENIA" },
    { codigoPais: "AW", nombrePais: "ARUBA" },
    { codigoPais: "AU", nombrePais: "AUSTRALIA" },
    { codigoPais: "AT", nombrePais: "AUSTRIA" },
    { codigoPais: "AZ", nombrePais: "AZERBAIYÁN" },
    { codigoPais: "BS", nombrePais: "BAHAMAS" },
    { codigoPais: "BD", nombrePais: "BANGLADÉS" },
    { codigoPais: "BB", nombrePais: "BARBADOS" },
    { codigoPais: "BH", nombrePais: "BARÉIN" },
    { codigoPais: "BE", nombrePais: "BÉLGICA" },
    { codigoPais: "BZ", nombrePais: "BELICE" },
    { codigoPais: "BJ", nombrePais: "BENÍN" },
    { codigoPais: "BM", nombrePais: "BERMUDAS" },
    { codigoPais: "BY", nombrePais: "BIELORRUSIA" },
    { codigoPais: "BO", nombrePais: "BOLIVIA" },
    { codigoPais: "BA", nombrePais: "BOSNIA Y HERZEGOVINA" },
    { codigoPais: "BW", nombrePais: "BOTSUANA" },
    { codigoPais: "BR", nombrePais: "BRASIL" },
    { codigoPais: "BN", nombrePais: "BRUNÉI" },
    { codigoPais: "BG", nombrePais: "BULGARIA" },
    { codigoPais: "BF", nombrePais: "BURKINA FASO" },
    { codigoPais: "BI", nombrePais: "BURUNDI" },
    { codigoPais: "BT", nombrePais: "BUTÁN" },
    { codigoPais: "CV", nombrePais: "CABO VERDE" },
    { codigoPais: "KH", nombrePais: "CAMBOYA" },
    { codigoPais: "CM", nombrePais: "CAMERÚN" },
    { codigoPais: "CA", nombrePais: "CANADÁ" },
    { codigoPais: "QA", nombrePais: "CATAR" },
    { codigoPais: "TD", nombrePais: "CHAD" },
    { codigoPais: "CL", nombrePais: "CHILE" },
    { codigoPais: "CN", nombrePais: "CHINA" },
    { codigoPais: "CY", nombrePais: "CHIPRE" },
    { codigoPais: "CO", nombrePais: "COLOMBIA" },
    { codigoPais: "KM", nombrePais: "COMORAS" },
    { codigoPais: "CG", nombrePais: "CONGO" },
    { codigoPais: "CD", nombrePais: "REPÚBLICA DEMOCRÁTICA DEL CONGO" },
    { codigoPais: "KP", nombrePais: "COREA DEL NORTE" },
    { codigoPais: "KR", nombrePais: "COREA DEL SUR" },
    { codigoPais: "CI", nombrePais: "COSTA DE MARFIL" },
    { codigoPais: "CR", nombrePais: "COSTA RICA" },
    { codigoPais: "HR", nombrePais: "CROACIA" },
    { codigoPais: "CU", nombrePais: "CUBA" },
    { codigoPais: "CW", nombrePais: "CURAZAO" },
    { codigoPais: "DK", nombrePais: "DINAMARCA" },
    { codigoPais: "DM", nombrePais: "DOMINICA" },
    { codigoPais: "EC", nombrePais: "ECUADOR" },
    { codigoPais: "EG", nombrePais: "EGIPTO" },
    { codigoPais: "SV", nombrePais: "EL SALVADOR" },
    { codigoPais: "AE", nombrePais: "EMIRATOS ÁRABES UNIDOS" },
    { codigoPais: "ER", nombrePais: "ERITREA" },
    { codigoPais: "SK", nombrePais: "ESLOVAQUIA" },
    { codigoPais: "SI", nombrePais: "ESLOVENIA" },
    { codigoPais: "ES", nombrePais: "ESPAÑA" },
    { codigoPais: "US", nombrePais: "ESTADOS UNIDOS" },
    { codigoPais: "EE", nombrePais: "ESTONIA" },
    { codigoPais: "ET", nombrePais: "ETIOPÍA" },
    { codigoPais: "PH", nombrePais: "FILIPINAS" },
    { codigoPais: "FI", nombrePais: "FINLANDIA" },
    { codigoPais: "FJ", nombrePais: "FIYI" },
    { codigoPais: "FR", nombrePais: "FRANCIA" },
    { codigoPais: "GA", nombrePais: "GABÓN" },
    { codigoPais: "GM", nombrePais: "GAMBIA" },
    { codigoPais: "GE", nombrePais: "GEORGIA" },
    { codigoPais: "GH", nombrePais: "GHANA" },
    { codigoPais: "GI", nombrePais: "GIBRALTAR" },
    { codigoPais: "GD", nombrePais: "GRANADA" },
    { codigoPais: "GR", nombrePais: "GRECIA" },
    { codigoPais: "GL", nombrePais: "GROENLANDIA" },
    { codigoPais: "GP", nombrePais: "GUADALUPE" },
    { codigoPais: "GU", nombrePais: "GUAM" },
    { codigoPais: "GT", nombrePais: "GUATEMALA" },
    { codigoPais: "GF", nombrePais: "GUAYANA FRANCESA" },
    { codigoPais: "GG", nombrePais: "GUERNSEY" },
    { codigoPais: "GN", nombrePais: "GUINEA" },
    { codigoPais: "GW", nombrePais: "GUINEA-BISÁU" },
    { codigoPais: "GQ", nombrePais: "GUINEA ECUATORIAL" },
    { codigoPais: "GY", nombrePais: "GUYANA" },
    { codigoPais: "HT", nombrePais: "HAITÍ" },
    { codigoPais: "HN", nombrePais: "HONDURAS" },
    { codigoPais: "HK", nombrePais: "HONG KONG" },
    { codigoPais: "HU", nombrePais: "HUNGRÍA" },
    { codigoPais: "IN", nombrePais: "INDIA" },
    { codigoPais: "ID", nombrePais: "INDONESIA" },
    { codigoPais: "IQ", nombrePais: "IRAK" },
    { codigoPais: "IR", nombrePais: "IRÁN" },
    { codigoPais: "IE", nombrePais: "IRLANDA" },
    { codigoPais: "IS", nombrePais: "ISLANDIA" },
    { codigoPais: "IL", nombrePais: "ISRAEL" },
    { codigoPais: "IT", nombrePais: "ITALIA" },
    { codigoPais: "JM", nombrePais: "JAMAICA" },
    { codigoPais: "JP", nombrePais: "JAPÓN" },
    { codigoPais: "JE", nombrePais: "JERSEY" },
    { codigoPais: "JO", nombrePais: "JORDANIA" },
    { codigoPais: "KZ", nombrePais: "KAZAJISTÁN" },
    { codigoPais: "KE", nombrePais: "KENIA" },
    { codigoPais: "KG", nombrePais: "KIRGUISTÁN" },
    { codigoPais: "KI", nombrePais: "KIRIBATI" },
    { codigoPais: "KW", nombrePais: "KUWAIT" },
    { codigoPais: "LA", nombrePais: "LAOS" },
    { codigoPais: "LS", nombrePais: "LESOTO" },
    { codigoPais: "LV", nombrePais: "LETONIA" },
    { codigoPais: "LB", nombrePais: "LÍBANO" },
    { codigoPais: "LR", nombrePais: "LIBERIA" },
    { codigoPais: "LY", nombrePais: "LIBIA" },
    { codigoPais: "LI", nombrePais: "LIECHTENSTEIN" },
    { codigoPais: "LT", nombrePais: "LITUANIA" },
    { codigoPais: "LU", nombrePais: "LUXEMBURGO" },
    { codigoPais: "MO", nombrePais: "MACAO" },
    { codigoPais: "MK", nombrePais: "MACEDONIA DEL NORTE" },
    { codigoPais: "MG", nombrePais: "MADAGASCAR" },
    { codigoPais: "MY", nombrePais: "MALASIA" },
    { codigoPais: "MW", nombrePais: "MALAUI" },
    { codigoPais: "MV", nombrePais: "MALDIVAS" },
    { codigoPais: "ML", nombrePais: "MALÍ" },
    { codigoPais: "MT", nombrePais: "MALTA" },
    { codigoPais: "MA", nombrePais: "MARRUECOS" },
    { codigoPais: "MQ", nombrePais: "MARTINICA" },
    { codigoPais: "MU", nombrePais: "MAURICIO" },
    { codigoPais: "MR", nombrePais: "MAURITANIA" },
    { codigoPais: "YT", nombrePais: "MAYOTTE" },
    { codigoPais: "MX", nombrePais: "MÉXICO" },
    { codigoPais: "FM", nombrePais: "MICRONESIA" },
    { codigoPais: "MD", nombrePais: "MOLDAVIA" },
    { codigoPais: "MC", nombrePais: "MÓNACO" },
    { codigoPais: "MN", nombrePais: "MONGOLIA" },
    { codigoPais: "ME", nombrePais: "MONTENEGRO" },
    { codigoPais: "MS", nombrePais: "MONTSERRAT" },
    { codigoPais: "MZ", nombrePais: "MOZAMBIQUE" },
    { codigoPais: "MM", nombrePais: "MIANMAR" },
    { codigoPais: "NA", nombrePais: "NAMIBIA" },
    { codigoPais: "NR", nombrePais: "NAURU" },
    { codigoPais: "NP", nombrePais: "NEPAL" },
    { codigoPais: "NI", nombrePais: "NICARAGUA" },
    { codigoPais: "NE", nombrePais: "NÍGER" },
    { codigoPais: "NG", nombrePais: "NIGERIA" },
    { codigoPais: "NO", nombrePais: "NORUEGA" },
    { codigoPais: "NC", nombrePais: "NUEVA CALEDONIA" },
    { codigoPais: "NZ", nombrePais: "NUEVA ZELANDA" },
    { codigoPais: "OM", nombrePais: "OMÁN" },
    { codigoPais: "NL", nombrePais: "PAÍSES BAJOS" },
    { codigoPais: "PK", nombrePais: "PAKISTÁN" },
    { codigoPais: "PW", nombrePais: "PALAOS" },
    { codigoPais: "PS", nombrePais: "PALESTINA" },
    { codigoPais: "PA", nombrePais: "PANAMÁ" },
    { codigoPais: "PG", nombrePais: "PAPÚA NUEVA GUINEA" },
    { codigoPais: "PY", nombrePais: "PARAGUAY" },
    { codigoPais: "PE", nombrePais: "PERÚ" },
    { codigoPais: "PF", nombrePais: "POLINESIA FRANCESA" },
    { codigoPais: "PL", nombrePais: "POLONIA" },
    { codigoPais: "PT", nombrePais: "PORTUGAL" },
    { codigoPais: "PR", nombrePais: "PUERTO RICO" },
    { codigoPais: "GB", nombrePais: "REINO UNIDO" },
    { codigoPais: "CF", nombrePais: "REPÚBLICA CENTROAFRICANA" },
    { codigoPais: "CZ", nombrePais: "REPÚBLICA CHECA" },
    { codigoPais: "DO", nombrePais: "REPÚBLICA DOMINICANA" },
    { codigoPais: "RE", nombrePais: "REUNIÓN" },
    { codigoPais: "RW", nombrePais: "RUANDA" },
    { codigoPais: "RO", nombrePais: "RUMANÍA" },
    { codigoPais: "RU", nombrePais: "RUSIA" },
    { codigoPais: "WS", nombrePais: "SAMOA" },
    { codigoPais: "AS", nombrePais: "SAMOA AMERICANA" },
    { codigoPais: "BL", nombrePais: "SAN BARTOLOMÉ" },
    { codigoPais: "KN", nombrePais: "SAN CRISTÓBAL Y NIEVES" },
    { codigoPais: "SM", nombrePais: "SAN MARINO" },
    { codigoPais: "MF", nombrePais: "SAN MARTÍN" },
    { codigoPais: "PM", nombrePais: "SAN PEDRO Y MIQUELÓN" },
    { codigoPais: "VC", nombrePais: "SAN VICENTE Y LAS GRANADINAS" },
    { codigoPais: "SH", nombrePais: "SANTA ELENA" },
    { codigoPais: "LC", nombrePais: "SANTA LUCÍA" },
    { codigoPais: "ST", nombrePais: "SAN TOMÉ Y PRÍNCIPE" },
    { codigoPais: "SN", nombrePais: "SENEGAL" },
    { codigoPais: "RS", nombrePais: "SERBIA" },
    { codigoPais: "SC", nombrePais: "SEYCHELLES" },
    { codigoPais: "SL", nombrePais: "SIERRA LEONA" },
    { codigoPais: "SG", nombrePais: "SINGAPUR" },
    { codigoPais: "SX", nombrePais: "SINT MAARTEN" },
    { codigoPais: "SY", nombrePais: "SIRIA" },
    { codigoPais: "SO", nombrePais: "SOMALIA" },
    { codigoPais: "LK", nombrePais: "SRI LANKA" },
    { codigoPais: "SZ", nombrePais: "SUAZILANDIA / ESWATINI" },
    { codigoPais: "ZA", nombrePais: "SUDÁFRICA" },
    { codigoPais: "SD", nombrePais: "SUDÁN" },
    { codigoPais: "SS", nombrePais: "SUDÁN DEL SUR" },
    { codigoPais: "SE", nombrePais: "SUECIA" },
    { codigoPais: "CH", nombrePais: "SUIZA" },
    { codigoPais: "SR", nombrePais: "SURINAM" },
    { codigoPais: "TH", nombrePais: "TAILANDIA" },
    { codigoPais: "TW", nombrePais: "TAIWÁN" },
    { codigoPais: "TZ", nombrePais: "TANZANIA" },
    { codigoPais: "TJ", nombrePais: "TAYIKISTÁN" },
    { codigoPais: "TL", nombrePais: "TIMOR ORIENTAL" },
    { codigoPais: "TG", nombrePais: "TOGO" },
    { codigoPais: "TK", nombrePais: "TOKELAU" },
    { codigoPais: "TO", nombrePais: "TONGA" },
    { codigoPais: "TT", nombrePais: "TRINIDAD Y TOBAGO" },
    { codigoPais: "TN", nombrePais: "TÚNEZ" },
    { codigoPais: "TM", nombrePais: "TURKMENISTÁN" },
    { codigoPais: "TR", nombrePais: "TURQUÍA" },
    { codigoPais: "TV", nombrePais: "TUVALU" },
    { codigoPais: "UA", nombrePais: "UCRANIA" },
    { codigoPais: "UG", nombrePais: "UGANDA" },
    { codigoPais: "UY", nombrePais: "URUGUAY" },
    { codigoPais: "UZ", nombrePais: "UZBEKISTÁN" },
    { codigoPais: "VU", nombrePais: "VANUATU" },
    { codigoPais: "VA", nombrePais: "CIUDAD DEL VATICANO" },
    { codigoPais: "VE", nombrePais: "VENEZUELA" },
    { codigoPais: "VN", nombrePais: "VIETNAM" },
    { codigoPais: "WF", nombrePais: "WALLIS Y FUTUNA" },
    { codigoPais: "YE", nombrePais: "YEMEN" },
    { codigoPais: "DJ", nombrePais: "YIBUTI" },
    { codigoPais: "ZM", nombrePais: "ZAMBIA" },
    { codigoPais: "ZW", nombrePais: "ZIMBABWE" },
    { codigoPais: "XX", nombrePais: "DESCONOCIDO" },
  ];

  for (const p of paisesData) {
    await prisma.orm.public.Pais.upsert({
      create: p,
      update: {
        nombrePais: p.nombrePais,
      },
      conflictOn: {
        codigoPais: p.codigoPais,
      },
    });
  }

  // 3. DEPARTAMENTOS DE URUGUAY
  console.log("Cargando Departamentos...");

  const deptosData = [
    { codigoDepartamento: "MO", nombreDepartamento: "MONTEVIDEO" },
    { codigoDepartamento: "SA", nombreDepartamento: "SALTO" },
    { codigoDepartamento: "CA", nombreDepartamento: "CANELONES" },
    { codigoDepartamento: "SJ", nombreDepartamento: "SAN JOSE" },
    { codigoDepartamento: "RO", nombreDepartamento: "ROCHA" },
    { codigoDepartamento: "TA", nombreDepartamento: "TACUAREMBO" },
    { codigoDepartamento: "TT", nombreDepartamento: "TREINTA Y TRES" },
    { codigoDepartamento: "SO", nombreDepartamento: "SORIANO" },
    { codigoDepartamento: "RN", nombreDepartamento: "RIO NEGRO" },
    { codigoDepartamento: "RI", nombreDepartamento: "RIVERA" },
    { codigoDepartamento: "PA", nombreDepartamento: "PAYSANDU" },
    { codigoDepartamento: "MA", nombreDepartamento: "MALDONADO" },
    { codigoDepartamento: "LA", nombreDepartamento: "LAVALLEJA" },
    { codigoDepartamento: "FD", nombreDepartamento: "FLORIDA" },
    { codigoDepartamento: "FS", nombreDepartamento: "FLORES" },
    { codigoDepartamento: "DU", nombreDepartamento: "DURAZNO" },
    { codigoDepartamento: "CO", nombreDepartamento: "COLONIA" },
    { codigoDepartamento: "CL", nombreDepartamento: "CERRO LARGO" },
    { codigoDepartamento: "AR", nombreDepartamento: "ARTIGAS" },
  ];

  for (const d of deptosData) {
    await prisma.orm.public.Departamento.upsert({
      create: d,
      update: {
        nombreDepartamento: d.nombreDepartamento,
      },
      conflictOn: {
        codigoDepartamento: d.codigoDepartamento,
      },
    });
  }

  // 4. CALIBRES / CODES
  console.log("Cargando Calibres...");

  const calibresData = [
    { codigoCalibre: "EX", nombreCalibre: "EXTRA" },
    { codigoCalibre: "8P", nombreCalibre: "8 PLANTAS" },
    { codigoCalibre: "18P", nombreCalibre: "18 PLANTAS" },
    { codigoCalibre: "12P", nombreCalibre: "12 PLANTAS" },
    { codigoCalibre: "C", nombreCalibre: "CHICO" },
    { codigoCalibre: "M", nombreCalibre: "MEDIANO" },
    { codigoCalibre: "G", nombreCalibre: "GRANDE" },
    { codigoCalibre: "EG", nombreCalibre: "EXTRAGRANDE" },
    { codigoCalibre: "SV", nombreCalibre: "SIN VARIACION" },
  ];

  for (const c of calibresData) {
    await prisma.orm.public.Calibre.upsert({
      create: c,
      update: {
        nombreCalibre: c.nombreCalibre,
      },
      conflictOn: {
        codigoCalibre: c.codigoCalibre,
      },
    });
  }

  // 5. PARSEO Y SEED DE ESPECIES, VARIEDADES Y PRESENTACIONES DESDE CSV
  console.log("Leyendo archivo CSV UAM...");

  const csvPath = path.join(
    process.cwd(),
    "src",
    "infraestructura",
    "persistencia",
    "prisma",
    "data",
    "catalogo-uam.csv"
  );

  if (fs.existsSync(csvPath)) {
    const csvContent = fs.readFileSync(csvPath, "utf8");

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];

    // A. Especies
    const especies = new Map<number, CsvRow>();

    for (const row of records) {
      if (!row.especie_id) continue;
      especies.set(Number.parseInt(row.especie_id, 10), row);
    }

    const especieIds = new Map<number, number>();

    for (const [uamId, row] of especies) {
      const especie = await prisma.orm.public.Especie.upsert({
        create: {
          uamId,
          nombreEspecie: row.especie,
          especieActiva: parseBoolean(row.especie_activa),
        },
        update: {
          nombreEspecie: row.especie,
          especieActiva: parseBoolean(row.especie_activa),
        },
        conflictOn: {
          uamId,
        },
      });

      especieIds.set(uamId, especie.id);
    }

    // B. Variedades
    const variedades = new Map<number, CsvRow>();

    for (const row of records) {
      if (!row.variedad_id) continue;
      variedades.set(Number.parseInt(row.variedad_id, 10), row);
    }

    const variedadIds = new Map<number, number>();

    for (const [uamId, row] of variedades) {
      const especieUamId = Number.parseInt(row.especie_id, 10);
      const especieDbId = especieIds.get(especieUamId);

      if (!especieDbId) {
        throw new Error(
          `No se encontró la especie ${row.especie_id} para la variedad ${uamId}`
        );
      }

      const variedad = await prisma.orm.public.Variedad.upsert({
        create: {
          uamId,
          nombreVariedad: row.variedad || "-",
          variedadActiva: parseBoolean(row.variedad_activa),
          especieId: especieDbId,
        },
        update: {
          nombreVariedad: row.variedad || "-",
          variedadActiva: parseBoolean(row.variedad_activa),
          especieId: especieDbId,
        },
        conflictOn: {
          uamId,
        },
      });

      variedadIds.set(uamId, variedad.id);
    }

    // C. Presentaciones
    const presentaciones = new Map<number, CsvRow>();

    for (const row of records) {
      if (!row.presentacion_id) continue;

      presentaciones.set(
        Number.parseInt(row.presentacion_id, 10),
        row
      );
    }

    for (const [uamId, row] of presentaciones) {
      const variedadUamId = Number.parseInt(row.variedad_id, 10);
      const variedadDbId = variedadIds.get(variedadUamId);

      if (!variedadDbId) {
        throw new Error(
          `No se encontró la variedad ${row.variedad_id} para la presentación ${uamId}`
        );
      }

      await prisma.orm.public.Presentacion.upsert({
        create: {
          uamId,
          nombrePresentacion: row.presentacion || "Unidad",
          kgPorUnidad: parseDecimal(row.kg_por_unidad),
          presentacionActiva: parseBoolean(row.presentacion_activa),
          presentacionDefault: parseBoolean(row.presentacion_default),
          variedadId: variedadDbId,
        },
        update: {
          nombrePresentacion: row.presentacion || "Unidad",
          kgPorUnidad: parseDecimal(row.kg_por_unidad),
          presentacionActiva: parseBoolean(row.presentacion_activa),
          presentacionDefault: parseBoolean(row.presentacion_default),
          variedadId: variedadDbId,
        },
        conflictOn: {
          uamId,
        },
      });
    }

    console.table([
      {
        Entidad: "Especies",
        Cargados: especies.size,
        Resultado: "OK",
      },
      {
        Entidad: "Variedades",
        Cargados: variedades.size,
        Resultado: "OK",
      },
      {
        Entidad: "Presentaciones",
        Cargados: presentaciones.size,
        Resultado: "OK",
      },
    ]);
  } else {
    console.warn(
      "No se encontró el archivo catalogo-uam.csv, omitiendo importación CSV."
    );
  }

  // 6. CATEGORÍAS BASE
  console.log("Cargando Categorías generales...");

  const categoriasGenerales = ["I", "II", "E", "-"];

  for (const cat of categoriasGenerales) {
    await prisma.orm.public.Categoria.create({
      nombreCategoria: cat,
    });
  }

  // Categorías específicas para Huevos si la especie existe
  const especieHuevo = await prisma.orm.public.Especie
    .where((e) => e.nombreEspecie.ilike("%Huevo%"))
    .first();

  if (especieHuevo) {
    const categoriasHuevo = [
      "Chico",
      "Mediano",
      "Especial",
      "Extra",
      "Jumbo",
    ];

    for (const cat of categoriasHuevo) {
      await prisma.orm.public.Categoria.create({
        nombreCategoria: cat,
        especieId: especieHuevo.id,
      });
    }
  }

  // 7. NAVES
  console.log("Cargando Naves...");

  const naves = [
    "A",
    "B",
    "C",
    "D",
  ];

  for (const nombreNave of naves) {
    await prisma.orm.public.Nave.upsert({
      create: {
        nombreNave,
      },
      update: {},
      conflictOn: {
        nombreNave,
      },
    });
  }

  // 8. USUARIO ADMINISTRADOR INICIAL
  console.log("Creando Usuario Administrador por defecto...");

  const adminUsername = "admin";

  const existingAdmin = await prisma.orm.public.Usuario.first({
    username: adminUsername,
  });

  if (!existingAdmin) {
    const adminUsuario = await prisma.orm.public.Usuario.create({
      username: adminUsername,

      // Contraseña real: "Admin123!"
      // Algoritmo de Hash: Bcrypt ($2b$ = bcrypt con costo 10) Se puede cambiar
      passwordHash:
        "$2b$10$EixZaYVK1fsbw1ZfbX3OXePaWxn96p36WQOEg6Lruj3vjPGga31lW",

      rol: "ADMINISTRADOR",
      twoFactorEnabled: false,
    });

    await prisma.orm.public.Administrador.create({
      usuarioId: adminUsuario.id,
      email: "admin@uam.com.uy",
    });
  }

  // 9. OPERADORES
  console.log("Cargando operadores...");
  /*
   * Todos los operadores utilizan como contraseña:
   * username + "123"
   * Los hashes corresponden a esas contraseñas.
   * Función de hash: bcrypt con costo 10
   */

  const operadoresData = [
    {
      username: "mercado_verde",
      passwordHash:
        "$2b$10$cQoQ65pnEH0aqvETVNLt0evxHpSvfIZ4IUHfQ/aIAb1I17CcwcYSq",
      nombreFantasia: "Mercado Verde UAM",
      whatsApp: "+59899100001",
    },
    {
      username: "frutas_del_plata",
      passwordHash:
        "$2b$10$sffK9RFZOeyGbAd1EKdmouBu0hSmSMInVEmOjXufYKGnexy0uRUQS",
      nombreFantasia: "Frutas del Plata",
      whatsApp: "+59899100002",
    },
    {
      username: "granja_del_sur",
      passwordHash:
        "$2b$10$hcFh6d9lPWUZJo4.TZKSReBgsuzUPU8j598LrnEP8kFtG.6fB2UyO",
      nombreFantasia: "Granja del Sur",
      whatsApp: "+59899100003",
    },
    {
      username: "huerta_central",
      passwordHash:
        "$2b$10$5Ap30NxcFM2NhwMGYao81O4Sh49yA3WgsPOBDlwifFq78Ory1aE3.",
      nombreFantasia: "Huerta Central",
      whatsApp: "+59899100004",
    },
    {
      username: "agro_este",
      passwordHash:
        "$2b$10$08TXVIEBi.JgB.wuFmh8RONjENJhsIacxUFJyOEnFtZgPj.JqxFsW",
      nombreFantasia: "Agro del Este",
      whatsApp: "+59899100005",
    },
    {
      username: "campos_litoral",
      passwordHash:
        "$2b$10$q/vpYvqL1IduoatRIQ0qyeybbvXlkWN8Ms5i3iFQQavdOGsT/2Pdm",
      nombreFantasia: "Campos del Litoral",
      whatsApp: "+59899100006",
    },
    {
      username: "produccion_oriental",
      passwordHash:
        "$2b$10$6d8ZWAtEocxK7bTCMHZefOVU3TtWCjafo01UPYDWUKo5tY./MwV6i",
      nombreFantasia: "Producción Oriental",
      whatsApp: "+59899100007",
    },
    {
      username: "cosechas_norte",
      passwordHash:
        "$2b$10$ZC4MeCqmvsrSAim4k2VhX.zeYbpJD9P7F2FSHLygtiUujXa4ncWg6",
      nombreFantasia: "Cosechas del Norte",
      whatsApp: "+59899100008",
    },
    {
      username: "frescos_del_prado",
      passwordHash:
        "$2b$10$m6jaAE1ikpjRuCuvNsjaZOjJn42gy0sEJAd1l5nD8RzrViF0YePwu",
      nombreFantasia: "Frescos del Prado",
      whatsApp: "+59899100009",
    },
    {
      username: "cooperativa_4_estaciones",
      passwordHash:
        "$2b$10$q4Ubqfv9LSrTDW4438zvneZU5ig10PxXryvebftDjlV2DsvXl6hBy",
      nombreFantasia: "Cooperativa 4 Estaciones",
      whatsApp: "+59899100010",
    },
    {
      username: "agro_montevideo",
      passwordHash:
        "$2b$10$sb3gkjNqaUx4/vYuMXfQ0eei.PqEvNUIaYZA5o7tfGc9E6Rzb5OH.",
      nombreFantasia: "Agro Montevideo",
      whatsApp: "+59899100011",
    },
    {
      username: "mercado_rural_olivos",
      passwordHash:
        "$2b$10$a9PJnKXLnlYb1MJYSR38Zuq1OSJmvDD7d7xrJSIZDbyLJW1aRvIEO",
      nombreFantasia: "Mercado Rural Los Olivos",
      whatsApp: "+59899100012",
    },
  ];

  const operadorIds = new Map<string, number>();

  for (const operadorData of operadoresData) {
    const usuario = await prisma.orm.public.Usuario.create({
      username: operadorData.username,
      passwordHash: operadorData.passwordHash,
      rol: "OPERADOR",
      twoFactorEnabled: false,
    });

    const operador = await prisma.orm.public.Operador.create({
      usuarioId: usuario.id,
      nombreFantasia: operadorData.nombreFantasia,
      enLicencia: false,
      comentario: null,
      whatsApp: operadorData.whatsApp,
    });

    operadorIds.set(operadorData.username, operador.id);
  }

  // 10. LOCALES
  console.log("Cargando locales...");
  /*
   * 9 operadores con 1 local
   *
   * cooperativa_4_estaciones tiene 2 locales consecutivos:
   *   Nave A -> 100, 101
   *
   * agro_montevideo tiene 2 locales en distintas naves:
   *   Nave B -> 120
   *   Nave C -> 145
   *
   * mercado_rural_olivos tiene 2 locales consecutivos y 1 en otra nave:
   *   Nave D -> 160, 161
   *   Nave A -> 180
   */
  const localesData = [
    {
      username: "mercado_verde",
      numeroLocal: "001",
      nave: "A",
      finContrato: "2027-12-31T23:59:59Z",
    },
    {
      username: "frutas_del_plata",
      numeroLocal: "010",
      nave: "A",
      finContrato: "2028-03-31T23:59:59Z",
    },
    {
      username: "granja_del_sur",
      numeroLocal: "020",
      nave: "A",
      finContrato: "2027-09-30T23:59:59Z",
    },
    {
      username: "huerta_central",
      numeroLocal: "030",
      nave: "B",
      finContrato: "2028-06-30T23:59:59Z",
    },
    {
      username: "agro_este",
      numeroLocal: "040",
      nave: "B",
      finContrato: "2027-11-30T23:59:59Z",
    },
    {
      username: "campos_litoral",
      numeroLocal: "050",
      nave: "C",
      finContrato: "2029-01-31T23:59:59Z",
    },
    {
      username: "produccion_oriental",
      numeroLocal: "060",
      nave: "C",
      finContrato: "2028-08-31T23:59:59Z",
    },
    {
      username: "cosechas_norte",
      numeroLocal: "070",
      nave: "D",
      finContrato: "2027-10-31T23:59:59Z",
    },
    {
      username: "frescos_del_prado",
      numeroLocal: "080",
      nave: "D",
      finContrato: "2028-12-31T23:59:59Z",
    },

    // Dos locales consecutivos en Nave A.
    {
      username: "cooperativa_4_estaciones",
      numeroLocal: "100",
      nave: "A",
      finContrato: "2029-02-28T23:59:59Z",
    },
    {
      username: "cooperativa_4_estaciones",
      numeroLocal: "101",
      nave: "A",
      finContrato: "2029-02-28T23:59:59Z",
    },

    // Un local en cada una de dos naves.
    {
      username: "agro_montevideo",
      numeroLocal: "120",
      nave: "B",
      finContrato: "2028-10-31T23:59:59Z",
    },
    {
      username: "agro_montevideo",
      numeroLocal: "145",
      nave: "C",
      finContrato: "2028-10-31T23:59:59Z",
    },

    // Dos consecutivos en Nave D y uno en Nave A.
    {
      username: "mercado_rural_olivos",
      numeroLocal: "160",
      nave: "D",
      finContrato: "2029-03-31T23:59:59Z",
    },
    {
      username: "mercado_rural_olivos",
      numeroLocal: "161",
      nave: "D",
      finContrato: "2029-03-31T23:59:59Z",
    },
    {
      username: "mercado_rural_olivos",
      numeroLocal: "180",
      nave: "A",
      finContrato: "2029-03-31T23:59:59Z",
    },
  ];

  const navesDb = await prisma.orm.public.Nave.all();
  const naveIds = new Map<string, number>();

  for (const nave of navesDb) {
    naveIds.set(nave.nombreNave, nave.id);
  }

  for (const localData of localesData) {
    const operadorId = operadorIds.get(localData.username);
    const naveId = naveIds.get(localData.nave);

    if (!operadorId) {
      throw new Error(
        `No se encontró el operador ${localData.username} para el local ${localData.numeroLocal}`
      );
    }

    if (!naveId) {
      throw new Error(
        `No se encontró la nave ${localData.nave} para el local ${localData.numeroLocal}`
      );
    }

    await prisma.orm.public.Local.create({
      numeroLocal: localData.numeroLocal,
      finContrato: Temporal.Instant.from(localData.finContrato),
      operadorId,
      naveId,
    });
  }

  // 11. PUBLICACIONES
  console.log("Cargando publicaciones...");
  /*
   * Cantidad de publicaciones:
   *
   * mercado_verde             -> 2
   * frutas_del_plata          -> 3
   * granja_del_sur            -> 4
   * huerta_central            -> 5
   * agro_este                 -> 6
   * campos_litoral            -> 7
   * produccion_oriental       -> 8
   * cosechas_norte            -> 9
   * frescos_del_prado         -> 10
   * cooperativa_4_estaciones  -> 4
   * agro_montevideo           -> 6
   * mercado_rural_olivos      -> 8
   *
   * Total: 72 publicaciones.
   */
  const publicacionesPorOperador = [
    { username: "mercado_verde", cantidad: 2 },
    { username: "frutas_del_plata", cantidad: 3 },
    { username: "granja_del_sur", cantidad: 4 },
    { username: "huerta_central", cantidad: 5 },
    { username: "agro_este", cantidad: 6 },
    { username: "campos_litoral", cantidad: 7 },
    { username: "produccion_oriental", cantidad: 8 },
    { username: "cosechas_norte", cantidad: 9 },
    { username: "frescos_del_prado", cantidad: 10 },
    { username: "cooperativa_4_estaciones", cantidad: 4 },
    { username: "agro_montevideo", cantidad: 6 },
    { username: "mercado_rural_olivos", cantidad: 8 },
  ];

  const totalPublicaciones = publicacionesPorOperador.reduce(
    (total, operador) => total + operador.cantidad,
    0
  );

  const especiesDisponibles = await prisma.orm.public.Especie
    .where((e) => e.especieActiva.eq(true))
    .orderBy((e) => e.nombreEspecie.asc())
    .all();

  const variedadesDisponibles = await prisma.orm.public.Variedad
    .where((v) => v.variedadActiva.eq(true))
    .orderBy((v) => v.nombreVariedad.asc())
    .all();

  const presentacionesDisponibles =
    await prisma.orm.public.Presentacion
      .where((p) => p.presentacionActiva.eq(true))
      .orderBy((p) => p.nombrePresentacion.asc())
      .all();

  type CombinacionCatalogo = {
    especieId: number;
    especieNombre: string;
    variedadId: number;
    presentacionId: number;
  };

  const variedadesPorEspecie = new Map<
    number,
    typeof variedadesDisponibles
  >();

  for (const variedad of variedadesDisponibles) {
    const variedades =
      variedadesPorEspecie.get(variedad.especieId) ?? [];

    variedades.push(variedad);
    variedadesPorEspecie.set(variedad.especieId, variedades);
  }

  const presentacionesPorVariedad = new Map<
    number,
    typeof presentacionesDisponibles
  >();

  for (const presentacion of presentacionesDisponibles) {
    const presentaciones =
      presentacionesPorVariedad.get(
        presentacion.variedadId
      ) ?? [];

    presentaciones.push(presentacion);

    presentacionesPorVariedad.set(
      presentacion.variedadId,
      presentaciones
    );
  }

  const combinacionesCatalogo: CombinacionCatalogo[] = [];

  for (const especie of especiesDisponibles) {
    const variedades =
      variedadesPorEspecie.get(especie.id) ?? [];

    for (const variedad of variedades) {
      const presentaciones =
        presentacionesPorVariedad.get(variedad.id) ?? [];

      for (const presentacion of presentaciones) {
        combinacionesCatalogo.push({
          especieId: especie.id,
          especieNombre: especie.nombreEspecie,
          variedadId: variedad.id,
          presentacionId: presentacion.id,
        });
      }
    }
  }

  if (combinacionesCatalogo.length < totalPublicaciones) {
    throw new Error(
      `El catálogo no tiene suficientes combinaciones activas para generar ${totalPublicaciones} publicaciones.`
    );
  }

  const categorias = await prisma.orm.public.Categoria.all();

  const categoriasGeneralesDb = categorias
    .filter((categoria) =>
      categoriasGenerales.includes(categoria.nombreCategoria)
    );

  if (categoriasGeneralesDb.length === 0) {
    throw new Error(
      "No se encontraron las categorías generales."
    );
  }

  const categoriasHuevoDb = categorias.filter(
    (categoria) =>
      ["Chico", "Mediano", "Especial", "Extra", "Jumbo"].includes(
        categoria.nombreCategoria
      )
  );

  const paisesDb = await prisma.orm.public.Pais.all();

  const paisesPorCodigo = new Map<
    string,
    (typeof paisesDb)[number]
  >();

  for (const pais of paisesDb) {
    paisesPorCodigo.set(pais.codigoPais, pais);
  }

  const paisesPrueba = paisesData
    .map((pais) => paisesPorCodigo.get(pais.codigoPais))
    .filter(
      (
        pais
      ): pais is (typeof paisesDb)[number] =>
        pais !== undefined
    );

  if (paisesPrueba.length === 0) {
    throw new Error(
      "No se encontraron países para las publicaciones."
    );
  }

  const calibres = await prisma.orm.public.Calibre
    .orderBy((c) => c.codigoCalibre.asc())
    .all();

  if (calibres.length === 0) {
    throw new Error("No se encontraron calibres.");
  }

  type PublicacionCreateInput =
    Parameters<typeof prisma.orm.public.Publicacion.create>[0];

  type PrecioPublicacion =
    PublicacionCreateInput["precio"];

  function crearPrecio(valor: number): PrecioPublicacion {
    return valor.toFixed(2) as unknown as PrecioPublicacion;
  }

  const precios = [
    45,
    75,
    95,
    95,
    120,
    150,
    180,
    220,
    220,
    275,
    320,
    400,
    550,
    750,
    900,
  ];

  let indicePublicacionGlobal = 0;

  for (const operadorPublicaciones of publicacionesPorOperador) {
    const operadorId = operadorIds.get(
      operadorPublicaciones.username
    );

    if (!operadorId) {
      throw new Error(
        `No se encontró el operador ${operadorPublicaciones.username}.`
      );
    }

    for (
      let indiceLocal = 0;
      indiceLocal < operadorPublicaciones.cantidad;
      indiceLocal++
    ) {
      const indiceCatalogo =
        totalPublicaciones === 1
          ? 0
          : Math.floor(
              (indicePublicacionGlobal *
                (combinacionesCatalogo.length - 1)) /
                (totalPublicaciones - 1)
            );

      const combinacion =
        combinacionesCatalogo[indiceCatalogo];

      const esHuevo = combinacion.especieNombre
        .toLowerCase()
        .includes("huevo");

      let categoria;

      if (esHuevo && categoriasHuevoDb.length > 0) {
        categoria =
          categoriasHuevoDb[
            indicePublicacionGlobal %
              categoriasHuevoDb.length
          ];
      } else {
        categoria =
          categoriasGeneralesDb[
            indicePublicacionGlobal %
              categoriasGeneralesDb.length
          ];
      }

      const calibre =
        calibres[
          indicePublicacionGlobal % calibres.length
        ];

      const pais =
        paisesPrueba[
          indicePublicacionGlobal %
            paisesPrueba.length
        ];

      const precio =
        precios[
          indicePublicacionGlobal % precios.length
        ];

      const fecha = Temporal.Instant.from(
        `2026-09-${String(
          Math.min(indicePublicacionGlobal + 1, 30)
        ).padStart(2, "0")}T10:00:00Z`
      );

      const publicacion =
        await prisma.orm.public.Publicacion.create({
          fecha,
          publicacionDisponible: true,
          publicacionActiva: true,
          precio: crearPrecio(precio),
          tipoPublicacion: "OPERADOR",
          presentacionId: combinacion.presentacionId,
          categoriaId: categoria.id,
          calibreId: calibre.id,
        });

      await prisma.orm.public.PublicacionOperador.create({
        publicacionId: publicacion.id,
        operadorId,
        paisId: pais.id,
      });

      indicePublicacionGlobal++;
    }
  }

  console.log(
    `Publicaciones de operadores creadas: ${totalPublicaciones}`
  );

  // 12. CONFIGURACIONES
  console.log("Cargando configuraciones...");

  await prisma.orm.public.Configuracion.create({
    nombreConfiguracion: "incremento_precio",
    valorConfiguracion: "10",
  });

  console.log("Seed completado exitosamente.");
}

main()
  .catch((e) => {
    console.error("Error ejecutando seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.close();
  });