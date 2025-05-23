export interface FileInterface {
  id: number;
  name: string;
  originalName: string;
  extension: string;
  usage: string;
  userId: number;
  cvMinuteId: number | null;
  cvMinuteSectionId: number | null;

  createdAt: Date;
  updatedAt: Date;
}
