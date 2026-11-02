#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/5e271a823a56565fdb0caf8ff987d18fa113cb1aa5bc4b6e37317270e4cb2b45/contract';
import startContract from '../../snapshots/5e271a823a56565fdb0caf8ff987d18fa113cb1aa5bc4b6e37317270e4cb2b45/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract';
import endContract from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.addColumn({
        schema: 'public',
        table: 'notificacion',
        column: col('fecha', 'timestamptz(3)', {
          notNull: true,
          default: fn('now()'),
          codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'notificacion',
        column: col('url', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.createIndex({
        schema: 'public',
        table: 'notificacion',
        index: 'notificacion_usuarioId_fecha_id_idx_eb1c24cd',
        columns: ['usuarioId', 'fecha', 'id'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notificacion',
        index: 'notificacion_usuarioId_vista_idx_36fef1d8',
        columns: ['usuarioId', 'vista'],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
