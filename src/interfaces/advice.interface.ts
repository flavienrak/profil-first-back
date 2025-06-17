export interface AdviceInterface {
  id: number;
  type: string;
  content: string;
  cvMinuteId: number | null;
  cvMinuteSectionId: number | null;

  createdAt: Date;
  updatedAt: Date;
}
