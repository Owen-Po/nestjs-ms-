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

### Paso 8 - Obtener producto por ID

Este endpoint permite obtener un producto específico mediante su `id`. Si el producto no existe, respondemos con un error `404 Not Found` en lugar de devolver `null`.

#### 8.1 - Servicio

En el servicio usamos `findUnique` de Prisma para buscar por `id`. Si no se encuentra, lanzamos una excepción de NestJS:

```ts
// src/products/products.service.ts
async findOne(id: number) {
  const product = await this.prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new NotFoundException(`Product with id ${id} not found`);
  }

  return product;
}
```

- `findUnique` busca un único registro por un campo único (en este caso `id`).
- `NotFoundException` es una excepción integrada de NestJS que automáticamente responde con status `404` y un mensaje descriptivo.

#### 8.2 - Controlador

En el controlador usamos `@Param('id')` para extraer el parámetro de la URL y `ParseIntPipe` para convertirlo a número:

```ts
// src/products/products.controller.ts
@Get(':id')
findOne(@Param('id', ParseIntPipe) id: number) {
  return this.productsService.findOne(id);
}
```

- `ParseIntPipe` convierte el string `"1"` de la URL a número `1`. Si el valor no es un número válido, NestJS responde automáticamente con un error `400 Bad Request`.

#### 8.3 - Probar

```bash
GET http://localhost:3000/products/1
```

Si el producto existe devuelve el objeto, si no:

```json
{
  "statusCode": 404,
  "message": "Product with id 99 not found"
}
```

---

### Paso 9 - Actualizar producto por ID

Este endpoint permite actualizar parcialmente un producto existente usando su `id`.

#### 9.1 - DTO de actualización

NestJS genera automáticamente `UpdateProductDto` extendiendo de `CreateProductDto` con `PartialType`, lo que hace que todos los campos sean opcionales:

```ts
// src/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

- `PartialType` toma el DTO original y convierte todos los campos a opcionales. Así puedes enviar solo los campos que deseas actualizar.

#### 9.2 - Servicio

En el servicio primero verificamos que el producto exista (reutilizando `findOne`) y luego lo actualizamos:

```ts
// src/products/products.service.ts
async update(id: number, updateProductDto: UpdateProductDto) {
  await this.findOne(id);

  return this.prisma.product.update({
    where: { id },
    data: updateProductDto,
  });
}
```

- Llamamos a `this.findOne(id)` antes de actualizar. Si el producto no existe, `findOne` ya lanza el error `404` automáticamente, así no duplicamos lógica.
- `prisma.product.update` actualiza solo los campos que vienen en el DTO.

#### 9.3 - Controlador

Usamos el decorador `@Patch(':id')` para recibir actualizaciones parciales:

```ts
// src/products/products.controller.ts
@Patch(':id')
update(
  @Param('id', ParseIntPipe) id: number,
  @Body() updateProductDto: UpdateProductDto,
) {
  return this.productsService.update(id, updateProductDto);
}
```

- Usamos `PATCH` en lugar de `PUT` porque estamos haciendo una actualización parcial (no reemplazamos todo el recurso).

#### 9.4 - Probar

```bash
PATCH http://localhost:3000/products/1
Content-Type: application/json

