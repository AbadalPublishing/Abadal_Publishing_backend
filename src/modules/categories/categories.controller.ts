import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CategoriesController {
  constructor(private categories: CategoriesService) {}

  @Public() @Get()
  list() { return this.categories.list(); }

  @Post() @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateCategoryDto) { return this.categories.create(dto); }

  @Patch(':id') @Roles('SUPER_ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateCategoryDto) {
    return this.categories.update(id, dto);
  }

  @Delete(':id') @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.categories.remove(id); }
}
