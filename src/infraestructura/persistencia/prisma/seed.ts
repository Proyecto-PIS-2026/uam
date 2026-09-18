import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

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
    "Nave A",
    "Nave B",
    "Nave C",
    "Nave D",
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