#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/580baa18385f3be13bd65c632f572151ac3bed83620b4f21eb6d1f5f98c4b59a/contract';
import startContract from '../../snapshots/580baa18385f3be13bd65c632f572151ac3bed83620b4f21eb6d1f5f98c4b59a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/ab324b686f298874a9b085ab4fb43de91ec22d019f9fbd7a4d9a0c6219d8b363/contract';
import endContract from '../../snapshots/ab324b686f298874a9b085ab4fb43de91ec22d019f9fbd7a4d9a0c6219d8b363/contract.json' with { type: 'json' };
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
