#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8ca6395c9b4912fea56216d23ddb5e1c92416c1a91f2fe1738adf6abc7656ef3/contract';
import endContract from '../../snapshots/8ca6395c9b4912fea56216d23ddb5e1c92416c1a91f2fe1738adf6abc7656ef3/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/a09547d007bfed4af7744500b7a0a0b9de16165c312f05643f0666456fe50abb/contract';
import startContract from '../../snapshots/a09547d007bfed4af7744500b7a0a0b9de16165c312f05643f0666456fe50abb/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'avisoVencimientoLocal',
        columns: [
          col('fecha', 'timestamptz(3)', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('finContrato', 'date', {
            notNull: true,
            codecRef: { codecId: 'pg/date-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('naveId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('numeroLocal', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('operadorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tipo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'avisoVencimientoLocal',
        constraint: 'avisoVencimientoLocal_contrato_tipo_key',
        columns: ['operadorId', 'naveId', 'numeroLocal', 'finContrato', 'tipo'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'avisoVencimientoLocal',
        index: 'avisoVencimientoLocal_operadorId_idx_b7d31568',
        columns: ['operadorId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'avisoVencimientoLocal',
        foreignKey: {
          name: 'avisoVencimientoLocal_operadorId_fkey',
          columns: ['operadorId'],
          references: { schema: 'public', table: 'operador', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
