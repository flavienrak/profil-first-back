import { CvThequeCompetenceInterface } from './cvtheque-competence.interface';

export interface CvThequeCritereInterface {
  id: number;
  position: string;
  domain: string;
  description: string;
  diplome: string;
  localisation: string;
  experience?: number;
  distance?: number;
  saved: boolean;
  evaluated: boolean;
  userId: number;

  cvThequeCompetences: CvThequeCompetenceInterface[];

  createdAt: Date;
  updatedAt: Date;
}
