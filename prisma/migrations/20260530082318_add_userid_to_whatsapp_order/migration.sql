-- AlterTable
ALTER TABLE "WhatsappOrder" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE INDEX "WhatsappOrder_userId_idx" ON "WhatsappOrder"("userId");
