import assert from "node:assert/strict";

export function extraerObjetosRsc(html) {
  const patronFragmento = /self\.__next_f\.push\(\s*(\[\s*1\s*,\s*"(?:\\.|[^"\\])*"\s*\])\s*\)/g;
  const fragmentos = [...html.matchAll(patronFragmento)].map(coincidencia => JSON.parse(coincidencia[1])[1]);
  assert.ok(fragmentos.length > 0, "La página no contiene datos RSC reconocibles");
  const filas = new Map();
  for (const linea of fragmentos.join("").split("\n")) {
    const fila = /^([0-9a-f]+):(.*)$/i.exec(linea);
    if (!fila || !/^[\[{"\d-]|^(?:true|false|null)$/.test(fila[2])) continue;
    try {
      filas.set(fila[1], JSON.parse(fila[2]));
    } catch {
      // Los registros de módulos y texto del protocolo no son modelos JSON.
    }
  }

  const objetos = [];
  const resueltos = new WeakMap();
  function resolver(entrada) {
    let valor = entrada;
    const referencias = new Set();
    while (typeof valor === "string" && /^\$[0-9a-f]+$/i.test(valor)) {
      const id = valor.slice(1);
      assert.ok(!referencias.has(id), "Referencia circular en los datos RSC");
      referencias.add(id);
      if (!filas.has(id)) return undefined;
      valor = filas.get(id);
    }
    if (valor === "$undefined") return undefined;
    if (typeof valor === "string" && valor.startsWith("$$")) return valor.slice(1);
    if (!valor || typeof valor !== "object") return valor;
    if (resueltos.has(valor)) return resueltos.get(valor);
    const resultado = Array.isArray(valor) ? [] : {};
    resueltos.set(valor, resultado);
    if (!Array.isArray(valor)) objetos.push(resultado);
    for (const [clave, hijo] of Object.entries(valor)) resultado[clave] = resolver(hijo);
    return resultado;
  }
  for (const fila of filas.values()) resolver(fila);
  return objetos;
}
