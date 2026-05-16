import { Global, Module } from '@nestjs/common'
import { CacheHelper } from './services/cache.helper'

@Global()
@Module({
  providers: [CacheHelper],
  exports: [CacheHelper],
})
export class CommonModule {}
