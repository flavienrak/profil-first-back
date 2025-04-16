export interface SectionInfoInterface {
  id: number;
  order?: number;
  content: string;
  title?: string;
  company?: string;
  date?: string;
  contrat?: string;
  icon?: string;
  iconSize?: number;
  cvMinuteSectionId: number;

  createdAt: Date;
  updatedAt: Date;
}
