export interface UserActionInterface {
  id: number;
  type: string;
  value: string;
  cvMinuteId: number;
  cvMinuteSectionId: number;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
