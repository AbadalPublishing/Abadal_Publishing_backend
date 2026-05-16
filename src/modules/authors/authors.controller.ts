import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('authors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuthorsController {
  constructor(private authors: AuthorsService) {}

  @Post()
  @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateAuthorDto) {
    return this.authors.create(dto);
  }

  @Public()
  @Get()
  list() {
    return this.authors.listPublic();
  }

  @Get('me/stats')
  @Roles('AUTHOR')
  myStats(@CurrentUser('id') userId: string) {
    return this.authors.myStats(userId);
  }

  @Public()
  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.authors.getBySlug(slug);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAuthorDto, @CurrentUser() user: any) {
    return this.authors.update(id, dto, user);
  }
}
