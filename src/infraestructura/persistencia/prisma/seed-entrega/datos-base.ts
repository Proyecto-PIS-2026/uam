import type postgres from "@prisma/orm-postgres/runtime";
import { readdirSync } from "node:fs";
import type { Contract } from "../contract.d";
import { cargarConsultaUam } from "../catalogo-consulta";
import {
  CALIBRES_GENERALES_ADICIONALES,
  ENVASES_PUBLICACION,
  KILOS_EMPAQUETADO,
} from "../catalogos-publicacion";

/** Acepta tanto el cliente principal como el cliente de una transacción. */
export type ClienteSeed = Pick<ReturnType<typeof postgres<Contract>>, "orm">;

export type EspecieSeed = {
  id: number;
  uamId: number;
  nombre: string;
  fotoEspecie: string | null;
};

export type DatosBaseSeed = {
  paisIds: Map<string, number>;
  calibreIds: Map<string, number>;
  envaseIds: Map<string, number>;
  kilosIds: Map<string, number>;
  especieIds: Map<number, number>;
  especies: EspecieSeed[];
  /** Las claves son JSON.stringify([uamIdEspecie, nombreVariedad]). */
  variedadIds: Map<string, number>;
  /** Las claves son JSON.stringify([uamIdEspecie, nombreCategoria]). */
  categoriaIds: Map<string, number>;
  naveIds: Map<string, number>;
};

const CODIGOS_PAIS: Record<string, string> = {
  ARGENTINA: "AR",
  BOLIVIA: "BO",
  BRASIL: "BR",
  CHILE: "CL",
  ECUADOR: "EC",
  EGIPTO: "EG",
  ESPAÑA: "ES",
  PARAGUAY: "PY",
  PERÚ: "PE",
  URUGUAY: "UY",
};

const NOMBRES_CALIBRE: Record<string, string> = {
  C: "CHICO",
  EG: "EXTRAGRANDE",
  G: "GRANDE",
  M: "MEDIANO",
  SV: "SIN VARIACIÓN",
};

const NAVES_BASE = [
  "A", "B", "C - Polivalente", "D", "E", "Tinglado",
  "MP - A", "NAL - A", "ZAC - I", "ZAC - J",
] as const;