{
  "price": 29.99
}
```

Esto actualiza solo el precio del producto con `id: 1`, dejando el resto de campos intactos.

---

### Paso 10 - Eliminar producto por ID

Inicialmente podemos implementar una eliminación física (borrar el registro de la base de datos):

#### 10.1 - Servicio (eliminación física)

```ts
// src/products/products.service.ts
async remove(id: number) {
  await this.findOne(id);

  return this.prisma.product.delete({
    where: { id },
  });
}
```

#### 10.2 - Controlador

```ts
// src/products/products.controller.ts
@Delete(':id')
remove(@Param('id', ParseIntPipe) id: number) {
  return this.productsService.remove(id);
}
```

#### 10.3 - Probar

```bash
DELETE http://localhost:3000/products/1
```

Esto elimina permanentemente el producto. Pero en la práctica esto no es ideal, ya que perdemos el historial. Por eso implementamos la **eliminación suave** en el siguiente paso.

---

### Paso 11 - Eliminación suave (Soft Delete) con `available`

En lugar de borrar registros de la base de datos, marcamos los productos como "no disponibles". Esto nos permite mantener el historial y recuperar productos si es necesario.

#### 11.1 - Agregar el campo `available` al schema de Prisma

Abrimos `prisma/schema.prisma` y agregamos el campo `available` al modelo:

```prisma
model product {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  price     Float

  available Boolean  @default(true)

  createdAt DateTime @default(now())
  updateAt  DateTime @updatedAt
}
```

- `@default(true)` — todos los productos nuevos se crean como disponibles por defecto.

#### 11.2 - Ejecutar la migración

```bash
npx prisma migrate dev --name available
```

Esto crea una migración que agrega la columna `available` a la tabla existente con valor por defecto `true`, sin perder datos.

#### 11.3 - Modificar `remove` para hacer soft delete

En lugar de usar `delete`, ahora usamos `update` para cambiar `available` a `false`:

```ts
// src/products/products.service.ts
async remove(id: number) {
  await this.findOne(id);

  const product = await this.prisma.product.update({
    where: { id },
    data: { available: false },
  });
  return product;
}
```

- El producto sigue existiendo en la base de datos, pero con `available: false`.

#### 11.4 - Filtrar productos eliminados en las consultas

Ahora debemos asegurarnos de que los productos "eliminados" no aparezcan en las consultas. Actualizamos `findOne` y `findAll`:

```ts
// src/products/products.service.ts

// En findOne agregamos available: true al where
async findOne(id: number) {
  const product = await this.prisma.product.findUnique({
    where: { id, available: true },
  });

  if (!product) {
    throw new NotFoundException(`Product with id ${id} not found`);
  }

  return product;
}

// En findAll filtramos solo productos disponibles
async findAll(paginationDto: PaginationDto) {
  const page = paginationDto.page ?? 1;
  const limit = paginationDto.limit ?? 10;

  const totalProducts = await this.prisma.product.count({
    where: { available: true },
  });
  const lastPage = Math.ceil(totalProducts / limit);

  return {
    data: await this.prisma.product.findMany({
      skip: (page - 1) * limit,
      take: limit,
      where: { available: true },
    }),
    meta: {
      total: totalProducts,
      page,
      lastPage,
    },
  };
}
```

- Agregamos `where: { available: true }` tanto en `count` como en `findMany` para que la paginación solo cuente y devuelva productos disponibles.
- En `findOne` agregamos `available: true` al `where`, así si un producto fue "eliminado", `findOne` lo trata como si no existiera y lanza `404`.

#### 11.5 - Probar

1. Crear un producto:

   ```bash
   POST http://localhost:3000/products
   { "name": "Laptop", "price": 999.99 }
   ```

2. "Eliminarlo":

   ```bash
   DELETE http://localhost:3000/products/1
   ```

   Respuesta: el producto con `available: false`.

3. Intentar obtenerlo:

   ```bash
   GET http://localhost:3000/products/1
   ```

   Respuesta: `404 Not Found` — el producto ya no es visible.

4. Listar productos:

   ```bash
   GET http://localhost:3000/products
   ```

   El producto eliminado no aparece en la lista.


### Paso 12 - Transformar a microservicio con TCP

Hasta ahora nuestra aplicación funciona como una API REST normal (HTTP). Ahora la vamos a convertir en un **microservicio** que se comunica por **TCP** en lugar de HTTP. Esto permite que otros microservicios se conecten a él directamente, sin pasar por HTTP.

#### 12.1 - Instalar la dependencia de microservicios

```bash
npm install @nestjs/microservices
```

#### 12.2 - Modificar `main.ts`

Reemplazamos `NestFactory.create()` por `NestFactory.createMicroservice()` y configuramos el transporte TCP:

```ts
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import { envs } from './config';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';

