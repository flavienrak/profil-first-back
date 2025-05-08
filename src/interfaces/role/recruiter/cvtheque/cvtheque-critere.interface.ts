import { CvMinuteInterface } from '../../user/cv-minute/cvMinute.interface';
import { CvThequeCompetenceInterface } from './cvtheque-competence.interface';
import { CvThequeUserInterface } from './cvtheque-user.interface';
import { CvThequeViewInterface } from './cvtheque-view.interface';

export interface CvThequeCritereInterface {
  id: number;
  position: string;
  domain: string;
  description: string;
  diplome: string;
  localisation: string;
  experience: number | null;
  distance: number;
  evaluation: number;
  saved: boolean;
  userId: number;

  cvThequeCompetences?: CvThequeCompetenceInterface[];
  cvThequeUsers?: CvThequeUserInterface[];
  cvMinutes?: CvMinuteInterface[];
  cvThequeViews?: CvThequeViewInterface[];

  createdAt: Date;
  updatedAt: Date;
}
