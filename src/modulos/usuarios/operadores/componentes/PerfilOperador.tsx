import type { PerfilPublicoOperador } from "../consultas-perfil-publico";

type PerfilOperadorProps = {
  operador: PerfilPublicoOperador;
}

export default function PerfilOperador({ operador }: PerfilOperadorProps) {
  const numeroWhatsApp = operador.whatsApp.replace(/\D/g, "");

  const contenido = (
        <section className="mx-auto w-full max-w-3xl p-4 text-black"> 
            <div className="flex items-center gap-4">
                <div aria-hidden="true" className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-3xl">
                    Img
                </div>
                <h1 className="text-2xl font-bold">
                    {operador.nombreFantasia}
                </h1>

                <a  aria-label="Contactar por WhatsApp"
                    href={"https://wa.me/" + numeroWhatsApp}
                    target="_blank" rel="noopener noreferrer" 
                    className="group inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full  bg-white"
                >
                    <img
                        src="/whatsapp.png"
                        alt=""
                        className="block h-7 w-7 object-contain group-hover:hidden"
                    />
                    <img
                        src="/whatsapp-hover.png"
                        alt=""
                        className="hidden h-9 w-9 object-contain group-hover:block"
                    />
                </a>
            </div>
            <div className="mt-5 rounded-xl border p-4">
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