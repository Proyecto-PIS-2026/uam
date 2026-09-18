import type { PerfilPublicoOperador } from "../consultas-perfil-publico";

type PerfilOperadorProps = {
  operador: PerfilPublicoOperador;
}

export default function PerfilOperador({ operador }: PerfilOperadorProps) {

  const contenido = (
        <section className="mx-auto w-full max-w-3xl p-4 text-black"> 
            <div className="flex items-center gap-4">
                <div aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-3xl">
                    Img
                </div>
                <h1 className="text-2xl font-bold">
                    {operador.nombreFantasia}
                </h1>
            </div>
            <div className="mt-5 rounded-xl border p-4">
                <a href="" target="_blank" rel="noopener noreferrer" className="inline-block rounded-lg bg-green-600 px-4 py-2 text-white">
                    WhatsApp
                </a>

                <h2 className="mt-5 text-lg font-semibold">Locales</h2>

                <ul className="mt-2">
                    {operador.locales.map((local) => (
                        <li key={`${local.nombreNave}-${local.numeroLocal}`} className="ml-5">
                            {local.nombreNave} - Local {local.numeroLocal}
                        </li>
                    ))}
                </ul>
            </div>
        </section>
  );

  return contenido;
}