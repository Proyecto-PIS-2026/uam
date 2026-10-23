#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/4c1be49ae006f84744eab77f4bcbaf4fc56a44f9a625e65984629e8806b440f8/contract';
import endContract from '../../snapshots/4c1be49ae006f84744eab77f4bcbaf4fc56a44f9a625e65984629e8806b440f8/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/d35c23367da1c32c344855a6e2f38be254754d64822b8595be691a0f20a430f1/contract';
import startContract from '../../snapshots/d35c23367da1c32c344855a6e2f38be254754d64822b8595be691a0f20a430f1/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

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
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('solicitoRestablecimiento', 'bool', {
          notNull: true,
          default: lit(false),
          codecRef: { codecId: 'pg/bool@1' },
        }),
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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
