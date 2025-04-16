import { EvaluationInterface } from './evaluation.interface';

export interface CvMinuteInterface {
  id: number;
  position: string;
  primaryBg: string;
  secondaryBg: string;
  tertiaryBg: string;
  userId: number;

  evaluation: EvaluationInterface;
  createdAt: Date;
  updatedAt: Date;
}
