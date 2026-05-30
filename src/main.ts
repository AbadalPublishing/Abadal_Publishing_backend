import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { NestExpressApplication } from '@nestjs/platform-express'
import { AppModule } from './app.module'
import { join } from 'path'
import helmet from 'helmet'
import * as compression from 'compression'
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? ['error', 'warn', 'log'] : ['log', 'debug', 'error', 'verbose', 'warn'],
  })

  // ─── SECURITY ───
  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  )
  app.use(cookieParser())

  // ─── PERFORMANCE ───
  app.use(compression({ threshold: 1024 })) // compress responses > 1KB

  // ─── VALIDATION ───
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,           // strip unknown fields
      forbidNonWhitelisted: true, // reject unknown fields
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    })
  )

  // ─── CORS — strict, only known origins ───
  const allowed = (process.env.FRONTEND_URL || 'http://localhost:5173')
    .split(',')
    .map(s => s.trim())
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin || allowed.includes(origin)) return cb(null, true)
      cb(new Error('Not allowed by CORS'))
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })

  app.useStaticAssets(join(__dirname, '..', 'uploads'), { prefix: '/uploads' })
  app.setGlobalPrefix('api')

  // Trust proxy for Railway/Vercel — needed for real client IP in rate limiter
  app.set('trust proxy', 1)

  // Swagger only in non-production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Abadal API')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config))
  }

  const port = process.env.PORT || 3001
  await app.listen(port)
  Logger.log(`🚀 Server running on http://localhost:${port}/api`, 'Bootstrap')
}
bootstrap()
