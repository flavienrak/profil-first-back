export interface CreditInterface {
  id: number;
  value: number;
  paymentId: number;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
