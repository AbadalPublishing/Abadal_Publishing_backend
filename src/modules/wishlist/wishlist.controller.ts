import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser('id') userId: string) { return this.wishlist.list(userId); }

  @Post()
  add(@CurrentUser('id') userId: string, @Body() body: { productId: string }) {
    return this.wishlist.add(userId, body.productId);
  }

  @Delete(':productId')
  remove(@CurrentUser('id') userId: string, @Param('productId', ParseUUIDPipe) productId: string) {
    return this.wishlist.remove(userId, productId);
  }
}
