export interface AdviceInterface {
  id: number;
  type: string;
  content: string;
  cvMinuteId?: number;
  sectionInfoId?: number;
  cvMinuteSectionId?: number;

  createdAt: Date;
  updatedAt: Date;
}
