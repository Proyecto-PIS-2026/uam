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
        id: 'data_migration.nave_c_polivalente',
        label: 'Agregar la nave C - Polivalente',
        operationClass: 'data',
        invariantId: 'uam:nave-c-polivalente',
        target: { id: 'postgres' },
        precheck: [],
        execute: [{
          description: 'Agregar la nave sin modificar las existentes ni duplicarla',
          sql: `INSERT INTO "public"."nave" ("nombreNave") VALUES ('C - Polivalente') ON CONFLICT ("nombreNave") DO NOTHING;`,
        }],
        postcheck: [{
          description: 'Verificar que existe la nave C - Polivalente',
          sql: `SELECT EXISTS (SELECT 1 FROM "public"."nave" WHERE "nombreNave" = 'C - Polivalente') AS result;`,
        }],
      }),
    ];
  }
}

MigrationCLI.run(import.meta.url, M);
