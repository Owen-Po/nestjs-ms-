# Products Microservice

Microservicio de productos construido con [NestJS](https://nestjs.com/), Prisma y SQLite.

## Tecnologías

- **NestJS** v11
- **Prisma** con SQLite
- **class-validator / class-transformer** para validación de DTOs
- **dotenv + Joi** para variables de entorno

---

## Instalación

```bash
npm install
```

## Ejecución

```bash
# desarrollo (watch mode)
npm run start:dev

# producción
npm run start:prod
```

---

## Pasos de construcción del proyecto

### Paso 1 - Crear el proyecto

```bash
nest new products-ms
```

### Paso 2 - Generar el recurso de productos

```bash
nest g res products --no-spec
```

Esto genera automáticamente el módulo, controlador, servicio, DTOs y entities de productos.

### Paso 3 - Configurar DTOs y validaciones

Instalar las dependencias de validación:

```bash
npm install class-validator class-transformer
```

Activar la validación global en `main.ts`:

```ts
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
);
```

### Paso 4 - Variables de entorno

1. Instalar dependencias:

   ```bash
   npm i dotenv joi
   ```

2. Crear la carpeta `src/config` y el archivo `envs.ts`.
3. Crear el archivo `.env` en la raíz del proyecto con el puerto y demás variables. Crear también un `.env.example`.
4. Configurar `envs.ts` con Joi para validar las variables y actualizar `main.ts` para usar el puerto desde `envs.ts`.

### Paso 5 - Prisma con SQLite

1. Instalar Prisma como dependencia de desarrollo:

   ```bash
   npm install prisma --save-dev
   ```

2. Inicializar Prisma:

   ```bash
   npx prisma init
   ```

3. Modificar `prisma/schema.prisma` con el generador y el modelo de producto:

   ```prisma
   generator client {
     provider     = "prisma-client"
     output       = "../generated/prisma"
     moduleFormat = "cjs"
   }

   datasource db {
     provider = "sqlite"
   }

   model product {
     id        Int      @id @default(autoincrement())
     name      String   @unique
     price     Float
     createdAt DateTime @default(now())
     updateAt  DateTime @updatedAt
   }
   ```

4. Configurar el `.env` con la URL de la base de datos de Prisma.

5. Ejecutar la migración, instalar el cliente y generar los tipos:

   ```bash
   npx prisma migrate dev --name init
   npm install @prisma/client
   npx prisma generate
   ```

6. Instalar el adaptador de SQLite:

   ```bash
   npm install @prisma/adapter-better-sqlite3
   ```

7. Crear el `PrismaService` en `src/prisma.service.ts` siguiendo la documentación de NestJS + Prisma.


8. despues de crear el prisma service, vamos a importarlo en products modul 
9. hacemos las inyectiones en proucts service