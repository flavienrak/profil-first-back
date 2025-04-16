export interface FileInterface {
  id: number;
  name: string;
  originalName: string;
  extension: string;
  usage: string;
  userId: number;
  cvMinuteId?: number;
  sectionInfoId?: number;

  createdAt: Date;
  updatedAt: Date;
}
