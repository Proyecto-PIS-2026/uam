#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/8cd9f14383493582bbd0bec140601255dbda4a6475653fa6dd26847bd06a4616/contract';
import endContract from '../../snapshots/8cd9f14383493582bbd0bec140601255dbda4a6475653fa6dd26847bd06a4616/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'especie',
        columns: [
          col('activa', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('grupoId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombre', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'grupo',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombre', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uamId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'mensaje',
        columns: [
          col('createdAt', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('texto', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'presentacion',
        columns: [
          col('activa', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('esDefault', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kgPorUnidad', 'numeric', { codecRef: { codecId: 'pg/numeric@1' } }),
          col('nombre', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('uamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('variedadId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'variedad',
        columns: [
          col('activa', 'bool', { codecRef: { codecId: 'pg/bool@1' } }),
          col('especieId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombre', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('uamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'especie',
        constraint: 'especie_uamId_key',
        columns: ['uamId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'grupo',
        constraint: 'grupo_uamId_key',
        columns: ['uamId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'presentacion',
        constraint: 'presentacion_uamId_key',
        columns: ['uamId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'variedad',
        constraint: 'variedad_uamId_key',
        columns: ['uamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'especie',
        index: 'especie_grupoId_idx_49e0b9e4',
        columns: ['grupoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'presentacion',
        index: 'presentacion_variedadId_idx_33d5d76b',
        columns: ['variedadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'variedad',
        index: 'variedad_especieId_idx_23a2c94e',
        columns: ['especieId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'especie',
        foreignKey: {
          name: 'especie_grupoId_fkey',
          columns: ['grupoId'],
          references: { schema: 'public', table: 'grupo', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'presentacion',
        foreignKey: {
          name: 'presentacion_variedadId_fkey',
          columns: ['variedadId'],
          references: { schema: 'public', table: 'variedad', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'variedad',
        foreignKey: {
          name: 'variedad_especieId_fkey',
          columns: ['especieId'],
          references: { schema: 'public', table: 'especie', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
