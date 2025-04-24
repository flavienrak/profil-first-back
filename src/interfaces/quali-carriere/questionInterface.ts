export interface QuestionInterface {
  id: number;
  content: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface QualiCarriereQuestionInteface {
  id: number;
  order: number;
  questionId: number;
  userId: number;

  createdAt: Date;
  updatedAt: Date;
}
