#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract';
import endContract from '../../snapshots/b72f67d61ed79fbd975aa468cca108514f199d30f938321fe21fa6ceddbe54fe/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/db0bb2af972b451bef5b50a6367375df63008e0555a34e735f906ed0e83cf268/contract';
import startContract from '../../snapshots/db0bb2af972b451bef5b50a6367375df63008e0555a34e735f906ed0e83cf268/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, lit, primaryKey } from '@prisma/orm-postgres/migration';

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
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