function archivosGenericos(): Set<string> {
  try {
    return new Set(readdirSync(new URL("../../../../../public/generico/", import.meta.url)));
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

/** Carga únicamente catálogos, naves y configuración sobre una base vacía. */
export async function cargarDatosBase(
  prisma: ClienteSeed,
  navesAdicionales: readonly string[] = [],
): Promise<DatosBaseSeed> {
  const consulta = cargarConsultaUam();
  const archivos = archivosGenericos();
  const paises = new Set<string>();
  const calibres = new Set<string>();
  for (const tipo of consulta.types) {
    for (const producto of tipo.products) {
      for (const variedad of producto.varieties) {
        for (const presentacion of variedad.presentations) {
          if (!CODIGOS_PAIS[presentacion.country]) {
            throw new Error(`País sin código ISO en la seed: ${presentacion.country}`);
          }
          paises.add(presentacion.country);
          calibres.add(presentacion.caliber);
        }
      }
    }
  }
  paises.add("ECUADOR");

  const paisIds = new Map<string, number>();
  for (const nombrePais of [...paises].sort()) {
    const pais = await prisma.orm.public.Pais.create({ codigoPais: CODIGOS_PAIS[nombrePais], nombrePais });
    paisIds.set(nombrePais, pais.id);
  }

  const calibreIds = new Map<string, number>();
  for (const codigoCalibre of [...calibres].sort()) {
    const calibre = await prisma.orm.public.Calibre.create({ codigoCalibre, nombreCalibre: NOMBRES_CALIBRE[codigoCalibre] });
    calibreIds.set(codigoCalibre, calibre.id);
  }
  for (const nombreCalibre of CALIBRES_GENERALES_ADICIONALES) {
    const calibre = await prisma.orm.public.Calibre.create({ codigoCalibre: nombreCalibre, nombreCalibre });
    calibreIds.set(nombreCalibre, calibre.id);
  }

  const envaseIds = new Map<string, number>();
  for (const nombreEnvase of ENVASES_PUBLICACION) {
    const envase = await prisma.orm.public.Envase.create({ nombreEnvase });
    envaseIds.set(nombreEnvase, envase.id);
  }

  const kilosIds = new Map<string, number>();
  for (const valor of KILOS_EMPAQUETADO) {
    const kilos = await prisma.orm.public.KilosEmpaquetado.create({ valor });
    kilosIds.set(valor, kilos.id);
  }

  const especieIds = new Map<number, number>();
  const especies: EspecieSeed[] = [];
  const variedadIds = new Map<string, number>();
  const categoriaIds = new Map<string, number>();
  const categoriasGlobales = new Map<string, number>();
  for (const tipo of consulta.types) {
    for (const producto of tipo.products) {
      const fotoEspecie = fotoGenerica(producto.species, archivos);
      const especie = await prisma.orm.public.Especie.create({
        uamId: producto.species_id,
        nombreEspecie: producto.species,
        especieActiva: true,
        fotoEspecie,
      });
      especieIds.set(producto.species_id, especie.id);
      especies.push({ id: especie.id, uamId: producto.species_id, nombre: producto.species, fotoEspecie });

      const codigosCategoria = new Set<string>();
      for (const variedad of producto.varieties) {
        for (const presentacion of variedad.presentations) {
          for (const banda of presentacion.prices) codigosCategoria.add(banda.category);
        }
      }
      for (const nombreCategoria of [...codigosCategoria].sort()) {
        const nombre = nombreCategoria.trim().replace(/\s+/g, " ");
        const nombreNormalizado = nombre.toLowerCase();
        let categoriaId = categoriasGlobales.get(nombreNormalizado);
        if (categoriaId === undefined) {
          const categoria = await prisma.orm.public.Categoria.create({ nombreCategoria: nombre, especieId: null });
          categoriaId = categoria.id;
          categoriasGlobales.set(nombreNormalizado, categoriaId);
        }
        categoriaIds.set(JSON.stringify([producto.species_id, nombreCategoria]), categoriaId);
      }

      for (const variedadFuente of producto.varieties) {
        const variedad = await prisma.orm.public.Variedad.create({
          uamId: null,
          nombreVariedad: variedadFuente.variety,
          variedadActiva: true,
          especieId: especie.id,
        });
        variedadIds.set(JSON.stringify([producto.species_id, variedadFuente.variety]), variedad.id);
      }
    }
  }

  const naveIds = new Map<string, number>();
  for (const nombreNave of new Set<string>([...NAVES_BASE, ...navesAdicionales])) {
    const nave = await prisma.orm.public.Nave.create({ nombreNave });
    naveIds.set(nombreNave, nave.id);
  }

  const configuraciones = [
    ["incremento_precio", "10"],
    ["fecha_consulta_catalogo", consulta.survey_date],
    ["url_lista_inteligente", "https://uam.com.uy/wp-content/uploads/2026/09/MGAP_Lista_Inteligente_PDF-1.pdf"],
    ["ordenamiento_habilitado", "true"],
    ["orden_landing_page_default", "mas_vendidas"],
    ["orden_mercado_virtual_default", "mas_vendidas"],
    ["orden_mercado_produccion_default", "mas_vendidas"],
    ["aging_fotos_habilitado", "true"],
    ["vigencia_fotos", "3"],
    ["aviso_vencimiento_fotos_habilitado", "true"],
    ["anticipacion_aviso_fotos", "1"],
    ["aging_fotos_productor_habilitado", "true"],
    ["vigencia_fotos_productor", "3"],
    ["aviso_vencimiento_fotos_productor_habilitado", "true"],
    ["anticipacion_aviso_fotos_productor", "1"],
    ["vigencia_publicaciones_operador_habilitada", "true"],
    ["vigencia_publicaciones_operador", "30"],
    ["aviso_vencimiento_publicaciones_operador_habilitado", "true"],
    ["anticipacion_aviso_publicaciones_operador", "7"],
    ["vigencia_publicaciones_productor_habilitada", "true"],
    ["vigencia_publicaciones_productor", "30"],
    ["aviso_vencimiento_publicaciones_productor_habilitado", "true"],
    ["anticipacion_aviso_publicaciones_productor", "7"],
    ["anticipacion_aviso_vencimiento_locales", "3"],
    ["aviso_vencimiento_locales_habilitado", "true"],
    ["restablecimiento_contrasena_habilitado", "true"],
  ] as const;
  for (const [nombreConfiguracion, valorConfiguracion] of configuraciones) {
    await prisma.orm.public.Configuracion.create({ nombreConfiguracion, valorConfiguracion });
  }

  return {
    paisIds, calibreIds, envaseIds, kilosIds,
    especieIds, especies, variedadIds, categoriaIds, naveIds,
  };
}
