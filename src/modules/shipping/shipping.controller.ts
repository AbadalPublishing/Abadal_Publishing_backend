import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ShippingService } from './shipping.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('shipping')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShippingController {
  constructor(private shipping: ShippingService) {}

  @Public() @Post('rates')
  rates(@Body() body: { city: string; weight: number; subtotal: number }) {
    return this.shipping.getRates(body.city, body.weight, body.subtotal);
  }

  @Post(':orderId/book') @Roles('SUPER_ADMIN')
  book(@Param('orderId', ParseUUIDPipe) orderId: string, @Body() body: { courier: 'TRAX' | 'LEOPARDS' }) {
    return this.shipping.bookShipment(orderId, body.courier);
  }

  @Get(':orderId/track')
  track(@Param('orderId', ParseUUIDPipe) orderId: string, @CurrentUser() user: any) {
    return this.shipping.trackShipment(orderId, user);
  }

  @Get(':orderId/waybill') @Roles('SUPER_ADMIN')
  async waybill(@Param('orderId', ParseUUIDPipe) orderId: string, @Res() res: Response) {
    const pdf = await this.shipping.waybill(orderId);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="waybill-${orderId}.pdf"`);
    res.send(pdf);
  }
}
