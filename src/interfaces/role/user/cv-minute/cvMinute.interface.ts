import { AdviceInterface } from './advice.interface';
import { CvMinuteSectionInterface } from './cvMinuteSection.interface';
import { EvaluationInterface } from './evaluation.interface';
import { FileInterface } from '../../../file.interface';
import { CvThequeViewInterface } from '../../recruiter/cvtheque/cvtheque-view.interface';
import { CvThequeContactInterface } from '../../recruiter/cvtheque/cvtheque-contact.interface';

export interface CvMinuteInterface {
  id: number;
  name: string;
  position: string;
  primaryBg: string;
  secondaryBg: string;
  tertiaryBg: string;
  visible: boolean;
  qualiCarriereRef: boolean;
  generated: string | null;
  score: number | null;
  userId: number;
  cvThequeCritereId: number | null;

  files?: FileInterface[];
  advices?: AdviceInterface[];
  cvMinuteSections?: CvMinuteSectionInterface[];
  evaluation?: EvaluationInterface;
  cvThequeViews?: CvThequeViewInterface[];
  cvThequeContacts?: CvThequeContactInterface[];

  createdAt: Date;
  updatedAt: Date;
}
