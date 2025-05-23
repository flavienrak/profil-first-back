import { CvThequeContactViewInterface } from './cvthequeContactView.interface';

export interface CvThequeContactInterface {
  id: number;
  type: 'video' | 'visio';
  date: Date;
  hour: number;
  minute: number;
  message: string;
  status: 'sent' | 'viewed' | 'rejected' | 'accepted';
  userId: number;
  recruiterId: number;
  cvThequeCritereId: number;
  cvMinuteId: number;

  createdAt: Date;
  updatedAt: Date;

  cvThequeContactViews?: CvThequeContactViewInterface[];
}
