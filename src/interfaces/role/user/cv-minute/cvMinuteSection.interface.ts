import { QualiCarriereCompetenceInteface } from '../quali-carriere/qualiCarriereCompetence.interface';
import { QualiCarriereResumeInterface } from '../quali-carriere/qualiCarriereResume.interface';
import { CvMinuteAdviceInterface } from './cvMinuteAdvice.interface';
import { EvaluationInterface } from '../../../evaluation.interface';

export interface CvMinuteSectionInterface {
  id: number;
  name: string;
  order: number | null;
  content: string;
  title: string | null;
  company: string | null;
  date: string | null;
  contrat: string | null;
  icon: string | null;
  iconSize: number | null;
  cvMinuteId: number;
  editable: boolean;

  evaluation?: EvaluationInterface | null;
  advices?: CvMinuteAdviceInterface[];
  qualiCarriereCompetences?: QualiCarriereCompetenceInteface[];
  qualiCarriereResumes?: QualiCarriereResumeInterface[];

  createdAt: Date;
  updatedAt: Date;
}
