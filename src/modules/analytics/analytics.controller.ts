import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  @Public() @Post('event')
  event(@Body() body: any, @Req() req: any) {
    return this.analytics.recordEvents(body, req.user?.id);
  }

  @Get('dashboard') @Roles('SUPER_ADMIN')
  dashboard(@Query('range') range?: string) { return this.analytics.dashboard(range); }

  @Get('live-visitors') @Roles('SUPER_ADMIN')
  live() { return this.analytics.liveVisitors(); }

  @Get('top-products') @Roles('SUPER_ADMIN')
  top(@Query('range') range?: string) { return this.analytics.topProducts(range); }

  @Get('book-engagement') @Roles('SUPER_ADMIN')
  bookEngagement(@Query('range') range?: string) { return this.analytics.bookEngagement(range); }

  @Get('geography') @Roles('SUPER_ADMIN')
  geo() { return this.analytics.geography(); }

  @Get('export') @Roles('SUPER_ADMIN')
  async export(@Query('type') type: string, @Res() res: Response) {
    const { filename, csv } = await this.analytics.export(type || 'orders');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }
}
