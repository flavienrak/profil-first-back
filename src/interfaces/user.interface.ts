export interface UserInterface {
  id: number;
  name: string;
  email: string;
  acceptConditions: boolean;
  role: 'user' | 'recruiter' | 'admin';

  createdAt: Date;
  updatedAt: Date;
}
