export interface UserInfosInterface {
  id: number;
  mode: string;
  fontSize: number;
  isVerified: boolean;
  acceptFreeUse: boolean;
  acceptConditions: boolean;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
