-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('DRAFT', 'QR_GENERATED', 'SCANNED', 'CONFIRMED', 'ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "MessageType" AS ENUM ('TEXT', 'IMAGE', 'FILE', 'STICKER', 'UNKNOWN');

-- CreateTable
CREATE TABLE "ZaloAccount" (
    "id" TEXT NOT NULL,
    "accountId" TEXT,
    "displayName" TEXT,
    "avatar" TEXT,
    "phoneNumber" TEXT,
    "cookies" JSONB,
    "imei" TEXT,
    "userAgent" TEXT NOT NULL DEFAULT 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    "zpwEnk" TEXT,
    "loginInfo" JSONB,
    "status" "AccountStatus" NOT NULL DEFAULT 'DRAFT',
    "lastHealthCheck" TIMESTAMP(3),
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ZaloAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ZaloMessage" (
    "id" TEXT NOT NULL,
    "zaloMsgId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "groupId" TEXT,
    "groupName" TEXT,
    "senderId" TEXT NOT NULL,
    "senderName" TEXT,
    "type" "MessageType" NOT NULL DEFAULT 'TEXT',
    "text" TEXT,
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rawData" JSONB,
    "forwarded" BOOLEAN NOT NULL DEFAULT false,
    "forwardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ZaloMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookConfig" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT,
    "events" TEXT[] DEFAULT ARRAY['message']::TEXT[],
    "groupFilter" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebhookConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookLog" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "messageId" TEXT,
    "accountId" TEXT,
    "payload" JSONB NOT NULL,
    "statusCode" INTEGER,
    "response" TEXT,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupConfig" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "groupName" TEXT,
    "category" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ZaloAccount_accountId_key" ON "ZaloAccount"("accountId");

-- CreateIndex
CREATE INDEX "ZaloAccount_status_idx" ON "ZaloAccount"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ZaloMessage_zaloMsgId_key" ON "ZaloMessage"("zaloMsgId");

-- CreateIndex
CREATE INDEX "ZaloMessage_groupId_createdAt_idx" ON "ZaloMessage"("groupId", "createdAt");

-- CreateIndex
CREATE INDEX "ZaloMessage_forwarded_idx" ON "ZaloMessage"("forwarded");

-- CreateIndex
CREATE INDEX "WebhookLog_webhookId_createdAt_idx" ON "WebhookLog"("webhookId", "createdAt");

-- CreateIndex
CREATE INDEX "WebhookLog_success_idx" ON "WebhookLog"("success");

-- CreateIndex
CREATE UNIQUE INDEX "GroupConfig_groupId_key" ON "GroupConfig"("groupId");

-- AddForeignKey
ALTER TABLE "ZaloMessage" ADD CONSTRAINT "ZaloMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ZaloAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ZaloMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookLog" ADD CONSTRAINT "WebhookLog_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ZaloAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
