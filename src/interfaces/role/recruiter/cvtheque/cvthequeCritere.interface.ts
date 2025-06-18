import { CvMinuteInterface } from '../../candidat/cv-minute/cvMinute.interface';
import { CvThequeCompetenceInterface } from './cvthequeCompetence.interface';
import { CvThequeUserInterface } from './cvthequeUser.interface';
import { CvThequeViewInterface } from './cvthequeView.interface';

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
  deleted: boolean;
  userId: number;

  cvThequeCompetences?: CvThequeCompetenceInterface[];
  cvThequeUsers?: CvThequeUserInterface[];
  cvMinutes?: CvMinuteInterface[];
  cvThequeViews?: CvThequeViewInterface[];

  createdAt: Date;
  updatedAt: Date;
}
