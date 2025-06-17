import { CvMinuteInterface } from './role/candidat/cv-minute/cvMinute.interface';
import { FileInterface } from './file.interface';
import { CvThequeCritereInterface } from './role/recruiter/cvtheque/cvthequeCritere.interface';
import { CvThequeUserInterface } from './role/recruiter/cvtheque/cvthequeUser.interface';
import { CvMinuteDomainInterface } from './role/candidat/cv-minute/cvMinuteDomain.interface';
import { PaymentInterface } from './payment.interface';
import { UserInfosInterface } from './userInfos.interface';
import { UserActionInterface } from './userAction.interface';

export interface UserInterface {
  id: number;
  name: string;
  email: string;
  role: string;
  qualiCarriere: string;

  userInfos?: UserInfosInterface;
  files?: FileInterface[];
  cvMinutes?: CvMinuteInterface[];
  userActions?: UserActionInterface[];
  cvMinuteDomains?: CvMinuteDomainInterface[];
  cvThequeCriteres?: CvThequeCritereInterface[];
  cvThequeUsers?: CvThequeUserInterface[];
  payments?: PaymentInterface[];

  createdAt: Date;
  updatedAt: Date;
}
