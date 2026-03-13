export interface Lesson {
  title: string;
  content: string;
  example: string;
  realWorldExample: string;
}

export interface QuizQuestion {
  id: number;
  type: "multiple-choice" | "short-answer";
  question: string;
  options?: string[];
  correctAnswer: string;
}

export interface Quiz {
  questions: QuizQuestion[];
}

export interface StudentResult {
  id?: number;
  studentName: string;
  className: string;
  score: number;
  assessment: string;
  timestamp?: string;
}
