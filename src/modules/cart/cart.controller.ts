import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { CartService } from './cart.service';
import { AddCartDto, MergeCartDto, UpdateCartDto } from './dto/cart.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('cart')
@UseGuards(JwtAuthGuard)
export class CartController {
  constructor(private cart: CartService) {}

  @Get()
  list(@CurrentUser('id') userId: string) { return this.cart.list(userId); }

  @Post()
  add(@CurrentUser('id') userId: string, @Body() dto: AddCartDto) {
    return this.cart.add(userId, dto);
  }

  @Patch(':itemId')
  update(@CurrentUser('id') userId: string, @Param('itemId', ParseUUIDPipe) id: string, @Body() dto: UpdateCartDto) {
    return this.cart.updateQty(userId, id, dto.quantity);
  }

  @Delete(':itemId')
  remove(@CurrentUser('id') userId: string, @Param('itemId', ParseUUIDPipe) id: string) {
    return this.cart.remove(userId, id);
  }

  @Delete()
  clear(@CurrentUser('id') userId: string) { return this.cart.clear(userId); }

  @Post('merge')
  merge(@CurrentUser('id') userId: string, @Body() dto: MergeCartDto) {
    return this.cart.merge(userId, dto);
  }
}
