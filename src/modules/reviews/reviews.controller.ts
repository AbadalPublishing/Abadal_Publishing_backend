import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { CreateReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('reviews')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReviewsController {
  constructor(private reviews: ReviewsService) {}

  @Post()
  create(@CurrentUser('id') userId: string, @Body() dto: CreateReviewDto) {
    return this.reviews.create(userId, dto);
  }

  @Get('can-review')
  canReview(@CurrentUser('id') userId: string, @Query('productId') productId?: string) {
    return this.reviews.canReview(userId, productId || '');
  }

  @Public() @Get()
  list(@Query('productId') productId?: string) { return this.reviews.list(productId); }

  @Get('pending') @Roles('SUPER_ADMIN')
  pending() { return this.reviews.pending(); }

  @Patch(':id/approve') @Roles('SUPER_ADMIN')
  approve(@Param('id', ParseUUIDPipe) id: string) { return this.reviews.approve(id); }

  @Delete(':id') @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.reviews.remove(id); }
}
