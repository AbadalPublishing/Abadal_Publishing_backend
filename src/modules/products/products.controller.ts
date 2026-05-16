import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto, VariantDto, FeaturedDto } from './dto/product.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Public() @Get()
  list(@Query() q: any) { return this.products.list(q); }

  @Public() @Get('featured')
  featured() { return this.products.featured(); }

  @Get('pending') @Roles('SUPER_ADMIN')
  pending() { return this.products.listPending(); }

  @Get('my-submissions') @Roles('AUTHOR')
  mySubmissions(@CurrentUser('id') userId: string) { return this.products.mySubmissions(userId); }

  @Post('submit') @Roles('AUTHOR')
  submit(@Body() dto: any, @CurrentUser('id') userId: string) { return this.products.submit(userId, dto); }

  @Patch(':id/approve') @Roles('SUPER_ADMIN')
  approve(@Param('id', ParseUUIDPipe) id: string) { return this.products.approveSubmission(id); }

  @Patch(':id/reject') @Roles('SUPER_ADMIN')
  reject(@Param('id', ParseUUIDPipe) id: string, @Body() body: { note?: string }) {
    return this.products.rejectSubmission(id, body.note || '');
  }

  @Public() @Get(':slug')
  bySlug(@Param('slug') slug: string) { return this.products.bySlug(slug); }

  @Post() @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateProductDto) { return this.products.create(dto); }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateProductDto, @CurrentUser() user: any) {
    return this.products.update(id, dto, user);
  }

  @Delete(':id') @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.products.softDelete(id); }

  @Patch(':id/featured') @Roles('SUPER_ADMIN')
  setFeatured(@Param('id', ParseUUIDPipe) id: string, @Body() dto: FeaturedDto) {
    return this.products.setFeatured(id, dto);
  }

  @Post(':id/variants') @Roles('SUPER_ADMIN')
  addVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: VariantDto) {
    return this.products.addVariant(id, dto);
  }

  @Patch('variants/:id')
  updateVariant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: Partial<VariantDto>, @CurrentUser() user: any) {
    return this.products.updateVariant(id, dto, user);
  }

  @Delete('variants/:id') @Roles('SUPER_ADMIN')
  removeVariant(@Param('id', ParseUUIDPipe) id: string) { return this.products.removeVariant(id); }
}
