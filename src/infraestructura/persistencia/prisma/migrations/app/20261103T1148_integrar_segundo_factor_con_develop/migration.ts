#!/usr/bin/env -S node
import type { Contract as Start } from '../../snapshots/149910bfd795df83b5062a61a8970337898a14127bf3455f1c4ef1603311774a/contract';
import startContract from '../../snapshots/149910bfd795df83b5062a61a8970337898a14127bf3455f1c4ef1603311774a/contract.json' with { type: 'json' };
import type { Contract as End } from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract';
import endContract from '../../snapshots/d5efabd362361b30e8605fcbda72e058bc06328b97ce4850c8f4656180df0075/contract.json' with { type: 'json' };
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
      this.addColumn({
        schema: 'public',
        table: 'usuario',
        column: col('habilitado', 'bool', {
          notNull: true,
          default: lit(true),
          codecRef: { codecId: 'pg/bool@1' },
        }),
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
