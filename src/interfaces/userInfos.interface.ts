export interface UserInfosInterface {
  id: number;
  mode: string;
  fontSize: number;
  verified: boolean;
  blocked: boolean;
  acceptFreeUse: boolean;
  acceptConditions: boolean;
  deleted: boolean;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
