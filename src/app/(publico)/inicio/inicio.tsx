export default function Inicio() {
  return (
    <main className="min-h-screen bg-green-50 text-gray-800">
      {/* Navbar */}
      <header className="bg-green-800 text-white shadow-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">UAM</h1>
            <p className="text-sm text-green-200">
              Unidad Agroalimentaria Metropolitana
            </p>
          </div>

          <nav className="hidden gap-6 md:flex">
            <a href="#inicio" className="hover:text-green-200">
              inicio
            </a>
            <a href="#areas" className="hover:text-green-200">
              Áreas
            </a>
            <a href="#nosotros" className="hover:text-green-200">
              Nosotros
            </a>
            <a href="#contacto" className="hover:text-green-200">
              Contacto
            </a>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section
        id="inicio"
        className="bg-gradient-to-br from-green-800 to-green-600 text-white"
      >
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="max-w-2xl">
            <p className="mb-3 font-semibold uppercase tracking-wider text-green-200">
              Unidad Agroalimentaria Metropolitana
            </p>

            <h2 className="text-4xl font-bold leading-tight md:text-6xl">
              El corazón del abastecimiento agroalimentario
            </h2>

            <p className="mt-6 text-lg leading-8 text-green-50">
              Un espacio que conecta productores, comerciantes y consumidores,
              facilitando la comercialización y distribución de alimentos en
              Uruguay.
            </p>

            <button className="mt-8 rounded-lg bg-white px-6 py-3 font-semibold text-green-800 shadow transition hover:bg-green-100">
              Conocé la UAM
            </button>
          </div>
        </div>
      </section>

      {/* Áreas */}
      <section id="areas" className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-12 text-center">
          <p className="font-semibold uppercase tracking-wider text-green-700">
            Nuestra actividad
          </p>

          <h2 className="mt-2 text-3xl font-bold text-green-900">
            Áreas de la UAM
          </h2>

          <p className="mx-auto mt-4 max-w-2xl text-gray-600">
            La UAM cuenta con diferentes espacios destinados a la
            comercialización, logística y desarrollo de actividades
            agroalimentarias.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-green-100 transition hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 text-4xl">🥬</div>
            <h3 className="text-xl font-bold text-green-800">
              Frutas y Hortalizas
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Espacio destinado a la comercialización mayorista de frutas,
              verduras y otros productos hortifrutícolas.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-green-100 transition hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 text-4xl">🛒</div>
            <h3 className="text-xl font-bold text-green-800">
              Mercado Polivalente
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Un espacio para diferentes rubros alimentarios y actividades
              comerciales.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-green-100 transition hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 text-4xl">🚚</div>
            <h3 className="text-xl font-bold text-green-800">
              Actividades Logísticas
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Infraestructura y servicios destinados a facilitar la logística
              y distribución de alimentos.
            </p>
          </div>

          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-green-100 transition hover:-translate-y-1 hover:shadow-md">
            <div className="mb-4 text-4xl">🌱</div>
            <h3 className="text-xl font-bold text-green-800">
              Actividades Complementarias
            </h3>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Servicios y actividades que complementan el funcionamiento del
              sistema agroalimentario.
            </p>
          </div>
        </div>
      </section>

      {/* Nosotros */}
      <section id="nosotros" className="bg-white">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <p className="font-semibold uppercase tracking-wider text-green-700">
                Sobre nosotros
              </p>

              <h2 className="mt-2 text-3xl font-bold text-green-900">
                Una plataforma para el desarrollo agroalimentario
              </h2>

              <p className="mt-6 leading-7 text-gray-600">
                La Unidad Agroalimentaria Metropolitana facilita y desarrolla
                el comercio y la distribución de alimentos, articulando a los
                distintos actores de la cadena agroalimentaria.
              </p>

              <p className="mt-4 leading-7 text-gray-600">
                Su propuesta busca contribuir a un sistema de abastecimiento
                eficiente, transparente y orientado a la calidad y seguridad
                de los alimentos.
              </p>
            </div>

            <div className="rounded-2xl bg-green-800 p-8 text-white shadow-lg">
              <div className="text-5xl">🌿</div>

              <h3 className="mt-6 text-2xl font-bold">
                Producción, comercio y logística
              </h3>

              <p className="mt-4 leading-7 text-green-100">
                Conectamos los diferentes actores de la cadena para favorecer
                el abastecimiento de alimentos en Uruguay.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contacto" className="bg-green-900 text-white">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="text-2xl font-bold">
                Unidad Agroalimentaria Metropolitana
              </h2>

              <p className="mt-2 text-green-200">
                Cno. Luis Eduardo Pérez 6651 · Montevideo, Uruguay
              </p>
            </div>

            <div className="text-sm text-green-200">
              <p>+598 2 311 45 92</p>
              <p>info@uam.com.uy</p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-green-950 px-6 py-5 text-center text-sm text-green-300">
        © {new Date().getFullYear()} UAM · Unidad Agroalimentaria Metropolitana
      </footer>
    </main>
  );
}