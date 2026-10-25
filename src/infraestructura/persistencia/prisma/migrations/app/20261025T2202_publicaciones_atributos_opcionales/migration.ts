#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/580baa18385f3be13bd65c632f572151ac3bed83620b4f21eb6d1f5f98c4b59a/contract';
import endContract from '../../snapshots/580baa18385f3be13bd65c632f572151ac3bed83620b4f21eb6d1f5f98c4b59a/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/6b31658ea64079e091b507d9944874ebee46bdc19fa80ccdc2a96259ebb04492/contract';
import startContract from '../../snapshots/6b31658ea64079e091b507d9944874ebee46bdc19fa80ccdc2a96259ebb04492/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('variedadId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('especieId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      rawSql({
        id: 'data_migration.completar_especie_variedad_publicaciones',
        label: 'Conservar especie y variedad de las publicaciones existentes',
        operationClass: 'data',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Copiar la especie y variedad antes de permitir atributos vacíos',
          sql: `UPDATE "public"."publicacion" AS publicacion
SET "especieId" = variedad."especieId", "variedadId" = variedad."id"
FROM "public"."presentacion" AS presentacion
JOIN "public"."variedad" AS variedad ON variedad."id" = presentacion."variedadId"
WHERE publicacion."presentacionId" = presentacion."id";`,
        }],
        postcheck: [],
      }),
      this.setNotNull({ schema: 'public', table: 'publicacion', column: 'especieId' }),
      this.dropNotNull({ schema: 'public', table: 'publicacion', column: 'calibreId' }),
      this.dropNotNull({ schema: 'public', table: 'publicacion', column: 'categoriaId' }),
      this.dropNotNull({ schema: 'public', table: 'publicacion', column: 'presentacionId' }),
      this.dropNotNull({ schema: 'public', table: 'publicacionOperador', column: 'paisId' }),
      this.dropNotNull({ schema: 'public', table: 'publicacionProductor', column: 'paisId' }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_especieId_idx_23a2c94e',
        columns: ['especieId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_variedadId_idx_33d5d76b',
        columns: ['variedadId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_especieId_fkey',
          columns: ['especieId'],
          references: { schema: 'public', table: 'especie', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_variedadId_fkey',
          columns: ['variedadId'],
          references: { schema: 'public', table: 'variedad', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
