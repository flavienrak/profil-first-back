export interface EvaluationInterface {
  id: number;
  initialScore: number;
  actualScore: number | null;
  content: string;
  weakContent: string | null;
  cvMinuteId: number | null;
  sectionInfoId: number | null;

  createdAt: Date;
  updatedAt: Date;
}
