#!/usr/bin/env -S node
import type { Contract as End } from '../../snapshots/52517bb0a16d58db079daa0aef1b9c3237b7c28579ac4d236f9129304d447ff4/contract';
import endContract from '../../snapshots/52517bb0a16d58db079daa0aef1b9c3237b7c28579ac4d236f9129304d447ff4/contract.json' with { type: 'json' };
import {
  Migration,
  MigrationCLI,
  checkExpression,
  col,
  fn,
  lit,
  primaryKey,
} from '@prisma/orm-postgres/migration';

export default class M extends Migration<never, End> {
  override readonly endContractJson = endContract;

  override get operations() {
    return [
      this.createSchema({ schema: 'public' }),
      this.createTable({
        schema: 'public',
        table: 'administrador',
        columns: [
          col('email', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('usuarioId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'calibre',
        columns: [
          col('codigoCalibre', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreCalibre', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'categoria',
        columns: [
          col('especieId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreCategoria', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'configuracion',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreConfiguracion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('valorConfiguracion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'departamento',
        columns: [
          col('codigoDepartamento', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreDepartamento', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'especie',
        columns: [
          col('especieActiva', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreEspecie', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'local',
        columns: [
          col('finContrato', 'timestamptz', {
            notNull: true,
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('naveId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('numeroLocal', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('operadorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'nave',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreNave', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'notificacion',
        columns: [
          col('descripcion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('titulo', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usuarioId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('vista', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'operador',
        columns: [
          col('comentario', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('enLicencia', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreFantasia', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('usuarioId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('whatsApp', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'pais',
        columns: [
          col('codigoPais', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombrePais', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'presentacion',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('kgPorUnidad', 'numeric(10,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 10, scale: 2 } },
          }),
          col('nombrePresentacion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('presentacionActiva', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('presentacionDefault', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('uamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('variedadId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'productor',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('usuarioId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('whatsApp', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'publicacion',
        columns: [
          col('calibreId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('categoriaId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('fecha', 'timestamptz', {
            notNull: true,
            default: fn('now()'),
            codecRef: { codecId: 'pg/timestamptz-temporal@1' },
          }),
          col('foto', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('precio', 'numeric(12,2)', {
            codecRef: { codecId: 'pg/numeric@1', typeParams: { precision: 12, scale: 2 } },
          }),
          col('presentacionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('publicacionActiva', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('publicacionDisponible', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('tipoPublicacion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'publicacion_tipoPublicacion_check_16d8ebb9',
            "\"tipoPublicacion\" IN ('OPERADOR', 'PRODUCTOR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'publicacionOperador',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('operadorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('paisId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('publicacionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'publicacionProductor',
        columns: [
          col('departamentoId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('direccion', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('productorId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('publicacionId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.createTable({
        schema: 'public',
        table: 'usuario',
        columns: [
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('passwordHash', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('rol', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('twoFactorEnabled', 'bool', {
            notNull: true,
            default: lit(false),
            codecRef: { codecId: 'pg/bool@1' },
          }),
          col('twoFactorSecret', 'text', { codecRef: { codecId: 'pg/text@1' } }),
          col('username', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
        ],
        constraints: [
          primaryKey(['id']),
          checkExpression(
            'usuario_rol_check_7523852b',
            "\"rol\" IN ('ADMINISTRADOR', 'OPERADOR', 'PRODUCTOR')",
          ),
        ],
      }),
      this.createTable({
        schema: 'public',
        table: 'variedad',
        columns: [
          col('especieId', 'int4', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('id', 'SERIAL', { notNull: true, codecRef: { codecId: 'pg/int4@1' } }),
          col('nombreVariedad', 'text', { notNull: true, codecRef: { codecId: 'pg/text@1' } }),
          col('uamId', 'int4', { codecRef: { codecId: 'pg/int4@1' } }),
          col('variedadActiva', 'bool', {
            notNull: true,
            default: lit(true),
            codecRef: { codecId: 'pg/bool@1' },
          }),
        ],
        constraints: [primaryKey(['id'])],
      }),
      this.addUnique({
        schema: 'public',
        table: 'administrador',
        constraint: 'administrador_usuarioId_key',
        columns: ['usuarioId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'administrador',
        constraint: 'administrador_email_key',
        columns: ['email'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'calibre',
        constraint: 'calibre_codigoCalibre_key',
        columns: ['codigoCalibre'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'configuracion',
        constraint: 'configuracion_nombreConfiguracion_key',
        columns: ['nombreConfiguracion'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'departamento',
        constraint: 'departamento_codigoDepartamento_key',
        columns: ['codigoDepartamento'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'departamento',
        constraint: 'departamento_nombreDepartamento_key',
        columns: ['nombreDepartamento'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'especie',
        constraint: 'especie_uamId_key',
        columns: ['uamId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'local',
        constraint: 'local_numeroLocal_naveId_key',
        columns: ['numeroLocal', 'naveId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'nave',
        constraint: 'nave_nombreNave_key',
        columns: ['nombreNave'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'operador',
        constraint: 'operador_usuarioId_key',
        columns: ['usuarioId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'operador',
        constraint: 'operador_nombreFantasia_key',
        columns: ['nombreFantasia'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'pais',
        constraint: 'pais_codigoPais_key',
        columns: ['codigoPais'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'pais',
        constraint: 'pais_nombrePais_key',
        columns: ['nombrePais'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'presentacion',
        constraint: 'presentacion_uamId_key',
        columns: ['uamId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'productor',
        constraint: 'productor_usuarioId_key',
        columns: ['usuarioId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'publicacionOperador',
        constraint: 'publicacionOperador_publicacionId_key',
        columns: ['publicacionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'publicacionProductor',
        constraint: 'publicacionProductor_publicacionId_key',
        columns: ['publicacionId'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'usuario',
        constraint: 'usuario_username_key',
        columns: ['username'],
      }),
      this.addUnique({
        schema: 'public',
        table: 'variedad',
        constraint: 'variedad_uamId_key',
        columns: ['uamId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'categoria',
        index: 'categoria_especieId_idx_23a2c94e',
        columns: ['especieId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'local',
        index: 'local_naveId_idx_d122209c',
        columns: ['naveId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'local',
        index: 'local_operadorId_idx_b7d31568',
        columns: ['operadorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'notificacion',
        index: 'notificacion_usuarioId_idx_5f01c7d6',
        columns: ['usuarioId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'presentacion',
        index: 'presentacion_variedadId_idx_33d5d76b',
        columns: ['variedadId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_calibreId_idx_d38391a8',
        columns: ['calibreId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_categoriaId_idx_63b46427',
        columns: ['categoriaId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacion',
        index: 'publicacion_presentacionId_idx_2981aeac',
        columns: ['presentacionId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacionOperador',
        index: 'publicacionOperador_operadorId_idx_b7d31568',
        columns: ['operadorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacionOperador',
        index: 'publicacionOperador_paisId_idx_9a54dcb8',
        columns: ['paisId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacionProductor',
        index: 'publicacionProductor_departamentoId_idx_d1d4bda1',
        columns: ['departamentoId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'publicacionProductor',
        index: 'publicacionProductor_productorId_idx_9eeddee0',
        columns: ['productorId'],
      }),
      this.createIndex({
        schema: 'public',
        table: 'variedad',
        index: 'variedad_especieId_idx_23a2c94e',
        columns: ['especieId'],
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'administrador',
        foreignKey: {
          name: 'administrador_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuario', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'categoria',
        foreignKey: {
          name: 'categoria_especieId_fkey',
          columns: ['especieId'],
          references: { schema: 'public', table: 'especie', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'local',
        foreignKey: {
          name: 'local_operadorId_fkey',
          columns: ['operadorId'],
          references: { schema: 'public', table: 'operador', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'local',
        foreignKey: {
          name: 'local_naveId_fkey',
          columns: ['naveId'],
          references: { schema: 'public', table: 'nave', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'notificacion',
        foreignKey: {
          name: 'notificacion_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuario', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'operador',
        foreignKey: {
          name: 'operador_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuario', columns: ['id'] },
          onDelete: 'cascade',
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
        table: 'productor',
        foreignKey: {
          name: 'productor_usuarioId_fkey',
          columns: ['usuarioId'],
          references: { schema: 'public', table: 'usuario', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_presentacionId_fkey',
          columns: ['presentacionId'],
          references: { schema: 'public', table: 'presentacion', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_categoriaId_fkey',
          columns: ['categoriaId'],
          references: { schema: 'public', table: 'categoria', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacion',
        foreignKey: {
          name: 'publicacion_calibreId_fkey',
          columns: ['calibreId'],
          references: { schema: 'public', table: 'calibre', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionOperador',
        foreignKey: {
          name: 'publicacionOperador_publicacionId_fkey',
          columns: ['publicacionId'],
          references: { schema: 'public', table: 'publicacion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionOperador',
        foreignKey: {
          name: 'publicacionOperador_operadorId_fkey',
          columns: ['operadorId'],
          references: { schema: 'public', table: 'operador', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionOperador',
        foreignKey: {
          name: 'publicacionOperador_paisId_fkey',
          columns: ['paisId'],
          references: { schema: 'public', table: 'pais', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionProductor',
        foreignKey: {
          name: 'publicacionProductor_publicacionId_fkey',
          columns: ['publicacionId'],
          references: { schema: 'public', table: 'publicacion', columns: ['id'] },
          onDelete: 'cascade',
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionProductor',
        foreignKey: {
          name: 'publicacionProductor_productorId_fkey',
          columns: ['productorId'],
          references: { schema: 'public', table: 'productor', columns: ['id'] },
        },
      }),
      this.addForeignKey({
        schema: 'public',
        table: 'publicacionProductor',
        foreignKey: {
          name: 'publicacionProductor_departamentoId_fkey',
          columns: ['departamentoId'],
          references: { schema: 'public', table: 'departamento', columns: ['id'] },
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
