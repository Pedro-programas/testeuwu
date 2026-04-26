import { SQSClient, SendMessageCommand, ReceiveMessageCommand, DeleteMessageCommand, PurgeQueueCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import type { SQSMessage, ISQSService } from '../types/index.js';

// ============================================
// Mock In-Memory SQS (LOCAL MODE)
// ============================================
class LocalSQSService implements ISQSService {
  private queue: SQSMessage[] = [];
  private receiptHandleMap: Map<string, number> = new Map();

  async sendMessage(message: SQSMessage): Promise<string> {
    const receiptHandle = uuidv4();
    this.queue.push(message);
    this.receiptHandleMap.set(receiptHandle, this.queue.length - 1);
    console.log(`[LOCAL-SQS] ✉️  Mensagem enviada: ${message.action} (ID: ${message.id})`);
    return receiptHandle;
  }

  async receiveMessages(maxMessages: number = 10): Promise<SQSMessage[]> {
    const messages = this.queue.slice(0, maxMessages);
    if (messages.length > 0) {
      console.log(`[LOCAL-SQS] 📨 Recebidas ${messages.length} mensagens da fila local`);
    }
    return messages;
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    const index = this.receiptHandleMap.get(receiptHandle);
    if (index !== undefined) {
      this.queue.splice(index, 1);
      this.receiptHandleMap.delete(receiptHandle);
      console.log(`[LOCAL-SQS] 🗑️  Mensagem deletada`);
    }
  }

  async purgeQueue(): Promise<void> {
    this.queue = [];
    this.receiptHandleMap.clear();
    console.log(`[LOCAL-SQS] 🧹 Fila limpa`);
  }

  getQueueLength(): number {
    return this.queue.length;
  }
}

// ============================================
// AWS SQS Service (PRODUCTION MODE)
// ============================================
class AWSSQSService implements ISQSService {
  private client: SQSClient;
  private queueUrl: string;

  constructor(queueUrl: string) {
    this.queueUrl = queueUrl;
    this.client = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
      }
    });
  }

  async sendMessage(message: SQSMessage): Promise<string> {
    const command = new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
      MessageDeduplicationId: message.id
    });

    try {
      const response = await this.client.send(command);
      console.log(`[AWS-SQS] ✉️  Mensagem enviada: ${message.action} (MessageId: ${response.MessageId})`);
      return response.MessageId || '';
    } catch (error) {
      console.error(`[AWS-SQS] ❌ Erro ao enviar mensagem:`, error);
      throw error;
    }
  }

  async receiveMessages(maxMessages: number = 10): Promise<SQSMessage[]> {
    const command = new ReceiveMessageCommand({
      QueueUrl: this.queueUrl,
      MaxNumberOfMessages: maxMessages,
      WaitTimeSeconds: 20
    });

    try {
      const response = await this.client.send(command);
      const messages: SQSMessage[] = (response.Messages || []).map(msg => {
        return {
          ...JSON.parse(msg.Body || '{}'),
          _receiptHandle: msg.ReceiptHandle
        };
      });
      console.log(`[AWS-SQS] 📨 Recebidas ${messages.length} mensagens da fila AWS`);
      return messages;
    } catch (error) {
      console.error(`[AWS-SQS] ❌ Erro ao receber mensagens:`, error);
      throw error;
    }
  }

  async deleteMessage(receiptHandle: string): Promise<void> {
    const command = new DeleteMessageCommand({
      QueueUrl: this.queueUrl,
      ReceiptHandle: receiptHandle
    });

    try {
      await this.client.send(command);
      console.log(`[AWS-SQS] 🗑️  Mensagem deletada`);
    } catch (error) {
      console.error(`[AWS-SQS] ❌ Erro ao deletar mensagem:`, error);
      throw error;
    }
  }

  async purgeQueue(): Promise<void> {
    const command = new PurgeQueueCommand({
      QueueUrl: this.queueUrl
    });

    try {
      await this.client.send(command);
      console.log(`[AWS-SQS] 🧹 Fila purgada`);
    } catch (error) {
      console.error(`[AWS-SQS] ❌ Erro ao purgar fila:`, error);
      throw error;
    }
  }
}

// ============================================
// Factory: Cria o serviço apropriado
// ============================================
export function createSQSService(): ISQSService {
  const useOffline = process.env.USE_OFFLINE === 'true';

  if (useOffline) {
    console.log('🔴 Modo LOCAL: Usando fila em memória');
    return new LocalSQSService();
  } else {
    console.log('🟢 Modo AWS: Usando SQS real');
    const queueUrl = process.env.SQS_QUEUE_URL || '';
    if (!queueUrl) {
      throw new Error('SQS_QUEUE_URL não configurada. Use USE_OFFLINE=true para modo local.');
    }
    return new AWSSQSService(queueUrl);
  }
}

export { LocalSQSService, AWSSQSService };
