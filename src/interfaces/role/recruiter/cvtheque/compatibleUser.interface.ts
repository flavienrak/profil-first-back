import { UserInterface } from '@/interfaces/user.interface';

export interface CompatibleUserInterface {
  score: number;
  user: UserInterface;
  messageContent: string;
}
