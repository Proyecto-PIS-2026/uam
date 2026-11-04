#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract';
import endContract from '../../snapshots/587d00b79527ec81141f638af26883b9e798538aeb430f58bbb416f5b1c05588/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/f91697ce0934a9b5ebbfe875154982a1719b5ebf1812116844194dd39fc43687/contract';
import startContract from '../../snapshots/f91697ce0934a9b5ebbfe875154982a1719b5ebf1812116844194dd39fc43687/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, lit, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createTable({
        schema: 'public',
        table: 'estadisticaContacto',
        columns: [
          col('cantidad', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('fecha', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'estadisticaPublicacion',
        columns: [
          col('cantidad', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('fecha', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'estadisticaVisita',
        columns: [
          col('cantidad', 'int4', {
            notNull: true,
            default: lit(0),
            codecRef: { codecId: 'pg/int4@1' },
          }),
          col('fecha', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('tipoVisitante', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
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
      this.addUnique({
        schema: 'public',
        table: 'estadisticaContacto',
        constraint: 'estadisticaContacto_fecha_username_key',
        columns: ['fecha', 'username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'estadisticaPublicacion',
        constraint: 'estadisticaPublicacion_fecha_username_key',
        columns: ['fecha', 'username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'estadisticaVisita',
        constraint: 'estadisticaVisita_fecha_tipoVisitante_key',
        columns: ['fecha', 'tipoVisitante'],
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
