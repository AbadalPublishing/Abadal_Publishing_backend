/**
 * Abadal Publishing — Initial Database Seed
 * Creates: Super Admin · Author Waqar Ali Khan · Book "Badal: Not Revenge"
 *
 * Run with: npx prisma db seed
 */

import { PrismaClient, Role, ProductType, VariantType, AccountType } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

// Seed must use the direct (non-pooled) connection — pgBouncer pooler times out on seed
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_DIRECT_URL || process.env.DATABASE_URL } },
})

async function main() {
  console.log('🌱 Seeding Abadal Publishing database…\n')

  // 1. SITE SETTINGS
  const settings = await prisma.siteSettings.findFirst()
  if (!settings) {
    await prisma.siteSettings.create({
      data: {
        storeName: 'Abadal Publishing',
        storeEmail: 'info@abadalpublishing.com',
        storePhone: '+92 91 1234567',
        whatsappNumber: '923039555966',
        address: 'University Town',
        city: 'Peshawar',
        country: 'Pakistan',
        socialLinks: { twitter: '@AbadalPublishing', instagram: '@abadalpublishing' },
        shippingRate: 200,
        freeShippingAbove: 2000,
        lowStockThreshold: 10,
      },
    })
    console.log('✓ Site settings created')
  }

  // 2. SUPER ADMIN
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@abadalpublishing.com'
  const adminPassword = process.env.ADMIN_PASSWORD || 'AbadalAdmin2026!'
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })
  let superAdmin
  if (!existingAdmin) {
    superAdmin = await prisma.user.create({
      data: {
        email: adminEmail,
        password: await bcrypt.hash(adminPassword, 10),
        firstName: 'Super',
        lastName: 'Admin',
        phone: '+92 91 1234567',
        city: 'Peshawar',
        role: Role.SUPER_ADMIN,
        emailVerified: true,
        phoneVerified: true,
      },
    })
    console.log(`✓ Super Admin: ${adminEmail} / ${adminPassword}`)
  } else {
    superAdmin = existingAdmin
    console.log('✓ Super Admin already exists')
  }

  // 3. CATEGORIES (the three imprints)
  const categories = [
    { name: 'Scholarship', slug: 'scholarship', description: 'Scholarship & Historical Inquiry' },
    { name: 'Literary Non-Fiction', slug: 'literary-non-fiction', description: 'Literary Non-Fiction & Memoir' },
    { name: 'Translation', slug: 'translation', description: 'Translation from the Pashto & Persianate Worlds' },
    { name: 'Memoir', slug: 'memoir', description: 'Personal narratives and remembrance' },
  ]

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      create: cat,
      update: {},
    })
  }
  console.log('✓ Categories: Scholarship, Literary Non-Fiction, Translation, Memoir')

  const scholarshipCat = await prisma.category.findUnique({ where: { slug: 'scholarship' } })

  // 4. AUTHOR: Waqar Ali Khan
  const authorEmail = 'waqar@abadalpublishing.com'
  const existingAuthorUser = await prisma.user.findUnique({ where: { email: authorEmail } })
  let authorUser, author
  if (!existingAuthorUser) {
    authorUser = await prisma.user.create({
      data: {
        email: authorEmail,
        password: await bcrypt.hash('WaqarAuthor2026!', 10),
        firstName: 'Waqar Ali',
        lastName: 'Khan',
        phone: '+92 300 0000000',
        city: 'Peshawar',
        role: Role.AUTHOR,
        emailVerified: true,
      },
    })
    author = await prisma.author.create({
      data: {
        userId: authorUser.id,
        slug: 'waqar-ali-khan',
        penName: 'Waqar Ali Khan',
        bio: 'A historian and scholar of South Asian studies, specialising in Pashtun history and the colonial misrepresentation of Pashtunwali. Based in Peshawar, Khyber Pakhtunkhwa.',
        photo: '/assets/author-waqar.jpg',
        nationality: 'Pakistani',
        languages: ['English', 'Pashto', 'Urdu'],
        royaltyPercentage: 10,
        isVerified: true,
        socialLinks: {},
      },
    })
    console.log('✓ Author: Waqar Ali Khan')
  } else {
    authorUser = existingAuthorUser
    author = await prisma.author.findUnique({ where: { userId: authorUser.id } })
    console.log('✓ Author Waqar already exists')
  }

  // 5. BOOK: Badal: Not Revenge.
  const existingBook = await prisma.product.findUnique({ where: { slug: 'badal-not-revenge' } })
  let book
  if (!existingBook) {
    book = await prisma.product.create({
      data: {
        title: 'Badal: Not Revenge.',
        slug: 'badal-not-revenge',
        type: ProductType.BOOK,
        language: 'English',
        description: 'A single mistranslated word has shaped two centuries of policy, conquest, and suffering. In this rigorous work of intellectual history, Waqar Ali Khan traces the colonial misreading of Pashtunwali — from the courts of Mughal Jehangir to the desks of British administrators — and dismantles the scaffolding of received academic truth that grew up around it. A founding statement for the house, and the beginning of the work of correction.',
        pullQuote: '"The Pashtuns number sixty million. For most of modern history, the terms on which the world has understood them have been set by those who misread them. This book begins the work of correction."',
        editorialNote: 'A founding statement for the house, and the beginning of the work of correction.',
        coverImage: '/assets/book-cover.jpg',
        publisher: 'Abadal Publishing',
        publishedDate: '2026',
        pages: 320,
        tags: ['History', 'Pashtunwali', 'Colonial Studies', 'KPK', 'Intellectual History'],
        amazonUrl: 'https://www.amazon.com/dp/B0GZPLK3PJ/',
        whatsappEnabled: true,
        isFeatured: true,
        authorId: author!.id,
        categoryId: scholarshipCat!.id,
        variants: {
          create: [
            {
              type: VariantType.PAPERBACK,
              isbn: '978-0-000-00000-0',
              sku: 'ABD-BADAL-PB',
              retailPrice: 2750,
              wholesalePrice: 2000,
              studentPrice: 1500,
              listPrice: 5500,
              stock: 100,
              lowStockThreshold: 10,
              weight: 450,
              length: 22,
              width: 14,
              height: 2.4,
              royaltyPercentage: 10,
            },
            {
              type: VariantType.HARDCOVER,
              isbn: '978-0-000-00001-7',
              sku: 'ABD-BADAL-HC',
              retailPrice: 5000,
              wholesalePrice: 3800,
              studentPrice: 2800,
              listPrice: 5000,
              stock: 30,
              lowStockThreshold: 5,
              weight: 750,
              length: 23,
              width: 15,
              height: 3,
              royaltyPercentage: 12,
            },
            {
              type: VariantType.EBOOK,
              isbn: '978-0-000-00002-4',
              sku: 'ABD-BADAL-EB',
              retailPrice: 0,
              wholesalePrice: 0,
              studentPrice: 0,
              listPrice: 0,
              stock: 999,
              royaltyPercentage: 20,
              amazonOnly: true,
              weight: 0,
            },
          ],
        },
      },
    })
    console.log('✓ Book: Badal: Not Revenge. (3 variants)')
  } else {
    console.log('✓ Book Badal already exists')
  }

  console.log('\n─────────────────────────────────────────')
  console.log('✓ Database seeded successfully')
  console.log('─────────────────────────────────────────')
  console.log(`Super Admin: ${adminEmail}`)
  console.log(`Password:    ${adminPassword}`)
  console.log('─────────────────────────────────────────')
  console.log(`Author login: ${authorEmail}`)
  console.log(`Password:     WaqarAuthor2026!`)
  console.log('─────────────────────────────────────────\n')
}

main()
  .catch(e => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
