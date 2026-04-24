/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type Difficulty = 'easy' | 'medium' | 'hard' | 'total';
export type Topic = 'dai-cuong' | 'hydrocarbon' | 'dan-xuat';

export interface Question {
  topic: Topic;
  level: Difficulty;
  question: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}

export interface PrizeLevel {
  level: number;
  amount: string;
}

export const PRIZE_LADDER_15: PrizeLevel[] = [
  { level: 1, amount: "200.000" },
  { level: 2, amount: "400.000" },
  { level: 3, amount: "600.000" },
  { level: 4, amount: "1.000.000" },
  { level: 5, amount: "2.000.000" },
  { level: 6, amount: "3.000.000" },
  { level: 7, amount: "6.000.000" },
  { level: 8, amount: "10.000.000" },
  { level: 9, amount: "14.000.000" },
  { level: 10, amount: "22.000.000" },
  { level: 11, amount: "30.000.000" },
  { level: 12, amount: "40.000.000" },
  { level: 13, amount: "60.000.000" },
  { level: 14, amount: "85.000.000" },
  { level: 15, amount: "120.000.000" },
];

export const PRIZE_LADDER_30: PrizeLevel[] = [
  { level: 1, amount: "200.000" },
  { level: 2, amount: "400.000" },
  { level: 3, amount: "600.000" },
  { level: 4, amount: "1.000.000" },
  { level: 5, amount: "2.000.000" },
  { level: 6, amount: "3.000.000" },
  { level: 7, amount: "6.000.000" },
  { level: 8, amount: "10.000.000" },
  { level: 9, amount: "14.000.000" },
  { level: 10, amount: "22.000.000" },
  { level: 11, amount: "30.000.000" },
  { level: 12, amount: "40.000.000" },
  { level: 13, amount: "60.000.000" },
  { level: 14, amount: "85.000.000" },
  { level: 15, amount: "120.000.000" },
  { level: 16, amount: "150.000.000" },
  { level: 17, amount: "180.000.000" },
  { level: 18, amount: "220.000.000" },
  { level: 19, amount: "260.000.000" },
  { level: 20, amount: "300.000.000" },
  { level: 21, amount: "350.000.000" },
  { level: 22, amount: "400.000.000" },
  { level: 23, amount: "500.000.000" },
  { level: 24, amount: "600.000.000" },
  { level: 25, amount: "700.000.000" },
  { level: 26, amount: "800.000.000" },
  { level: 27, amount: "900.000.000" },
  { level: 28, amount: "1.000.000.000" },
  { level: 29, amount: "1.200.000.000" },
  { level: 30, amount: "1.500.000.000" },
];

export type LifelineType = '50:50' | 'phone' | 'audience' | 'expert';

export interface Lifeline {
  type: LifelineType;
  label: string;
  icon: string;
}

export const LIFELINES: Lifeline[] = [
  { type: '50:50', label: '50:50', icon: '🔹' },
  { type: 'phone', label: 'Gọi người thân', icon: '📞' },
  { type: 'audience', label: 'Hỏi khán giả', icon: '👥' },
  { type: 'expert', label: 'Hỏi nhà thông thái', icon: '🧠' },
];

export const AUDIO_URLS = {
  BACKGROUND: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Placeholder, using simulated ones or finding better ones
  CORRECT: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  WRONG: 'https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3',
  SELECT: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
};

export interface GameRecord {
  id: string;
  date: string;
  playerName: string;
  playerClass: string;
  topicId: Topic;
  levelId: Difficulty;
  topic: string;
  gameMode: string;
  prizeMoney: string;
  prizeValue: number; // For sorting
  correctAnswers: string;
  correctCount: number; // For sorting
  totalQuestions: number;
  timeSpent: string;
  durationSeconds: number; // For sorting
  uid?: string; // Firebase Auth UID
  // Giữ lại các trường cũ để tương thích ngược nếu cần, 
  // nhưng khuyến khích dùng wrongQuestionDetails cho giao diện mới
  wrongQuestion: string | null;
  wrongAnswerChosen: string | null;
  correctAnswer: string | null;
  explanation: string | null;
  // Bổ sung chi tiết câu hỏi sai
  wrongQuestionDetails?: {
    question: string;
    options: [string, string, string, string];
    selectedIdx: number;
    correctIdx: number;
    explanation: string;
  } | null;
}
