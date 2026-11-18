import argon2 from "argon2";
import { randomBytes } from "node:crypto";
import type { CuentaEntrega } from "./cuentas";

// Solo estas diez cuentas conservan una contraseña inicial conocida.
const HASHES_CUENTAS_PRUEBA: Readonly<Record<string, string>> = Object.freeze({
  "adminABorrar1": "$argon2id$v=19$m=65536,p=4,t=3$ErY4C//yzW8gvxtxfvbVdw$QK7RMiNvsHg6gfUKrrsrLuiODYFT31fJrY9Za8Cr8l0",
  "adminABorrar2": "$argon2id$v=19$m=65536,p=4,t=3$/9QVmu1so0NjCg6yNDG6Ag$2Fq5nvmczxweRWwj7grlCgur9b7gy7RV1nuXN6CmwyQ",
  "adminABorrar3": "$argon2id$v=19$m=65536,p=4,t=3$k/vly6J1LN52P5VgNLYg5Q$HcM53Rztm1uo1nyPd5famRblRLKNSuM7S9hl2cLBY8w",
  "adminABorrar4": "$argon2id$v=19$m=65536,p=4,t=3$ij+ebe9/yLvsPiKQmXXltg$CumIMzoCqB1BHJcN7GmrPX+peA1UFHjc2KPHbC43w50",
  "adminABorrar5": "$argon2id$v=19$m=65536,p=4,t=3$E7WJbtF5NXQL9yYUTAf9ew$bsEyt4HhCMHbJO1gAdhLuJFmtQYjYfZsxfxkbovmIec",
  "operador_fotos": "$argon2id$v=19$m=65536,p=4,t=3$VGg6675WOwlpiIm9ZNaaqw$BOfDi2t8UrxSYAvbTY92ZoeN1PtybLRcX90Qw/9RmLQ",
  "operador_publicacion": "$argon2id$v=19$m=65536,p=4,t=3$giG16RPGYn5GHNtg0LtCyg$v43j1Z6E+BlSJunf/d+icA+RF2dTAQRkH+NhFoEJv9k",
  "operador_locales": "$argon2id$v=19$m=65536,p=4,t=3$89JnZUZw3RSYIFYqgz0WzQ$TA0lRI+kbLrjdC/qYGnQC4K8YyDlszBNTyhG98w6zs4",
  "productor_fotos": "$argon2id$v=19$m=65536,p=4,t=3$YbjUhuymToyNpwKIPkJgsw$D2ZlJIsHUp/He8ArMXO6gLHSo0FLh8pL2j25dXeunLk",
  "productor_publicacion": "$argon2id$v=19$m=65536,p=4,t=3$LJCqYKFHKu4qhncri02+2Q$4kjVta6mwrMtorH3i7ZzJsIb1jKJll8m3c079hElEhk"
});

type IdentidadCuenta = Pick<CuentaEntrega, "username" | "identificadorIngreso">;

export async function crearHashesIniciales(cuentas: readonly IdentidadCuenta[]): Promise<Map<string, string>> {
  if (cuentas.length === 0) throw new Error("No se indicaron usuarios de entrega.");
  const usuarios = new Set<string>();
  const identificadores = new Set<string>();
  for (const cuenta of cuentas) {
    if (!cuenta.username || !cuenta.identificadorIngreso) throw new Error("Falta la identidad de una cuenta de entrega.");
    if (usuarios.has(cuenta.username) || identificadores.has(cuenta.identificadorIngreso)) {
      throw new Error("La lista de cuentas de entrega contiene duplicados.");
    }
    usuarios.add(cuenta.username);
    identificadores.add(cuenta.identificadorIngreso);
  }

  const resultado = new Map<string, string>();
  // Secuencial para limitar la memoria de Argon2. Las claves aleatorias se descartan tras obtener su hash.
  for (const cuenta of cuentas) {
    const hash = Object.hasOwn(HASHES_CUENTAS_PRUEBA, cuenta.username)
      ? HASHES_CUENTAS_PRUEBA[cuenta.username]
      : await argon2.hash(randomBytes(32).toString("base64url"), { type: argon2.argon2id });
    resultado.set(cuenta.identificadorIngreso, hash);
  }
  return resultado;
}