async function bootstrap() {
  const logger = new Logger('Main');
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(
    AppModule,
    {
      transport: Transport.TCP,
      options: {
        port: envs.port,
      },
    },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen();
  logger.log(`Products microservice running on port ${envs.port}`);
}
bootstrap();
```

**Cambios clave:**

- `NestFactory.createMicroservice` en lugar de `NestFactory.create` — esto crea un microservicio en vez de un servidor HTTP.
- `Transport.TCP` — usamos TCP como protocolo de comunicación. Es más ligero que HTTP y está diseñado para comunicación interna entre servicios.
- `AppModule` va como **primer argumento** y las opciones de transporte como **segundo argumento**.
- Importamos `Transport` desde `@nestjs/microservices` (es un enum con las opciones de transporte disponibles: TCP, Redis, NATS, etc.).
- `Logger` se importa desde `@nestjs/common` y se instancia manualmente para poder loguear mensajes con un contexto (`'Main'`).
- `app.listen()` sin puerto — en un microservicio, el puerto ya se configuró en las opciones de transporte.

#### 12.3 - Cambiar decoradores en el controlador

En un microservicio, los decoradores HTTP (`@Get`, `@Post`, `@Patch`, `@Delete`) ya **no funcionan**. Debemos reemplazarlos por decoradores de mensajes:

| HTTP (REST)         | Microservicio            |
|---------------------|--------------------------|
| `@Get()`            | `@MessagePattern()`      |
| `@Post()`           | `@MessagePattern()`      |
| `@Patch()`          | `@MessagePattern()`      |
| `@Delete()`         | `@MessagePattern()`      |
| `@Body()`           | `@Payload()`             |
| `@Param()`          | (viene dentro del payload)|
| `@Query()`          | (viene dentro del payload)|

Ejemplo de cómo queda el controlador:

```ts
// src/products/products.controller.ts
import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { PaginationDto } from 'src/common';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @MessagePattern({ cmd: 'create_product' })
  create(@Payload() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  @MessagePattern({ cmd: 'find_all_products' })
  findAll(@Payload() paginationDto: PaginationDto) {
    return this.productsService.findAll(paginationDto);
  }

  @MessagePattern({ cmd: 'find_one_product' })
  findOne(@Payload('id') id: number) {
    return this.productsService.findOne(id);
  }

  @MessagePattern({ cmd: 'update_product' })
  update(@Payload() updateProductDto: UpdateProductDto) {
    return this.productsService.update(updateProductDto.id, updateProductDto);
  }

  @MessagePattern({ cmd: 'delete_product' })
  remove(@Payload('id') id: number) {
    return this.productsService.remove(id);
  }
}
```

**Explicación:**

- `@MessagePattern({ cmd: 'create_product' })` — define el "comando" que este método escucha. Cuando otro servicio envíe un mensaje con `{ cmd: 'create_product' }`, este método lo procesará.
- `@Payload()` — reemplaza a `@Body()`. Extrae los datos del mensaje recibido.
- `@Payload('id')` — extrae un campo específico del payload, similar a como `@Param('id')` extraía del URL.
- Ya no usamos `ParseIntPipe` porque los datos llegan como objetos (no como strings de URL).
- En `update`, el `id` ahora viene dentro del DTO, por eso accedemos a `updateProductDto.id`.

#### 12.4 - Agregar `id` al `UpdateProductDto`

Como ya no recibimos el `id` desde la URL (`@Param`), necesitamos que venga dentro del body:

```ts
// src/products/dto/update-product.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateProductDto } from './create-product.dto';
import { IsPositive } from 'class-validator';

export class UpdateProductDto extends PartialType(CreateProductDto) {
  @IsPositive()
  id: number;
}
```

#### 12.5 - ¿Cómo se comunican los microservicios?

Ahora este servicio **no se puede llamar desde el navegador o Postman** directamente, porque ya no es HTTP. Para comunicarte con él necesitas un **API Gateway** u otro microservicio que actúe como cliente TCP:

```
Cliente (navegador/app)
    ↓  HTTP
API Gateway (NestJS con @nestjs/microservices ClientProxy)
    ↓  TCP
Products Microservice (este proyecto)
```

El Gateway envía mensajes así:

```ts
// Desde el API Gateway
this.client.send({ cmd: 'find_all_products' }, { page: 1, limit: 10 });
```

Y el microservicio de productos recibe ese mensaje en el método decorado con `@MessagePattern({ cmd: 'find_all_products' })`.

---

### Paso 13 - Payloads del microservicio (cómo usar cada comando)

Al ser un microservicio TCP, los datos se envían como payloads desde el API Gateway usando `client.send()`. Aquí están todos los comandos disponibles y sus payloads:

#### 13.1 - Crear producto

```ts
// Comando
client.send({ cmd: 'create_product' }, payload);
```

**Payload:**

| Campo  | Tipo     | Requerido | Validación                          |
|--------|----------|-----------|-------------------------------------|
| `name` | `string` | ✅ Sí     | Debe ser un string                  |
| `price`| `number` | ✅ Sí     | Mínimo 0, máximo 4 decimales        |

**Ejemplo:**

```json
{
  "name": "Laptop Gaming",
  "price": 1299.99
}
```

#### 13.2 - Listar productos (con paginación)

```ts
// Comando
client.send({ cmd: 'find_all_products' }, payload);
```

**Payload:**

| Campo   | Tipo     | Requerido | Default | Validación         |
|---------|----------|-----------|---------|--------------------|
| `page`  | `number` | ❌ No     | `1`     | Debe ser positivo  |
| `limit` | `number` | ❌ No     | `10`    | Debe ser positivo  |

**Ejemplo:**

```json
{
  "page": 2,
  "limit": 5
}
```

**Respuesta:**

```json
{
  "data": [{ "id": 6, "name": "Mouse", "price": 25.00, "available": true, ... }],
  "meta": { "total": 12, "page": 2, "lastPage": 3 }
}
```

#### 13.3 - Obtener producto por ID

```ts
// Comando
client.send({ cmd: 'find_one_products' }, { id: 1 });
```

**Payload:**

| Campo | Tipo     | Requerido | Validación              |
|-------|----------|-----------|-------------------------|
| `id`  | `number` | ✅ Sí     | Debe ser un número entero|

**Ejemplo:**

```json
{ "id": 1 }
```

#### 13.4 - Actualizar producto

```ts
// Comando
client.send({ cmd: 'update_product' }, payload);
```

**Payload:**

| Campo  | Tipo     | Requerido | Validación                          |
|--------|----------|-----------|-------------------------------------|
| `id`   | `number` | ✅ Sí     | Debe ser positivo                   |
| `name` | `string` | ❌ No     | Debe ser un string                  |
| `price`| `number` | ❌ No     | Mínimo 0, máximo 4 decimales        |

> Al menos un campo además de `id` debe enviarse para que la actualización tenga sentido.

**Ejemplo:**

```json
{
  "id": 1,
  "price": 899.99
}
```

#### 13.5 - Eliminar producto (soft delete)

```ts
// Comando
client.send({ cmd: 'delete_product' }, { id: 1 });
```

**Payload:**

| Campo | Tipo     | Requerido | Validación              |
|-------|----------|-----------|-------------------------|
| `id`  | `number` | ✅ Sí     | Debe ser un número entero|

**Ejemplo:**

```json
{ "id": 1 }
```

> No elimina el registro de la base de datos, solo marca `available: false`.