import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { CouponsService } from './coupons.service';
import { CreateCouponDto, ValidateCouponDto } from './dto/coupon.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('coupons')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CouponsController {
  constructor(private coupons: CouponsService) {}

  @Post() @Roles('SUPER_ADMIN')
  create(@Body() dto: CreateCouponDto) { return this.coupons.create(dto); }

  @Get() @Roles('SUPER_ADMIN')
  list() { return this.coupons.list(); }

  @Post('validate')
  validate(@CurrentUser('id') userId: string, @Body() dto: ValidateCouponDto) {
    return this.coupons.validate(userId, dto.code, dto.orderTotal);
  }

  @Delete(':id') @Roles('SUPER_ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.coupons.remove(id); }
}
