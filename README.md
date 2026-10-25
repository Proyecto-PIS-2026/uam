This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Almacenamiento de imágenes

Las imágenes cargadas se guardan como binarios `bytea` en la tabla `public.imagen` de PostgreSQL. Todas las réplicas de la aplicación deben usar la misma base. Los campos `foto`, `fotoPerfil` y `fotoEspecie` conservan sus URLs; las rutas `/api/.../imagenes/...` comprueban los permisos antes de leer el contenido. Sharp sigue optimizando las nuevas fotos a WebP y el navegador mantiene la carga diferida.

La aplicación no usa `storage/` para guardar ni servir imágenes. Los logos, iconos y fotos genéricas versionados en `public/` siguen siendo recursos estáticos distribuidos con la aplicación.

### Actualizar una instalación existente

1. Respaldar la base y los directorios `storage/` existentes. Durante la importación, suspender las altas, reemplazos y eliminaciones de fotos en la versión anterior.
2. Configurar `DATABASE_URL` para la base de esa instalación y aplicar las migraciones, sin ejecutar el seed:

   ```bash
   npm run db:migrate
   ```

3. Desde el código actualizado, importar cada directorio que contenga fotos de la instalación anterior:

   ```bash
   npm run db:imagenes:migrar -- --directorio /ruta/al/storage
   npm run db:imagenes:migrar -- --directorio /ruta/al/storage --verificar
   ```

   Sin `--directorio`, se usa `./storage`. La herramienta cubre publicaciones, operadores, productores y especies, conserva las claves y los bytes originales, y nunca borra los archivos de origen. Repetirla es seguro: compara las imágenes que ya existen y no sobrescribe contenido diferente. El reporte identifica conflictos, referencias inválidas y fotos referenciadas que faltan. `--verificar` no escribe y también señala los archivos pendientes de importar. Un reporte incompleto termina con código 1; si las fotos estaban repartidas entre réplicas, importar todos sus directorios y repetir la verificación al terminar.

4. Iniciar la versión actualizada en todas las réplicas contra esa misma base, una vez que la verificación no reporte problemas. Las instalaciones nuevas, sin fotos cargadas, solo necesitan la migración de esquema.

La importación requiere acceso a los archivos originales; una URL guardada en la base no permite recuperar un archivo perdido. Los respaldos de PostgreSQL pasan a incluir las imágenes, por lo que se debe contemplar su tamaño al dimensionar almacenamiento y restauraciones.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
