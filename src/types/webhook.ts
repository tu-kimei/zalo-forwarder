export interface WebhookPayload {
  event: string;
  timestamp: string;
  data: {
    messageId?: string;
    groupId?: string;
    groupName?: string;
    senderId?: string;
    senderName?: string;
    type: string;
    text?: string;
    images?: string[];
    rawData?: unknown;
  };
}

export interface WebhookDeliveryResult {
  webhookId: string;
  success: boolean;
  statusCode?: number;
  error?: string;
  attempt: number;
}
