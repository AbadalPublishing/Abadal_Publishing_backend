import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { slugify } from '../../common/utils/slug';
import { CacheHelper } from '../../common/services/cache.helper';

@Injectable()
export class CategoriesService {
  constructor(private prisma: PrismaService, private cache: CacheHelper) {}

  list() {
    // Cached 10 min — categories change very rarely, hit on every catalog/filter render
    return this.cache.wrap('categories:list', 10 * 60_000, async () =>
      this.prisma.category.findMany({
        select: {
          id: true, name: true, slug: true, description: true, image: true, parentId: true,
          _count: { select: { products: true } },
        },
        orderBy: { name: 'asc' },
      })
    );
  }

  async create(dto: CreateCategoryDto) {
    let slug = slugify(dto.name);
    let n = 1;
    while (await this.prisma.category.findUnique({ where: { slug } })) {
      slug = `${slugify(dto.name)}-${++n}`;
    }
    const out = await this.prisma.category.create({ data: { ...dto, slug } });
    await this.cache.del('categories:list');
    return out;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    const data: any = { ...dto };
    if (dto.name && dto.name !== exists.name) data.slug = slugify(dto.name);
    const out = await this.prisma.category.update({ where: { id }, data });
    await this.cache.del('categories:list');
    return out;
  }

  async remove(id: string) {
    const exists = await this.prisma.category.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException();
    await this.prisma.category.delete({ where: { id } });
    await this.cache.del('categories:list');
    return { success: true };
  }
}
