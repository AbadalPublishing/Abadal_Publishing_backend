import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { RoyaltyPayoutsService } from './royalty-payouts.service';
import { CreatePayoutDto, UpdatePayoutDto } from './dto/payout.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('royalty-payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoyaltyPayoutsController {
  constructor(private payouts: RoyaltyPayoutsService) {}

  @Post() @Roles('SUPER_ADMIN')
  create(@Body() dto: CreatePayoutDto) { return this.payouts.create(dto); }

  @Get() @Roles('SUPER_ADMIN')
  list(@Query() q: any) { return this.payouts.list(q); }

  @Get('me') @Roles('AUTHOR')
  mine(@CurrentUser('id') userId: string) { return this.payouts.mine(userId); }

  @Patch(':id') @Roles('SUPER_ADMIN')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePayoutDto) {
    return this.payouts.update(id, dto);
  }
}
