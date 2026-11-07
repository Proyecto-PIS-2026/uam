#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/d79f1cd356b2a43f5bd3afc98fe6393e620060df81d4cdc92dea125dbdbbd1b6/contract';
import endContract from '../../snapshots/d79f1cd356b2a43f5bd3afc98fe6393e620060df81d4cdc92dea125dbdbbd1b6/contract.json' with { type: 'json' };
import type { Contract as Start } from '../../snapshots/dd2325f84e913b72a7ab0918be5325fea4a11638dff51a37d577978c8637f59c/contract';
import startContract from '../../snapshots/dd2325f84e913b72a7ab0918be5325fea4a11638dff51a37d577978c8637f59c/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, col, fn, primaryKey } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Start, End> {
  override readonly startContractJson = startContract;
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.dropConstraint({
        schema: 'public',
        table: 'publicacion',
        constraint: 'publicacion_presentacionId_fkey',
        kind: 'foreignKey',
      }),
      this.dropIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_presentacionId_idx_2981aeac',
      }),
      this.dropColumn({ schema: 'public', table: 'publicacion', column: 'presentacionId' }),
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
      this.createTable({
        schema: 'public',
        table: 'envase',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreEnvase', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'kilosEmpaquetado',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('valor', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'sesionRevocada',
        columns: [
          col('expiraEn', 'timestamptz(3)', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1', typeParams: { precision: 3 } },
          }),
          col('tokenHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['tokenHash'])],
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('comentario', 'text', { codecRef: { codecId: 'pg/text@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('envaseId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('fechaVigencia', 'timestamptz', {
          codecRef: { codecId: 'pg/timestamptz-temporal@1' },
        }),
      }),
      this.addColumn({
        schema: 'public',
        table: 'publicacion',
        column: col('kilosId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
      }),
      this.addUnique({
        schema: 'public',
        table: 'avisoVencimientoLocal',
        constraint: 'avisoVencimientoLocal_contrato_tipo_key',
        columns: ['operadorId', 'naveId', 'numeroLocal', 'finContrato', 'tipo'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'envase',
        constraint: 'envase_nombreEnvase_key',
        columns: ['nombreEnvase'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'kilosEmpaquetado',
        constraint: 'kilosEmpaquetado_valor_key',
        columns: ['valor'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'avisoVencimientoLocal',
        index: 'avisoVencimientoLocal_operadorId_idx_b7d31568',
        columns: ['operadorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_envaseId_idx_c66e7843',
        columns: ['envaseId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_kilosId_idx_9257854e',
        columns: ['kilosId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'sesionRevocada',
        index: 'sesionRevocada_expiraEn_idx_68039536',
        columns: ['expiraEn'],
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
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_envaseId_fkey',
          columns: ['envaseId'],
          references: { schema: 'public', table: 'envase', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_kilosId_fkey',
          columns: ['kilosId'],
          references: { schema: 'public', table: 'kilosEmpaquetado', columns: ['id'] },
        },
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
