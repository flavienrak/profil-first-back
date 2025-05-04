import { AdviceInterface } from './advice.interface';
import { CvMinuteSectionInterface } from './cvMinuteSection.interface';
import { EvaluationInterface } from './evaluation.interface';
import { FileInterface } from '../../../file.interface';
import { CvThequeViewInterface } from '../../recruiter/cvtheque/cvtheque-view.interface';

export interface CvMinuteInterface {
  id: number;
  name: string;
  position: string;
  primaryBg: string;
  secondaryBg: string;
  tertiaryBg: string;
  userId: number;
  visible: boolean;

  files?: FileInterface[];
  advices?: AdviceInterface[];
  cvMinuteSections?: CvMinuteSectionInterface[];
  evaluation?: EvaluationInterface;
  cvThequeViews?: CvThequeViewInterface[];

  createdAt: Date;
  updatedAt: Date;
}
