import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler'
import { CacheModule } from '@nestjs/cache-manager'
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'

import { AuthModule } from './modules/auth/auth.module'
import { UsersModule } from './modules/users/users.module'
import { AuthorsModule } from './modules/authors/authors.module'
import { ProductsModule } from './modules/products/products.module'
import { CategoriesModule } from './modules/categories/categories.module'
import { CartModule } from './modules/cart/cart.module'
import { AddressesModule } from './modules/addresses/addresses.module'
import { OrdersModule } from './modules/orders/orders.module'
import { ShippingModule } from './modules/shipping/shipping.module'
import { MediaModule } from './modules/media/media.module'
import { ReviewsModule } from './modules/reviews/reviews.module'
import { WishlistModule } from './modules/wishlist/wishlist.module'
import { CouponsModule } from './modules/coupons/coupons.module'
import { PaymentAccountsModule } from './modules/payment-accounts/payment-accounts.module'
import { RoyaltyPayoutsModule } from './modules/royalty-payouts/royalty-payouts.module'
import { SettingsModule } from './modules/settings/settings.module'
import { AnalyticsModule } from './modules/analytics/analytics.module'
import { WhatsappOrdersModule } from './modules/whatsapp-orders/whatsapp-orders.module'
import { AuditModule } from './modules/audit/audit.module'
import { EmailModule } from './modules/email/email.module'
import { KafkaModule } from './modules/kafka/kafka.module'
import { PrismaModule } from './modules/prisma/prisma.module'

import { SanitizeInterceptor } from './common/interceptors/sanitize.interceptor'
import { CommonModule } from './common/common.module'

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),

    // ─── Rate limiting (balanced: 10/min auth, 60/min writes, 300/min reads) ───
    // Multiple tiers — services use @SkipThrottle / @Throttle to override per-route.
    ThrottlerModule.forRoot([
      { name: 'short',  ttl: 1000, limit: 6 },     // burst limit: 6 req/sec
      { name: 'medium', ttl: 60_000, limit: 300 }, // 300 req/min default (reads)
      { name: 'long',   ttl: 60_000 * 60, limit: 5000 }, // 5000 req/hr per IP overall
    ]),

    // ─── In-memory cache (zero-cost: no Redis on Railway) ───
    // Stores hot keys for 60s default; per-key TTL set via cacheManager.set(key, val, ttl)
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000,        // 60 seconds default
      max: 1000,          // max 1000 keys in memory (LRU eviction)
    }),

    // ─── Infra ───
    CommonModule,
    PrismaModule,
    KafkaModule,
    EmailModule,
    AuditModule,

    // ─── Domain ───
    AuthModule,
    UsersModule,
    AuthorsModule,
    ProductsModule,
    CategoriesModule,
    CartModule,
    AddressesModule,
    OrdersModule,
    ShippingModule,
    MediaModule,
    ReviewsModule,
    WishlistModule,
    CouponsModule,
    PaymentAccountsModule,
    RoyaltyPayoutsModule,
    SettingsModule,
    AnalyticsModule,
    WhatsappOrdersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: SanitizeInterceptor },
  ],
})
export class AppModule {}
