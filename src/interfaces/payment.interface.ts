export type PaymentType = 'premium' | 'booster' | 'quali-carriere';

export interface PaymentInterface {
  id: number;
  amount: number;
  currency: string;
  type: PaymentType;
  sessionId: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void	';
  expiredAt: Date;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
