import { PrismaClient } from '@prisma/client';
import { processMessage } from './src/modules/ocr/ocr.service';
import { logger } from './src/lib/logger';

const prisma = new PrismaClient();

async function retryFailedOcrMessages() {
  try {
    console.log('Starting to retry failed OCR messages...');
    
    // Find all messages that have images but no OCR results
    const messages = await prisma.zaloMessage.findMany({
      where: {
        images: {
          isEmpty: false
        },
        ocrResults: {
          none: {} // No OCR results associated
        }
      },
      select: {
        id: true,
        groupId: true,
        text: true,
        images: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Found ${messages.length} messages without OCR results`);

    // Process each message
    for (const message of messages) {
      try {
        // Determine category based on group ID (you can adjust this logic)
        const category = message.groupId.includes('6263949826900580831') || 
                         message.groupId.includes('1361198942550888658') 
          ? 'fuel' 
          : 'repair';

        console.log(`Processing message ${message.id} (${category})`);
        
        const results = await processMessage(message.id, category);
        console.log(`Successfully processed message ${message.id}: ${results.length} results`);
      } catch (error) {
        console.error(`Failed to process message ${message.id}:`, error);
        logger.error('OCR retry failed', {
          messageId: message.id,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    console.log('Finished retrying failed OCR messages');
  } catch (error) {
    console.error('Error in retry process:', error);
    logger.error('Retry OCR process failed', {
      error: error instanceof Error ? error.message : String(error)
    });
  } finally {
    await prisma.$disconnect();
  }
}

retryFailedOcrMessages().catch(console.error);