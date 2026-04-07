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

8. Importar `PrismaService` en `ProductsModule` como provider:

   ```ts
   // src/products/products.module.ts
   import { PrismaService } from 'src/prisma.service';

   @Module({
     providers: [ProductsService, PrismaService],
   })
   export class ProductsModule {}
   ```

### Paso 6 - Conectar el servicio de productos con Prisma

1. Inyectar `PrismaService` en `ProductsService` y crear el método `create`:

   ```ts
   // src/products/products.service.ts
   @Injectable()
   export class ProductsService {
     constructor(private prisma: PrismaService) {}

     async create(createProductDto: CreateProductDto) {
       const product = await this.prisma.product.create({
         data: createProductDto,
       });
       return product;
     }
   }
   ```

   Esto usa Prisma para insertar un nuevo producto en la base de datos SQLite a partir del DTO validado.

2. Probar con Postman que el endpoint `POST /products` crea productos correctamente.

### Paso 7 - Paginación de productos

La paginación nos permite traer la información dividida en páginas con un límite de resultados por página, en lugar de devolver todos los registros de golpe. Esto es importante para el rendimiento y la experiencia del usuario.

#### 7.1 - Crear la carpeta `common` y el DTO de paginación

Creamos una carpeta `src/common/dto/` para colocar DTOs reutilizables en todo el proyecto (no solo en productos). Dentro creamos `pagination.dto.ts`:

```ts
// src/common/dto/pagination.dto.ts
import { IsOptional, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class PaginationDto {
  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @IsPositive()
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}
```

- `@IsPositive()` asegura que solo se acepten números mayores a 0.
- `@IsOptional()` permite omitir el parámetro (usa el valor por defecto).
- `@Type(() => Number)` convierte el query string (que llega como `string`) a `number`.

#### 7.2 - Crear un barrel export en `common`

Para poder importar fácilmente desde `src/common`, creamos un archivo `src/common/index.ts`:

```ts
// src/common/index.ts
export { PaginationDto } from './dto/pagination.dto';
```

#### 7.3 - Recibir la paginación en el Controller

En el controlador usamos `@Query()` para leer los parámetros de la URL (`?page=1&limit=5`):

```ts
// src/products/products.controller.ts
import { PaginationDto } from 'src/common';

@Get()
findAll(@Query() paginationDto: PaginationDto) {
  return this.productsService.findAll(paginationDto);
}
```

`@Query()` extrae los query params y los valida automáticamente gracias al `ValidationPipe` global que configuramos en el paso 3.

#### 7.4 - Paginar con Prisma en el Service

En el servicio usamos `skip` y `take` de Prisma para paginar:

```ts
// src/products/products.service.ts
async findAll(paginationDto: PaginationDto) {
  const page = paginationDto.page ?? 1;
  const limit = paginationDto.limit ?? 10;

  const totalProducts = await this.prisma.product.count();
  const lastPage = Math.ceil(totalProducts / limit);

  return {
    data: await this.prisma.product.findMany({
      skip: (page - 1) * limit,
      take: limit,
    }),
    meta: {
      total: totalProducts,
      page,
      lastPage,
    },
  };
}
```

- `skip: (page - 1) * limit` — calcula cuántos registros saltar. Por ejemplo, si estamos en la página 2 con límite 10, saltamos los primeros 10.
- `take: limit` — cuántos registros traer.
- `meta` — devolvemos información útil: el total de productos, la página actual y la última página disponible.

#### 7.5 - Probar la paginación

Hacer un `GET` en Postman:

```bash
GET http://localhost:3000/products?page=1&limit=5
```

Respuesta esperada:

```json
{
  "data": [ ... ],
  "meta": {
    "total": 12,
    "page": 1,
    "lastPage": 3
  }
}
```

Si no se envían parámetros, usa `page=1` y `limit=10` por defecto.

## Obtener producto por ID

Este endpoint permite obtener un producto específico mediante su id.

 Manejo de errores

Cuando el cliente solicita un id que no existe en la base de datos, el sistema responde con una excepción 404 Not Found.
Esto evita devolver valores nulos y proporciona una respuesta clara y profesional.

- Implementación
- Servicio

async findOne(id: number) {
  const product = await this.prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new NotFoundException(`Product with id ${id} not found`);
  }

  return product;
}

## Controlador

- @Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.productsService.findOne(id);
}
