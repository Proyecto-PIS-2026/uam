import Link from "next/link";

type Props = {
  nombre: string;
  variedad: string;
  categoria: string;
  operadores: number;
  imagen: string;
};

export default function ProductoCard({ nombre, variedad, categoria, operadores, imagen }: Props) {
  return (
    <Link href="/productos/placeholder" className="block">
      <div className="bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-3 sm:p-0">
        <div className="flex sm:block items-start gap-3 sm:gap-0">
          <div className="relative flex-shrink-0 w-24 h-24 sm:w-full sm:aspect-square sm:h-auto rounded-xl sm:rounded-none overflow-hidden">
            <img src={imagen} alt={nombre} className="w-full h-full object-cover" />
            <button className="hidden sm:flex absolute top-3 right-3 h-9 w-9 rounded-lg bg-white items-center justify-center shadow-sm text-[var(--green)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
              </svg>
            </button>
          </div>

          <div className="flex-1 min-w-0 flex sm:hidden items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-bold text-base text-gray-900 truncate">{nombre}</p>
              <p className="text-sm font-semibold text-[var(--green)] mt-0.5 truncate">
                {variedad} · {categoria}
              </p>
            </div>
            <button className="flex-shrink-0 h-8 w-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center shadow-sm text-[var(--green)]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"></path>
              </svg>
            </button>
          </div>

          <div className="hidden sm:block sm:p-5">
            <p className="font-bold text-xl text-gray-900 truncate">{nombre}</p>
            <p className="text-base font-semibold text-[var(--green)] mt-1">
              {variedad} · <span className="whitespace-nowrap">{categoria}</span>
            </p>
          </div>
        </div>

        <div className={`flex items-center mt-2 sm:mt-0 pt-2 sm:pt-4 sm:mx-5 sm:mb-5 border-t-2 border-gray-200`}>
          <p className="text-xs font-bold text-[var(--lightgreen)] tracking-wide">{operadores} {operadores === 1 ? "OPERADOR" : "OPERADORES"}</p>
        </div>
      </div>
    </Link>
  );
}