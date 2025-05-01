import { SectionInfoInterface } from './sectionInfo.interface';

export interface CvMinuteSectionInterface {
  id: number;
  sectionOrder?: number;
  sectionTitle?: string;
  cvMinuteId: number;
  sectionId: number;

  sectionInfos?: SectionInfoInterface[];
}
