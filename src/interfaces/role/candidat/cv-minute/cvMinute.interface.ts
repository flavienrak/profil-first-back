import { CvMinuteSectionInterface } from './cvMinuteSection.interface';
import { CvThequeViewInterface } from '../../recruiter/cvtheque/cvthequeView.interface';
import { CvThequeContactInterface } from '../../recruiter/cvtheque/cvthequeContact.interface';
import { EvaluationInterface } from '@/interfaces/evaluation.interface';
import { FileInterface } from '@/interfaces/file.interface';
import { UserActionInterface } from '@/interfaces/userAction.interface';
import { AdviceInterface } from '@/interfaces/advice.interface';

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
  deleted: boolean;
  userId: number;
  cvThequeCritereId: number | null;

  files?: FileInterface[];
  advices?: AdviceInterface[];
  userActions?: UserActionInterface[];
  cvMinuteSections?: CvMinuteSectionInterface[];
  evaluation?: EvaluationInterface;
  cvThequeViews?: CvThequeViewInterface[];
  cvThequeContacts?: CvThequeContactInterface[];

  createdAt: Date;
  updatedAt: Date;
}
