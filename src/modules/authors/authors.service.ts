import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { slugify } from '../../common/utils/slug';
import { CacheHelper } from '../../common/services/cache.helper';

@Injectable()
export class AuthorsService {
  constructor(private prisma: PrismaService, private cache: CacheHelper) {}

  private async bust(slug?: string) {
    await this.cache.del('authors:list:public');
    if (slug) await this.cache.del(`authors:slug:${slug}`);
  }

  async create(dto: CreateAuthorDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new BadRequestException('Email already registered');
    const hash = await bcrypt.hash(dto.password, 10);
    let slug = slugify(dto.penName);
    let n = 1;
    while (await this.prisma.author.findUnique({ where: { slug } })) {
      slug = `${slugify(dto.penName)}-${++n}`;
    }
    return this.prisma.user.create({
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        email: dto.email,
        password: hash,
        role: 'AUTHOR',
        author: {
          create: {
            slug,
            penName: dto.penName,
            bio: dto.bio,
            photo: dto.photo,
            website: dto.website,
            socialLinks: dto.socialLinks,
            nationality: dto.nationality,
            languages: dto.languages || [],
            royaltyPercentage: dto.royaltyPercentage ?? 10,
          },
        },
      },
      include: { author: true },
      // password is stripped at controller layer via select
    }).then(({ password, ...u }) => u);
  }

  async listPublic() {
    // Cached 5 min — authors page + homepage spotlight
    return this.cache.wrap('authors:list:public', 60_000, async () => {
      const authors = await this.prisma.author.findMany({
        // Only show verified authors whose underlying user is active and not soft-deleted
        where: {
          isVerified: true,
          user: { is: { deletedAt: null, isActive: true } },
        },
        select: {
          id: true, slug: true, penName: true, photo: true, bio: true,
          nationality: true, languages: true, isVerified: true,
          user: { select: { firstName: true, lastName: true } },
          _count: { select: { products: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      return authors.map(a => ({
        id: a.id, slug: a.slug, penName: a.penName, photo: a.photo, bio: a.bio,
        nationality: a.nationality, languages: a.languages, isVerified: a.isVerified,
        booksCount: (a as any)._count.products,
        user: a.user,
      }));
    });
  }

  async getBySlug(slug: string) {
    return this.cache.wrap(`authors:slug:${slug}`, 5 * 60_000, async () => {
      const author = await this.prisma.author.findUnique({
        where: { slug },
        include: {
          user: { select: { firstName: true, lastName: true } },
          products: {
            where: { isActive: true, deletedAt: null },
            select: {
              id: true, title: true, slug: true, type: true, coverImage: true,
              variants: { select: { type: true, retailPrice: true, amazonOnly: true } },
              category: { select: { name: true, slug: true } },
            },
          },
        },
      });
      if (!author) throw new NotFoundException('Author not found');
      return author;
    });
  }

  async update(id: string, dto: UpdateAuthorDto, currentUser: any) {
    const author = await this.prisma.author.findUnique({ where: { id } });
    if (!author) throw new NotFoundException('Author not found');
    let data: any;
    if (currentUser.role === 'SUPER_ADMIN') {
      data = { ...dto };
    } else if (currentUser.role === 'AUTHOR' && author.userId === currentUser.id) {
      data = {
        bio: dto.bio,
        photo: dto.photo,
        socialLinks: dto.socialLinks,
      };
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    } else {
      throw new ForbiddenException();
    }
    const updated = await this.prisma.author.update({ where: { id }, data });
    await this.bust(updated.slug);
    return updated;
  }

  async myStats(userId: string) {
    const author = await this.prisma.author.findUnique({ where: { userId } });
    if (!author) throw new NotFoundException('Author profile not found');
    const items = await this.prisma.orderItem.findMany({
      where: { authorId: author.id, order: { status: { in: ['DELIVERED', 'SHIPPED'] } } },
      include: { product: { select: { id: true, title: true } } },
    });
    const totalSold = items.reduce((s, i) => s + i.quantity, 0);
    const totalRevenue = items.reduce((s, i) => s + Number(i.total), 0);
    const totalRoyaltyEarned = items.reduce((s, i) => s + (Number(i.total) * Number(i.royaltyPct)) / 100, 0);
    const totalPageViews = await this.prisma.analyticsEvent.count({
      where: { eventType: 'PAGE_VIEW', product: { authorId: author.id } },
    });
    const perBook: Record<string, any> = {};
    for (const i of items) {
      const key = i.productId;
      if (!perBook[key]) perBook[key] = { productId: key, title: i.product.title, sold: 0, revenue: 0, royalty: 0 };
      perBook[key].sold += i.quantity;
      perBook[key].revenue += Number(i.total);
      perBook[key].royalty += (Number(i.total) * Number(i.royaltyPct)) / 100;
    }
    return {
      totalSold, totalRevenue, totalRoyaltyEarned, totalPageViews,
      perBook: Object.values(perBook),
    };
  }
}
