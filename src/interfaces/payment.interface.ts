import { PaymentType } from '@/types/payment.type';
import { CreditInterface } from './credit.interface';

export interface PaymentInterface {
  id: number;
  amount: number;
  currency: string;
  type: PaymentType;
  sessionId: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void	';
  expiredAt: Date;
  userId: number;

  credit?: CreditInterface;

  createdAt: Date;
  updatedAt: Date;
}
