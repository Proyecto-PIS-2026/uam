import { leerOperadoresCsv, type OperadorCsv } from "./operadores-csv";

export type EscenarioEntrega = "aging" | "vigencia" | "locales";
export type LocalEntrega = { nave: string; numero: string; finContrato: string | null };

type IdentidadEntrega = { username: string; identificadorIngreso: string };
export type CuentaAdministradorEntrega = IdentidadEntrega & {
  rol: "ADMINISTRADOR";
  email: string;
};
export type CuentaOperadorEntrega = IdentidadEntrega & {
  rol: "OPERADOR";
  nombreFantasia: string;
  whatsapp: string;
  locales: LocalEntrega[];
  escenario?: EscenarioEntrega;
};
export type CuentaProductorEntrega = IdentidadEntrega & {
  rol: "PRODUCTOR";
  nombreFantasia: string;
  whatsapp: string;
  escenario?: Exclude<EscenarioEntrega, "locales">;
};
export type CuentaEntrega = CuentaAdministradorEntrega | CuentaOperadorEntrega | CuentaProductorEntrega;

const NAVE_PRUEBAS = "C - Polivalente";
const normalizarClave = (valor: string) => valor.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

function crearAdministradores(): CuentaAdministradorEntrega[] {
  return ["admin", "adminABorrar"].flatMap((prefijo) =>
    Array.from({ length: 5 }, (_, indice): CuentaAdministradorEntrega => {
      const username = `${prefijo}${indice + 1}`;
      const email = `${username}@uam.com.uy`;
      return { rol: "ADMINISTRADOR", username, identificadorIngreso: email, email };
    }),
  );
}

function crearCuentasPrueba(): (CuentaOperadorEntrega | CuentaProductorEntrega)[] {
  return [
    {
      rol: "OPERADOR", username: "operador_fotos", identificadorIngreso: "operador_fotos",
      nombreFantasia: "Operador fotos", whatsapp: "", escenario: "aging",
      locales: [{ nave: NAVE_PRUEBAS, numero: "99001", finContrato: null }],
    },
    {
      rol: "OPERADOR", username: "operador_publicacion", identificadorIngreso: "operador_publicacion",
      nombreFantasia: "Operador publicación", whatsapp: "", escenario: "vigencia",
      locales: [{ nave: NAVE_PRUEBAS, numero: "99002", finContrato: null }],
    },
    {
      rol: "OPERADOR", username: "operador_locales", identificadorIngreso: "operador_locales",
      nombreFantasia: "Operador locales", whatsapp: "", escenario: "locales",
      locales: ["A", "B", NAVE_PRUEBAS].map((nave, indice) => {
        const dia = 16 + indice;
        // Fin del día de noviembre en Uruguay (UTC-3), inclusive.
        const finContrato = new Date(Date.UTC(2026, 10, dia + 1, 3) - 1).toISOString();
        return { nave, numero: String(99100 + dia), finContrato };
      }),
    },
    {
      rol: "PRODUCTOR", username: "productor_fotos", identificadorIngreso: "productor_fotos",
      nombreFantasia: "Productor fotos", whatsapp: "", escenario: "aging",
    },
    {
      rol: "PRODUCTOR", username: "productor_publicacion", identificadorIngreso: "productor_publicacion",
      nombreFantasia: "Productor publicación", whatsapp: "", escenario: "vigencia",
    },
  ];
}

function validarCuentas(cuentas: readonly CuentaEntrega[]): void {
  const usernames = new Set<string>();
  const identificadores = new Set<string>();
  const nombresFantasia = new Set<string>();
  const locales = new Set<string>();

  for (const cuenta of cuentas) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(cuenta.username)) {
      throw new Error("Nombre de usuario inválido en las cuentas de entrega.");
    }
    const username = normalizarClave(cuenta.username);
    if (usernames.has(username)) throw new Error(`Username duplicado en la entrega: ${cuenta.username}`);
    usernames.add(username);
    const identificador = normalizarClave(cuenta.identificadorIngreso);
    if (!identificador || identificadores.has(identificador)) {
      throw new Error(`Identificador de ingreso duplicado o vacío: ${cuenta.identificadorIngreso}`);
    }
    identificadores.add(identificador);

    if (cuenta.rol === "ADMINISTRADOR") continue;
    const nombre = normalizarClave(cuenta.nombreFantasia);
    if (!nombre || nombresFantasia.has(nombre)) {
      throw new Error(`Nombre de fantasía duplicado o vacío: ${cuenta.nombreFantasia}`);
    }
    nombresFantasia.add(nombre);
    if (cuenta.rol !== "OPERADOR") continue;
    for (const local of cuenta.locales) {
      if (!normalizarClave(local.nave) || !/^\d+$/.test(local.numero)) {
        throw new Error(`Local inválido en la entrega para ${cuenta.username}.`);
      }
      const clave = `${normalizarClave(local.nave)}|${local.numero.replace(/^0+(?=\d)/, "")}`;
      if (locales.has(clave)) throw new Error(`Local duplicado en la entrega: ${local.nave} ${local.numero}`);
      locales.add(clave);
    }
  }
}

/** Construye y valida la lista completa antes de acceder a la base. */
export function crearCuentasEntrega(operadores: readonly OperadorCsv[] = leerOperadoresCsv()): CuentaEntrega[] {
  const cuentas: CuentaEntrega[] = [
    ...crearAdministradores(),
    ...crearCuentasPrueba(),
    ...operadores.map((operador): CuentaOperadorEntrega => ({
      rol: "OPERADOR",
      username: operador.username,
      identificadorIngreso: operador.username,
      nombreFantasia: operador.nombreFantasia,
      whatsapp: "",
      locales: operador.locales.map((local) => ({ ...local, finContrato: null })),
    })),
  ];
  validarCuentas(cuentas);
  return cuentas;
}

/** Identificadores de los operadores que no pueden ingresar por no tener locales. */
export function obtenerUsuariosSinLocal(cuentas: readonly CuentaEntrega[]): string[] {
  return cuentas.filter((cuenta) => cuenta.rol === "OPERADOR" && cuenta.locales.length === 0)
    .map((cuenta) => cuenta.identificadorIngreso);
}
