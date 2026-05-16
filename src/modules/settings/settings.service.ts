import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheHelper } from '../../common/services/cache.helper';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService, private cache: CacheHelper) {}

  async get() {
    // Cached 5 min — settings change rarely but read on every page (shipping rate, WhatsApp, etc.)
    return this.cache.wrap('site:settings', 5 * 60_000, async () => {
      let s = await this.prisma.siteSettings.findFirst();
      if (!s) s = await this.prisma.siteSettings.create({ data: {} });
      return s;
    });
  }

  async update(dto: any) {
    const s = await this.get();
    const updated = await this.prisma.siteSettings.update({ where: { id: s.id }, data: dto });
    await this.cache.del('site:settings');
    return updated;
  }
}
