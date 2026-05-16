import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto, UpdateAddressDto } from './dto/address.dto';

@Injectable()
export class AddressesService {
  constructor(private prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.address.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
  }

  async create(userId: string, dto: CreateAddressDto) {
    const count = await this.prisma.address.count({ where: { userId } });
    const isDefault = count === 0 || !!dto.isDefault;
    if (isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({ data: { ...dto, userId, isDefault } });
  }

  private async own(userId: string, id: string) {
    const a = await this.prisma.address.findUnique({ where: { id } });
    if (!a) throw new NotFoundException();
    if (a.userId !== userId) throw new ForbiddenException();
    return a;
  }

  async update(userId: string, id: string, dto: UpdateAddressDto) {
    await this.own(userId, id);
    return this.prisma.address.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.address.delete({ where: { id } });
    return { success: true };
  }

  async setDefault(userId: string, id: string) {
    await this.own(userId, id);
    await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    return this.prisma.address.update({ where: { id }, data: { isDefault: true } });
  }
}
