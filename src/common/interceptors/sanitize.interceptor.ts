import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { map } from 'rxjs/operators'

/**
 * Globally strip sensitive fields from every response.
 * Adds defence-in-depth on top of Prisma `select` choices in each service.
 *
 * Never leaked:
 *  - password
 *  - otpCode (and raw code fields)
 *  - encryption keys / tokens accidentally returned
 *
 * Bank account numbers come through encrypted-at-rest; services that need to
 * surface them call `decrypt` then `maskAccount` so callers see only •••• 6702.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordHash',
  'otpCode',
  'code',                 // OTP raw code
  'jwtSecret',
  'rawAccountNumber',
])

function scrub(node: any): any {
  if (node === null || node === undefined) return node
  if (Array.isArray(node)) return node.map(scrub)
  if (typeof node !== 'object') return node
  if (node instanceof Date) return node

  const out: any = {}
  for (const [k, v] of Object.entries(node)) {
    if (SENSITIVE_KEYS.has(k)) continue
    out[k] = scrub(v)
  }
  return out
}

@Injectable()
export class SanitizeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map(data => scrub(data)))
  }
}
