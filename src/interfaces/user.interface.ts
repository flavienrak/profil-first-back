import { CvMinuteInterface } from './role/user/cv-minute/cvMinute.interface';
import { FileInterface } from './file.interface';
import { CvThequeCritereInterface } from './role/recruiter/cvtheque/cvtheque-critere.interface';
import { CvThequeUserInterface } from './role/recruiter/cvtheque/cvtheque-user.interface';
import { CvMinuteDomainInterface } from './role/user/cv-minute/cv-minute-domain.interface';

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
