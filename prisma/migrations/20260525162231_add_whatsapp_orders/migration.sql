-- CreateTable
CREATE TABLE "WhatsappOrder" (
    "id" TEXT NOT NULL,
    "refCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'Pakistan',
    "notes" TEXT,
    "productId" TEXT,
    "bookTitle" TEXT NOT NULL,
    "edition" TEXT NOT NULL DEFAULT 'Paperback',
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "shipping" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsappOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WhatsappOrder_refCode_key" ON "WhatsappOrder"("refCode");

-- CreateIndex
CREATE INDEX "WhatsappOrder_createdAt_idx" ON "WhatsappOrder"("createdAt");

-- CreateIndex
CREATE INDEX "WhatsappOrder_status_idx" ON "WhatsappOrder"("status");

-- CreateIndex
CREATE INDEX "WhatsappOrder_refCode_idx" ON "WhatsappOrder"("refCode");
