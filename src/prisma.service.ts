import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService implements OnModuleDestroy {
  private client: InstanceType<typeof PrismaClient>;

  constructor() {
    const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
    this.client = new PrismaClient({ adapter });
  }

  get product() {
    return this.client.product;
  }

  onModuleDestroy() {
    return this.client.$disconnect();
  }
}
