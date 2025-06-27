export interface TokenInterface {
  id: number;
  type: string;
  value: string;
  expiredAt: Date;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
