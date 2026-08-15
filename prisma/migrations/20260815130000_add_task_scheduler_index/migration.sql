-- CreateIndex
CREATE INDEX "Task_shop_status_scheduledAt_idx" ON "Task"("shop", "status", "scheduledAt");
