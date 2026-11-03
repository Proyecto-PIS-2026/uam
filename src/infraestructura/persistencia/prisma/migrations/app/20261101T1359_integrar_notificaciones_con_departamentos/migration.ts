#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract';
import startContract from '../../snapshots/00a5c4d0c5097c79610099c4b873c840008171e7667a703de42c1134851046e6/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/db0bb2af972b451bef5b50a6367375df63008e0555a34e735f906ed0e83cf268/contract';
import endContract from '../../snapshots/db0bb2af972b451bef5b50a6367375df63008e0555a34e735f906ed0e83cf268/contract.json' with { type: 'json' };
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
