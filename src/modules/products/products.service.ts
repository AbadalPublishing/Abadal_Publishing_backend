import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto, VariantDto, FeaturedDto } from './dto/product.dto';
import { slugify } from '../../common/utils/slug';
import { CacheHelper } from '../../common/services/cache.helper';
import { EmailService } from '../email/email.service';

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService, private cache: CacheHelper, private email: EmailService) {}

  private async bust() {
    await Promise.all([
      this.cache.del('products:featured'),
      this.cache.del('products:list:default'),
    ]);
  }

  private async uniqueSlug(title: string) {
    let slug = slugify(title);
    let n = 1;
    while (await this.prisma.product.findUnique({ where: { slug } })) {
      slug = `${slugify(title)}-${++n}`;
    }
    return slug;
  }

  async list(q: any) {
    const page = Math.max(1, parseInt(q.page || '1'));
    const limit = Math.min(100, parseInt(q.limit || '20'));
    const where: any = { isActive: true, deletedAt: null };
    if (q.category) where.category = { slug: q.category };
    if (q.author) where.author = { slug: q.author };
    if (q.type) where.type = q.type;
    if (q.search) where.title = { contains: q.search, mode: 'insensitive' };
    if (q.priceMin || q.priceMax) {
      where.variants = {
        some: {
          ...(q.priceMin && { retailPrice: { gte: parseFloat(q.priceMin) } }),
          ...(q.priceMax && { retailPrice: { lte: parseFloat(q.priceMax) } }),
        },
      };
    }
    let orderBy: any = { createdAt: 'desc' };
    if (q.sort === 'newest') orderBy = { createdAt: 'desc' };
    if (q.sort === 'priceLow') orderBy = { createdAt: 'asc' };
    if (q.sort === 'bestSelling') orderBy = { orderItems: { _count: 'desc' } };
    if (q.sort === 'mostReviewed') orderBy = { reviews: { _count: 'desc' } };

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where, orderBy,
        skip: (page - 1) * limit, take: limit,
        include: {
          variants: true,
          author: { select: { id: true, penName: true, slug: true } },
          category: { select: { id: true, name: true, slug: true } },
          _count: { select: { reviews: { where: { status: 'APPROVED' } } } },
        },
      }),
      this.prisma.product.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async featured() {
    // Cached 60s — featured book is on every homepage hit
    return this.cache.wrap('products:featured', 60_000, async () => {
      const now = new Date();
      let p = await this.prisma.product.findFirst({
        where: {
          isFeatured: true, isActive: true, deletedAt: null,
          OR: [{ featuredUntil: null }, { featuredUntil: { gt: now } }],
        },
        include: { variants: true, author: true, category: true },
      });
      if (p) return p;
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const groups = await this.prisma.orderItem.groupBy({
        by: ['productId'],
        where: { order: { createdAt: { gt: since } } },
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: 'desc' } },
        take: 1,
      });
      if (!groups.length) return null;
      return this.prisma.product.findUnique({
        where: { id: groups[0].productId },
        include: { variants: true, author: true, category: true },
      });
    });
  }

  async bySlug(slug: string) {
    // Cached 60s — book detail pages are heavily trafficked
    return this.cache.wrap(`products:slug:${slug}`, 60_000, async () => {
      const product = await this.prisma.product.findUnique({
        where: { slug },
        include: {
          variants: true,
          author: true,
          category: true,
          reviews: {
            where: { status: 'APPROVED' },
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
      });
      if (!product || product.deletedAt) throw new NotFoundException('Product not found');
      const related = await this.prisma.product.findMany({
        where: {
          id: { not: product.id }, isActive: true, deletedAt: null,
          OR: [{ categoryId: product.categoryId }, { authorId: product.authorId }],
        },
        take: 3,
        select: {
          id: true, title: true, slug: true, coverImage: true, type: true,
          variants: { select: { id: true, type: true, retailPrice: true, amazonOnly: true } },
          author: { select: { penName: true, slug: true } },
        },
      });
      return { ...product, related };
    });
  }

  async create(dto: CreateProductDto) {
    const slug = await this.uniqueSlug(dto.title);
    const { variants, ...rest } = dto;
    const out = await this.prisma.product.create({
      data: {
        ...rest,
        slug,
        featuredUntil: dto.featuredUntil ? new Date(dto.featuredUntil) : null,
        variants: variants ? { create: variants as any } : undefined,
      },
      include: { variants: true },
    });
    await this.bust();
    return out;
  }

  async update(id: string, dto: UpdateProductDto, user: any) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { author: true } });
    if (!product || product.deletedAt) throw new NotFoundException();
    let data: any;
    if (user.role === 'SUPER_ADMIN') {
      data = { ...dto };
      delete data.variants;
      if (dto.featuredUntil) data.featuredUntil = new Date(dto.featuredUntil);
    } else if (user.role === 'AUTHOR' && product.author?.userId === user.id) {
      data = {
        description: dto.description,
        pullQuote: dto.pullQuote,
        editorialNote: dto.editorialNote,
      };
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    } else {
      throw new ForbiddenException();
    }
    const updated = await this.prisma.product.update({ where: { id }, data, include: { variants: true } });
    await this.bust();
    await this.cache.del(`products:slug:${updated.slug}`);
    return updated;
  }

  async softDelete(id: string) {
    const p = await this.prisma.product.update({ where: { id }, data: { deletedAt: new Date(), isActive: false } });
    await this.bust();
    await this.cache.del(`products:slug:${p.slug}`);
    return { success: true };
  }

  async setFeatured(id: string, dto: FeaturedDto) {
    const out = await this.prisma.product.update({
      where: { id },
      data: { isFeatured: dto.isFeatured, featuredUntil: dto.featuredUntil ? new Date(dto.featuredUntil) : null },
    });
    await this.bust();
    return out;
  }

  async addVariant(productId: string, dto: VariantDto) {
    return this.prisma.productVariant.create({ data: { ...dto, productId } as any });
  }

  async updateVariant(id: string, dto: Partial<VariantDto>, user: any) {
    const v = await this.prisma.productVariant.findUnique({
      where: { id }, include: { product: { include: { author: true } } },
    });
    if (!v) throw new NotFoundException();
    let data: any;
    if (user.role === 'SUPER_ADMIN') {
      data = { ...dto };
    } else if (user.role === 'AUTHOR' && v.product.author?.userId === user.id) {
      data = {
        retailPrice: dto.retailPrice,
        wholesalePrice: dto.wholesalePrice,
        studentPrice: dto.studentPrice,
        stock: dto.stock,
      };
      Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);
    } else throw new ForbiddenException();
    const oldStock = v.stock;
    const updated = await this.prisma.productVariant.update({ where: { id }, data });
    if (data.stock !== undefined && data.stock !== oldStock) {
      await this.prisma.stockMovement.create({
        data: {
          variantId: id, delta: data.stock - oldStock,
          reason: 'ADJUSTMENT', adminId: user.id,
        },
      });
    }
    return updated;
  }

  async removeVariant(id: string) {
    await this.prisma.productVariant.delete({ where: { id } });
    return { success: true };
  }

  async submit(userId: string, dto: any) {
    const author = await this.prisma.author.findUnique({ where: { userId } });
    if (!author) throw new ForbiddenException('Only authors can submit books');
    const slug = await this.uniqueSlug(dto.title);
    const { variants, ...rest } = dto;
    return this.prisma.product.create({
      data: {
        ...rest,
        slug,
        authorId: author.id,
        isActive: false,
        submissionStatus: 'PENDING_REVIEW',
        variants: variants ? { create: variants as any } : undefined,
      },
      include: { variants: true },
    });
  }

  async listPending() {
    return this.prisma.product.findMany({
      where: { submissionStatus: 'PENDING_REVIEW', deletedAt: null },
      include: {
        variants: true,
        author: { include: { user: { select: { email: true, firstName: true, lastName: true } } } },
        category: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approveSubmission(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { author: { include: { user: true } } } });
    if (!product) throw new NotFoundException();
    if (product.submissionStatus !== 'PENDING_REVIEW') throw new BadRequestException('Product is not pending review');
    const updated = await this.prisma.product.update({
      where: { id },
      data: { submissionStatus: 'APPROVED', isActive: true, submissionNote: null },
      include: { variants: true, author: true },
    });
    await this.bust();
    if (product.author?.user?.email) {
      await this.email.sendSubmissionApproved(product as any);
    }
    return updated;
  }

  async rejectSubmission(id: string, note: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { author: { include: { user: true } } } });
    if (!product) throw new NotFoundException();
    if (product.submissionStatus !== 'PENDING_REVIEW') throw new BadRequestException('Product is not pending review');
    const updated = await this.prisma.product.update({
      where: { id },
      data: { submissionStatus: 'REJECTED', isActive: false, submissionNote: note || null },
    });
    if (product.author?.user?.email) {
      await this.email.sendSubmissionRejected(product as any, note);
    }
    return updated;
  }

  async mySubmissions(userId: string) {
    const author = await this.prisma.author.findUnique({ where: { userId } });
    if (!author) return [];
    return this.prisma.product.findMany({
      where: { authorId: author.id, submissionStatus: { in: ['DRAFT', 'PENDING_REVIEW', 'REJECTED'] }, deletedAt: null },
      include: { variants: true, category: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
