import crypto from 'crypto';
import { OrderChannel } from '@prisma/client';
import { prisma } from '../lib/prisma';

export class LineService {
  static validateSignature(body: Buffer, signature: string): boolean {
    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) return false;
    const digest = crypto
      .createHmac('SHA256', secret)
      .update(body)
      .digest('base64');
    return digest === signature;
  }

  static async handleEvents(events: any[]): Promise<void> {
    for (const event of events) {
      try {
        if (event.type === 'message' && event.message.type === 'image') {
          await this.handleSlipImage(event);
        }
        // Text and other message types are ignored — we never reply to the customer.
      } catch (err) {
        console.error('Line event handling error:', err);
        // Don't rethrow — one bad event must not stop processing others
      }
    }
  }

  private static async handleSlipImage(event: any): Promise<void> {
    const lineUserId: string = event.source?.userId;
    if (!lineUserId) return;

    // 1. Try to find PENDING LINE order already linked to this user (repeat customer)
    let order = await prisma.order.findFirst({
      where: { channel: OrderChannel.LINE, status: 'PENDING', lineUserId },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fallback: most recent PENDING LINE order with no lineUserId yet
    if (!order) {
      order = await prisma.order.findFirst({
        where: { channel: OrderChannel.LINE, status: 'PENDING', lineUserId: null },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (order) {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          slipReceived: true,
          slipReceivedAt: new Date(),
          lineUserId,
        },
      });
    }
    // No reply sent to customer — slip is silently recorded for the team to review.
  }
}
