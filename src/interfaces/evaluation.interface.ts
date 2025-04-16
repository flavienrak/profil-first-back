export interface EvaluationInterface {
  id: number;
  initialScore: number;
  actualScore?: number;
  content: string;
  weakContent?: string;
  cvMinuteId?: number;
  sectionInfoId?: number;

  createdAt: Date;
  updatedAt: Date;
}
