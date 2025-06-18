import { QualiCarriereCompetenceInteface } from '../quali-carriere/qualiCarriereCompetence.interface';
import { QualiCarriereResumeInterface } from '../quali-carriere/qualiCarriereResume.interface';
import { EvaluationInterface } from '@/interfaces/evaluation.interface';
import { UserActionInterface } from '@/interfaces/userAction.interface';
import { AdviceInterface } from '@/interfaces/advice.interface';

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
  restricted: boolean;
  deleted: boolean;
  editable: boolean;
  cvMinuteId: number;

  evaluation?: EvaluationInterface | null;
  userActions?: UserActionInterface[];
  advices?: AdviceInterface[];
  qualiCarriereCompetences?: QualiCarriereCompetenceInteface[];
  qualiCarriereResumes?: QualiCarriereResumeInterface[];

  createdAt: Date;
  updatedAt: Date;
}
