import { AdviceInterface } from './advice.interface';
import { EvaluationInterface } from './evaluation.interface';
import { QualiCarriereCompetenceInteface } from '../quali-carriere/competence.interface';
import { QualiCarriereResumeInterface } from '../quali-carriere/resume.interface';

export interface SectionInfoInterface {
  id: number;
  order?: number;
  content: string;
  title?: string;
  company?: string;
  date?: string;
  contrat?: string;
  icon?: string;
  iconSize?: number;
  cvMinuteSectionId: number;

  evaluation?: EvaluationInterface;
  advices?: AdviceInterface[];
  qualiCarriereCompetences?: QualiCarriereCompetenceInteface[];
  qualiCarriereResumes?: QualiCarriereResumeInterface[];

  createdAt: Date;
  updatedAt: Date;
}
