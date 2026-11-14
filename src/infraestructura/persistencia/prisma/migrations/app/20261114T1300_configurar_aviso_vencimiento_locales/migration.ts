#!/usr/bin/env -S node
import type { Contract } from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract';
import contract from '../../snapshots/847c7d232dcc4e51e10e6ed6a355e1a5e8989fbb7b57052b4599ebe54cfd35c5/contract.json' with { type: 'json' };
import { Migration, MigrationCLI, rawSql } from '@prisma/orm-postgres/migration';

// npm run db:migrate exige este invariant junto con el contrato emitido actual.
export default class M extends Migration<Contract, Contract> {
  override readonly startContractJson = contract;
  override readonly endContractJson = contract;

  override get operations() {
    return [
      rawSql({
        id: 'data_migration.anticipacion_aviso_vencimiento_locales',
        label: 'Configurar la anticipación de avisos de vencimiento de locales',
        operationClass: 'data',
        invariantId: 'uam:anticipacion-aviso-vencimiento-locales',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Conservar los tres días de anticipación actuales sin sobrescribir una configuración existente',
          sql: `INSERT INTO "public"."configuracion" ("nombreConfiguracion", "valorConfiguracion") VALUES ('anticipacion_aviso_vencimiento_locales', '3') ON CONFLICT ("nombreConfiguracion") DO NOTHING;`,
        }],
        postcheck: [{
          description: 'Verificar que existe la anticipación configurable de los avisos de locales',
          sql: `SELECT EXISTS (SELECT 1 FROM "public"."configuracion" WHERE "nombreConfiguracion" = 'anticipacion_aviso_vencimiento_locales') AS result;`,
        }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
