#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/6199bcda0d7cc5d6c1bb7b01b0d8bc41bcb8252696ec6d8cad02dbeaf8f84b57/contract';
import startContract from '../../snapshots/6199bcda0d7cc5d6c1bb7b01b0d8bc41bcb8252696ec6d8cad02dbeaf8f84b57/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/8285ff20f7b7db2cada1d4288da69acb08cb10855826836478c41dcffc5ae21e/contract';
import endContract from '../../snapshots/8285ff20f7b7db2cada1d4288da69acb08cb10855826836478c41dcffc5ae21e/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, primaryKey, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'historicoPrecios',
        columns: [
          col('especieId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fechaDesde', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('fechaHasta', 'date', { notNull: true, codecRef: { codecId: 'pg/date-temporal@1' } }),
          col('fechaUltimaActualizacion', 'date', {
            notNull: true,
            codecRef: { codecId: 'pg/date-temporal@1' },
          }),
          col('historico', 'jsonb', { notNull: true, codecRef: { codecId: 'pg/jsonb@1' } }),
        ],
        constraints: [primaryKey(['especieId'])],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'historicoPrecios',
        foreignKey: {
          name: 'historicoPrecios_especieId_fkey',
          columns: ['especieId'],
          references: { schema: 'public', table: 'especie', columns: ['id'] },
        },
      }),
      rawSql({
        id: 'data_migration.trasladar_historicos_precios',
        label: 'Trasladar históricos existentes conservando sus valores JSON',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Copiar históricos v2 y retirar sólo las configuraciones transferidas íntegramente',
          sql: `DO $$
DECLARE
  origen RECORD;
  estado JSONB;
  datos JSONB;
  uam_id INTEGER;
  especie_id INTEGER;
  fecha_desde DATE;
  fecha_hasta DATE;
  actualizado DATE;
BEGIN
  FOR origen IN
    SELECT "id", "nombreConfiguracion", "valorConfiguracion"
    FROM "public"."configuracion"
    WHERE "nombreConfiguracion" LIKE 'precios-historicos:v2:especie:%'
    ORDER BY "id"
    FOR UPDATE
  LOOP
    IF origen."nombreConfiguracion" !~ '^precios-historicos:v2:especie:[1-9][0-9]*$' THEN
      CONTINUE;
    END IF;
    BEGIN
      estado := origen."valorConfiguracion"::JSONB;
      uam_id := split_part(origen."nombreConfiguracion", ':', 4)::INTEGER;
      datos := estado -> 'historico';
      IF jsonb_typeof(estado) IS DISTINCT FROM 'object'
        OR (estado -> 'version') IS DISTINCT FROM '2'::JSONB
        OR jsonb_typeof(datos) IS DISTINCT FROM 'object'
        OR jsonb_typeof(datos -> 'species_id') IS DISTINCT FROM 'number'
        OR (datos ->> 'species_id')::NUMERIC <> uam_id
        OR jsonb_typeof(datos -> 'series') IS DISTINCT FROM 'array'
        OR jsonb_typeof(datos -> 'from') IS DISTINCT FROM 'string'
        OR jsonb_typeof(datos -> 'to') IS DISTINCT FROM 'string'
        OR jsonb_typeof(estado -> 'fechaUltimaActualizacion') IS DISTINCT FROM 'string'
      THEN
        CONTINUE;
      END IF;
      IF (datos ->> 'from') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR (datos ->> 'to') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        OR (estado ->> 'fechaUltimaActualizacion') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      THEN
        CONTINUE;
      END IF;
      fecha_desde := (datos ->> 'from')::DATE;
      fecha_hasta := (datos ->> 'to')::DATE;
      actualizado := (estado ->> 'fechaUltimaActualizacion')::DATE;
      IF fecha_desde > fecha_hasta
        OR to_char(fecha_desde, 'YYYY-MM-DD') <> (datos ->> 'from')
        OR to_char(fecha_hasta, 'YYYY-MM-DD') <> (datos ->> 'to')
        OR to_char(actualizado, 'YYYY-MM-DD') <> (estado ->> 'fechaUltimaActualizacion')
      THEN
        CONTINUE;
      END IF;
    EXCEPTION WHEN data_exception THEN
      CONTINUE;
    END;
    SELECT "id" INTO especie_id FROM "public"."especie" WHERE "uamId" = uam_id;
    IF especie_id IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO "public"."historicoPrecios"
      ("especieId", "historico", "fechaDesde", "fechaHasta", "fechaUltimaActualizacion")
    VALUES (especie_id, datos, fecha_desde, fecha_hasta, actualizado)
    ON CONFLICT ("especieId") DO NOTHING;
    DELETE FROM "public"."configuracion" AS configuracion
    WHERE configuracion."id" = origen."id"
      AND EXISTS (
        SELECT 1 FROM "public"."historicoPrecios" AS destino
        WHERE destino."especieId" = especie_id
          AND destino."historico" = datos
          AND destino."fechaDesde" = fecha_desde
          AND destino."fechaHasta" = fecha_hasta
          AND destino."fechaUltimaActualizacion" = actualizado
      );
  END LOOP;
  DELETE FROM "public"."configuracion"
  WHERE "nombreConfiguracion" = 'precios-historicos:v2:sincronizacion'
    AND NOT EXISTS (
      SELECT 1 FROM "public"."configuracion"
      WHERE "nombreConfiguracion" LIKE 'precios-historicos:v2:especie:%'
    );
END;
$$;`,
        }],
        postcheck: [],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
