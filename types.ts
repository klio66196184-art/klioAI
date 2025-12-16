
export interface StudentData {
  id: string;
  grade: string;
  studentId: string;
  name: string;
  gender: 'M' | 'F' | string;
  age: number;
  height: number; // cm
  weight: number; // kg
  bmi: number;
  handgrip?: number; // 手握力 (kg)
  sitAndReach?: number; // 坐位體前屈 (cm)
  standingLongJump?: number; // 立定跳遠 (cm)
  shuttleRun?: number; // 15米折返跑 (次數)
}

export interface AnalysisResult {
  studentId: string;
  summary: string;
  bmiCategory: string;
  fitnessLevel: string;
  comparisonMacau: string;
  comparisonChina: string;
  rankingScore: number; // 0-100
  exerciseSuggestions: string[];
  nutritionSuggestions: string[];
  strengths: string[];
  weaknesses: string[];
}

export interface AppState {
  students: StudentData[];
  reports: Record<string, AnalysisResult>;
  isAnalyzing: boolean;
  selectedStudentId: string | null;
}
