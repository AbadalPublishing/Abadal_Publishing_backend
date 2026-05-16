import { Throttle } from '@nestjs/throttler'

/** 10/min — applied to /auth/login, /auth/register, /auth/admin-login, /auth/forgot-password */
export const AuthRateLimit = () => Throttle({ medium: { limit: 10, ttl: 60_000 } })

/** 60/min — applied to write endpoints (POST/PATCH/DELETE) */
export const WriteRateLimit = () => Throttle({ medium: { limit: 60, ttl: 60_000 } })
