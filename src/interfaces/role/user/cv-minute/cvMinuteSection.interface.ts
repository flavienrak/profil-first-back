import { AdviceInterface } from './advice.interface';
import { SectionInfoInterface } from './sectionInfo.interface';

export interface CvMinuteSectionInterface {
  id: number;
  sectionOrder?: number;
  sectionTitle?: string;
  cvMinuteId: number;
  sectionId: number;

  advices?: AdviceInterface[];
  sectionInfos?: SectionInfoInterface[];
}
