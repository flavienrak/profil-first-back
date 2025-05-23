export interface EvaluationInterface {
  id: number;
  initialScore: number;
  actualScore: number | null;
  content: string;
  weakContent: string | null;
  cvMinuteId: number | null;
  cvMinuteSectionId: number | null;

  createdAt: Date;
  updatedAt: Date;
}
