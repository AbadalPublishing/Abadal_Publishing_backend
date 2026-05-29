-- AlterTable
ALTER TABLE "WhatsappOrder" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "deliveredAt" TIMESTAMP(3),
ADD COLUMN     "deliveryConfirmedAt" TIMESTAMP(3),
ADD COLUMN     "paymentAccount" TEXT,
ADD COLUMN     "paymentReceivedAt" TIMESTAMP(3);
