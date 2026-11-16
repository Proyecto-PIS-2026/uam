#!/usr/bin/env -S node
import type { Contract } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import contract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

export default class M extends Migration<Contract, Contract> {
  override readonly startContractJson = contract;
  override readonly endContractJson = contract;

  override get operations() {
    return [
      rawSql({
        id: 'data_migration.habilitacion_avisos_vencimiento_locales',
        label: 'Permitir habilitar y deshabilitar los avisos de vencimiento de locales',
        operationClass: 'data',
        invariantId: 'uam:habilitacion-avisos-vencimiento-locales',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Mantener los avisos habilitados sin sobrescribir una configuración existente ni su anticipación',
          sql: `INSERT INTO "public"."configuracion" ("nombreConfiguracion", "valorConfiguracion") VALUES ('aviso_vencimiento_locales_habilitado', 'true') ON CONFLICT ("nombreConfiguracion") DO NOTHING;`,
        }],
        postcheck: [{
          description: 'Verificar que existe la habilitación configurable de los avisos de locales',
          sql: `SELECT EXISTS (SELECT 1 FROM "public"."configuracion" WHERE "nombreConfiguracion" = 'aviso_vencimiento_locales_habilitado') AS result;`,
        }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
