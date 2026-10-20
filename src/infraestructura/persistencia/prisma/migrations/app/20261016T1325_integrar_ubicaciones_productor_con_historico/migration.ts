#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/7c157f9d97fc2e8870f9ce0262a133f15e5d9ab81d48f8869ecd817e25f241e0/contract';
import endContractJson from '../../snapshots/7c157f9d97fc2e8870f9ce0262a133f15e5d9ab81d48f8869ecd817e25f241e0/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/8285ff20f7b7db2cada1d4288da69acb08cb10855826836478c41dcffc5ae21e/contract';
import startContract from '../../snapshots/8285ff20f7b7db2cada1d4288da69acb08cb10855826836478c41dcffc5ae21e/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  col,
  primaryKey,
} from '@prisma/orm-postgres/migration';
import postgresAdapter from '@prisma/orm-postgres/adapter/runtime';
import { sql } from '@prisma/orm-postgres/builder/runtime';
import { createExecutionContext, createSqlExecutionStack } from '@prisma/orm-postgres/family-runtime';
import postgresTarget, { PostgresContractSerializer } from '@prisma/orm-postgres/target/runtime';

const endContract = new PostgresContractSerializer().deserializeContract<End>(endContractJson);
const stack = createSqlExecutionStack({ target: postgresTarget, adapter: postgresAdapter });
const db = sql<End>({
  context: createExecutionContext({ contract: endContract, stack }),
  rawCodecInferer: stack.adapter.rawCodecInferer,
});

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContractJson;

  override get operations() {
    return [
      this.dropColumn({ schema: 'public', table: 'publicacionProductor', column: 'direccion' }),
      this.dropConstraint({
        schema: 'public',
        table: 'publicacionProductor',
        constraint: 'publicacionProductor_departamentoId_fkey',
        kind: 'foreignKey',
      }),
      this.dropTable({ schema: 'public', table: 'departamento' }),
      this.dropIndex({
        schema: 'public',
        table: 'publicacionProductor',
        index: 'publicacionProductor_departamentoId_idx_d1d4bda1',
      }),
      this.dropColumn({
        schema: 'public',
        table: 'publicacionProductor',
        column: 'departamentoId',
      }),
      this.createTable({
        schema: 'public',
        table: 'ubicacion',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreUbicacion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('publicacionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('urlMaps', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'productor',
        column: col('fotoPerfil', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'productor',
        column: col('nombreFantasia', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.dataTransform(endContract, 'backfill-productor-nombreFantasia', {
        check: () =>
          db.public.productor
            .select('id')
            .where((f, fns) => fns.eq(f.nombreFantasia, null))
            .limit(1),
        run: () =>
          db.public.productor
            .update((f, fns) => ({
              nombreFantasia: fns.raw`'TEMP-productor-' || ${f.id}`.returns('pg/text@1'),
            }))
            .where((f, fns) => fns.eq(f.nombreFantasia, null)),
      }),
      this.setNotNull({ schema: 'public', table: 'productor', column: 'nombreFantasia' }),
      this.addColumn({
        schema: 'public',
        table: 'publicacionProductor',
        column: col('paisId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.setNotNull({ schema: 'public', table: 'publicacionProductor', column: 'paisId' }),
      this.addUnique({
        schema: 'public',
        table: 'productor',
        constraint: 'productor_nombreFantasia_key',
        columns: ['nombreFantasia'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacionProductor',
        index: 'publicacionProductor_paisId_idx_9a54dcb8',
        columns: ['paisId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'ubicacion',
        index: 'ubicacion_publicacionId_idx_a4fbf198',
        columns: ['publicacionId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionProductor',
        foreignKey: {
          name: 'publicacionProductor_paisId_fkey',
          columns: ['paisId'],
          references: { schema: 'public', table: 'pais', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'ubicacion',
        foreignKey: {
          name: 'ubicacion_publicacionId_fkey',
          columns: ['publicacionId'],
          references: { schema: 'public', table: 'publicacionProductor', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
