import { CvMinuteInterface } from './role/user/cv-minute/cvMinute.interface';
import { FileInterface } from './file.interface';
import { CvThequeCritereInterface } from './role/recruiter/cvtheque/cvthequeCritere.interface';
import { CvThequeUserInterface } from './role/recruiter/cvtheque/cvthequeUser.interface';
import { CvMinuteDomainInterface } from './role/user/cv-minute/cvMinuteDomain.interface';

export interface UserInterface {
  id: number;
  name: string;
  email: string;
  acceptConditions: boolean;
  role: string;
  qualiCarriere: string;

  cvMinuteDomains?: CvMinuteDomainInterface[];
  files?: FileInterface[];
  cvMinutes?: CvMinuteInterface[];
  cvThequeCriteres?: CvThequeCritereInterface[];
  cvThequeUsers?: CvThequeUserInterface[];

  createdAt: Date;
  updatedAt: Date;
}
