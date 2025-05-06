export interface QualiCarriereChatInterface {
  id: number;
  role: 'user' | 'system';
  content: string;

  createdAt: Date;
  updatedAt: Date;
}
