/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, RotateCcw, Volume2, VolumeX, DollarSign, CheckCircle2, XCircle, HelpingHand, List, Timer, Award, Check, Trash2, Calendar, User, BookOpen, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { PRIZE_LADDER_15, PRIZE_LADDER_30, Question, Difficulty, Topic, LIFELINES, LifelineType, GameRecord } from "./types";
import { QuizService } from "./services/quizService";
import { audioService } from "./services/audioService";
import { historyService } from "./services/historyService";
import { PhoneModal, AudienceModal, ExpertModal } from "./components/lifelines/LifelineModals";
import { formatChemicalFormula } from "./lib/utils";
import { Leaderboard } from "./components/Leaderboard";
import { auth, signInWithGoogle } from "./lib/firebase";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";

const quizService = QuizService.getInstance();

export default function App() {
  const [playerInfo, setPlayerInfo] = useState<{ name: string; grade: string } | null>(() => {
    const saved = localStorage.getItem("playerInfo");
    return saved ? JSON.parse(saved) : null;
  });
  const [user, setUser] = useState<FirebaseUser | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const [regForm, setRegForm] = useState({ name: "", grade: "" });
  const [status, setStatus] = useState<"registration" | "menu" | "history" | "leaderboard" | "loading" | "playing" | "end">(() => {
    return localStorage.getItem("playerInfo") ? "menu" : "registration";
  });

  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | null>(null);
  
  const [currentLevel, setCurrentLevel] = useState(0); 
  const [question, setQuestion] = useState<Question | null>(null);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [winnings, setWinnings] = useState("0");
  const [previousWinnings, setPreviousWinnings] = useState("0");
  const [isMuted, setIsMuted] = useState(false);
  const [usedLifelines, setUsedLifelines] = useState<LifelineType[]>([]);
  const [hiddenIndices, setHiddenIndices] = useState<number[]>([]);
  const [activeLifeline, setActiveLifeline] = useState<LifelineType | null>(null);
  const [gameTime, setGameTime] = useState(0);
  const [timeMilestones, setTimeMilestones] = useState<Record<number, string>>({});
  const ladderRef = useRef<HTMLDivElement>(null);

  const currentLadder = selectedDifficulty === 'total' ? PRIZE_LADDER_30 : PRIZE_LADDER_15;

  // Manual scroll to active prize
  const scrollToActivePrize = useCallback((level: number) => {
    setTimeout(() => {
      const item = document.getElementById(`prize-${level}`);
      if (item && ladderRef.current) {
        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    let interval: any;
    if (status === "playing" && activeLifeline === null) {
      interval = setInterval(() => setGameTime(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [status, activeLifeline]);

  const handleSignOut = async () => {
    await signOut(auth);
    localStorage.removeItem("playerInfo");
    setPlayerInfo(null);
    setStatus("registration");
  };

  const saveGameRecord = useCallback(async () => {
    if (!playerInfo || !selectedTopic || !selectedDifficulty) return;
    const topicLabel = selectedTopic === 'dai-cuong' ? 'Đại cương' : selectedTopic === 'hydrocarbon' ? 'Hydrocarbon' : 'Dẫn xuất Hydrocarbon';
    const levelLabel = selectedDifficulty === 'easy' ? 'Nhận biết' : selectedDifficulty === 'medium' ? 'Thông hiểu' : selectedDifficulty === 'hard' ? 'Vận dụng' : 'Tổng hợp';
    
    const finalWinnings = isCorrect === false ? previousWinnings : winnings;
    // Helper to parse "20.000.000" to 20000000
    const parsePrize = (val: string) => parseInt(val.replace(/\./g, ''), 10) || 0;

    const record: GameRecord = {
      id: Date.now().toString(),
      date: historyService.formatDate(new Date()),
      playerName: playerInfo.name,
      playerClass: playerInfo.grade,
      topicId: selectedTopic,
      levelId: selectedDifficulty,
      topic: topicLabel,
      gameMode: levelLabel,
      prizeMoney: finalWinnings,
      prizeValue: parsePrize(finalWinnings),
      correctAnswers: `${correctCount}/${currentLadder.length}`,
      correctCount: correctCount,
      totalQuestions: currentLadder.length,
      timeSpent: formatTime(gameTime),
      durationSeconds: gameTime,
      uid: user?.uid,
      wrongQuestion: isCorrect === false ? (question?.question || null) : "Không có",
      wrongAnswerChosen: isCorrect === false && selectedIdx !== null ? String.fromCharCode(65 + (selectedIdx ?? 0)) : "-",
      correctAnswer: isCorrect === false && question ? String.fromCharCode(65 + question.answer) : "-",
      explanation: isCorrect === false ? (question?.explanation || null) : "-",
      wrongQuestionDetails: (isCorrect === false && question && selectedIdx !== null) ? {
        question: question.question,
        options: [...question.options] as [string, string, string, string],
        selectedIdx: selectedIdx,
        correctIdx: question.answer,
        explanation: question.explanation
      } : null
    };
    await historyService.saveGameRecord(record);
  }, [playerInfo, selectedTopic, selectedDifficulty, isCorrect, previousWinnings, winnings, correctCount, currentLadder, gameTime, question, selectedIdx, user]);

  useEffect(() => {
    if (status === "end" && playerInfo) {
      saveGameRecord();
    }
  }, [status, saveGameRecord]);

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (regForm.name.trim() && regForm.grade.trim()) {
      const info = { name: regForm.name.trim(), grade: regForm.grade.trim() };
      setPlayerInfo(info);
      localStorage.setItem("playerInfo", JSON.stringify(info));
      setStatus("menu");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("playerInfo");
    setPlayerInfo(null);
    setStatus("registration");
  };

  const startNewGame = async () => {
    setStatus("loading");
    setCurrentLevel(0);
    setWinnings("0");
    setPreviousWinnings("0");
    setCorrectCount(0);
    setSelectedIdx(null);
    setIsCorrect(null);
    setUsedLifelines([]);
    setHiddenIndices([]);
    setActiveLifeline(null);
    setGameTime(0);
    setTimeMilestones({});
    
    if (!selectedTopic || !selectedDifficulty) return;
    
    setGameTime(0);
    setTimeMilestones({});
    
    quizService.resetBank();
    quizService.initSessionPool(selectedTopic, selectedDifficulty);
    await loadNextQuestion(0);
  };

  const loadNextQuestion = async (level: number) => {
    setStatus("loading");
    if (!selectedTopic || !selectedDifficulty) return;
    
    const diff = selectedDifficulty;
    let targetLevel: 'easy' | 'medium' | 'hard' | undefined = undefined;

    if (diff === 'total') {
      if (level < 10) targetLevel = 'easy';
      else if (level < 20) targetLevel = 'medium';
      else targetLevel = 'hard';
    }

    // Ensure we have enough questions in bank for the target level
    const checkDiff = targetLevel || diff;
    if (quizService.getQuestionsCount(selectedTopic, checkDiff as Difficulty) < (diff === 'total' ? 2 : 2)) {
      await quizService.generateQuestions(selectedTopic, checkDiff as Difficulty, 5);
      quizService.initSessionPool(selectedTopic, diff);
    }

    const q = quizService.getQuestion(selectedTopic, diff, targetLevel);
    setQuestion(q);
    setSelectedIdx(null);
    setIsCorrect(null);
    setHiddenIndices([]);
    setStatus("playing");
    scrollToActivePrize(level);
  };

  const handleAnswerSelect = (idx: number) => {
    if (selectedIdx !== null || status !== "playing") return;
    setSelectedIdx(idx);
    audioService.play("SELECT");

    setTimeout(() => {
      const correct = idx === question?.answer;
      setIsCorrect(correct);
      
      if (correct) {
        audioService.play("CORRECT");
        setCorrectCount(prev => prev + 1);
        const levelData = currentLadder[currentLevel];
        setWinnings(levelData.amount);
        
        if ([5, 10, 15, 20, 25, 30].includes(currentLevel + 1)) {
            setTimeMilestones(prev => ({ ...prev, [currentLevel+1]: formatTime(gameTime) }));
        }
      } else {
        audioService.play("WRONG");
      }
    }, 2000);
  };

  const nextLevel = () => {
    if (isCorrect === true) {
      if (currentLevel === currentLadder.length - 1) setStatus("end");
      else {
        setPreviousWinnings(winnings); // Current correct amount becomes previous for the next question
        setCurrentLevel(prev => prev + 1);
        loadNextQuestion(currentLevel + 1);
      }
    } else {
      setStatus("end");
    }
  };

  const handleLifeline = (type: LifelineType) => {
    if (selectedIdx !== null || usedLifelines.includes(type) || !question) return;

    if (type === '50:50') {
      audioService.play5050();
      const wrongIndices = [0, 1, 2, 3].filter(i => i !== question.answer);
      const shuffled = [...wrongIndices].sort(() => Math.random() - 0.5);
      setHiddenIndices(shuffled.slice(0, 2));
      setUsedLifelines(prev => [...prev, '50:50']);
    } else {
      setActiveLifeline(type);
    }
  };

  const toggleMute = () => {
    setIsMuted(audioService.toggleMute());
  };

  return (
    <div className="min-h-screen flex flex-col font-sans p-2 md:p-[10px_20px] max-w-[1600px] mx-auto w-full relative">
      <AnimatePresence mode="wait">
        {status === "registration" && (
          <motion.div key="registration" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex-1 flex items-center justify-center">
            <div className="registration-modal w-full max-w-md p-10 rounded-[2.5rem] shadow-2xl space-y-8 bg-slate-900/80 backdrop-blur-xl border-2 border-[#FFD700]">
              <div className="text-center space-y-2">
                 <h2 className="text-3xl font-black text-[#FFD700] uppercase italic tracking-tighter">AI LÀ TRIỆU PHÚ</h2>
                 <p className="text-blue-300 text-[10px] font-black uppercase tracking-[0.2em]">Chemistry Edition</p>
              </div>

              {/* Google Login Section */}
              <div className="space-y-4">
                <p className="text-blue-300/60 text-[9px] font-black uppercase tracking-widest text-center">
                  {user ? "Đã kết nối tài khoản" : "Kết nối để đồng bộ bảng xếp hạng"}
                </p>
                
                {!user ? (
                  <button
                    onClick={async () => {
                      try {
                        await signInWithGoogle();
                      } catch (err) {
                        alert("Lỗi đăng nhập Google. Vui lòng thử lại.");
                      }
                    }}
                    className="w-full py-4 bg-white text-gray-900 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-gray-100 transition-all border-b-4 border-gray-300 active:translate-y-1 active:border-b-0 text-sm"
                  >
                    <img src="https://www.google.com/favicon.ico" className="w-5 h-5" alt="Google" />
                    ĐĂNG NHẬP GOOGLE
                  </button>
                ) : (
                  <div className="flex items-center gap-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl overflow-hidden">
                    {user.photoURL ? (
                      <img src={user.photoURL} className="w-10 h-10 rounded-full border-2 border-blue-400 shrink-0" alt="Avatar" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-blue-400 flex items-center justify-center text-white font-black shrink-0">
                        {user.displayName?.charAt(0) || "U"}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-black text-sm truncate">{user.displayName}</p>
                      <p className="text-blue-300/60 text-[10px] truncate">{user.email}</p>
                    </div>
                    <button 
                      onClick={() => signOut(auth)}
                      className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="h-px bg-white/5" />

              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest ml-1">Họ và tên</label>
                  <input required value={regForm.name} onChange={e => setRegForm(p => ({...p, name: e.target.value}))} className="form-input w-full px-6 py-4 rounded-xl font-bold" placeholder="Nhập tên..." />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-black text-blue-400 tracking-widest ml-1">Lớp</label>
                  <input required value={regForm.grade} onChange={e => setRegForm(p => ({...p, grade: e.target.value}))} className="form-input w-full px-6 py-4 rounded-xl font-bold" placeholder="Nhập lớp..." />
                </div>
                <button type="submit" className="w-full py-5 bg-[#FFD700] hover:bg-[#FFC800] text-slate-900 font-black text-xl rounded-xl shadow-lg transition-transform active:scale-95">TIẾP TỤC</button>
              </form>
            </div>
          </motion.div>
        )}

        {status === "menu" && (
          <motion.div key="menu" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="flex-1 flex flex-col items-center justify-center space-y-12 py-12 max-w-4xl mx-auto w-full">
            <div className="text-center space-y-4 relative w-full">
              <div className="absolute top-0 right-0">
                 <button 
                  onClick={handleLogout}
                  className="px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-red-500/20 transition-all flex items-center gap-2"
                 >
                   🚪 Đổi tên
                 </button>
              </div>
              <p className="text-blue-300 uppercase font-black text-xs tracking-widest">{playerInfo?.name} — {playerInfo?.grade}</p>
              <h1 className="text-5xl md:text-8xl font-black text-[#FFD700] italic tracking-tighter drop-shadow-2xl uppercase text-center">AI LÀ TRIỆU PHÚ</h1>
              <p className="text-white/60 font-medium italic text-center">Chọn lộ trình để bắt đầu cuộc hành trình chinh phục tri thức Hóa học</p>
            </div>

            <div className="w-full space-y-12">
              {/* Step 1: Topic Selection */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FFD700] text-slate-900 flex items-center justify-center font-black">1</div>
                  <h3 className="text-xl font-black text-blue-400 uppercase tracking-widest">Chọn Chủ Đề</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { id: 'dai-cuong', label: 'Đại cương', icon: <div className="text-4xl">⚛️</div>, desc: 'Điện li, pH, Nitơ...' },
                    { id: 'hydrocarbon', label: 'Hydrocarbon', icon: <div className="text-4xl">🔥</div>, desc: 'Alkane, Arene...' },
                    { id: 'dan-xuat', label: 'Dẫn xuất', icon: <div className="text-4xl">🧪</div>, desc: 'Alcohol, Acid...' }
                  ].map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => setSelectedTopic(topic.id as Topic)}
                      className={`relative p-8 rounded-[2.5rem] border-2 transition-all text-left space-y-4 group overflow-hidden ${
                        selectedTopic === topic.id 
                        ? 'bg-blue-600/20 border-[#FFD700] shadow-[0_0_30px_rgba(255,215,0,0.2)]' 
                        : 'bg-slate-900/40 border-white/5 hover:border-white/20'
                      }`}
                    >
                      <div className={`transition-transform duration-500 ${selectedTopic === topic.id ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {topic.icon}
                      </div>
                      <div>
                        <h4 className="text-xl font-black uppercase text-white group-hover:text-[#FFD700] transition-colors">{topic.label}</h4>
                        <p className="text-xs text-white/50 leading-relaxed">{topic.desc}</p>
                      </div>
                      {selectedTopic === topic.id && (
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4 w-6 h-6 bg-[#FFD700] rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-slate-900" />
                        </motion.div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Step 2: Level Selection */}
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#FFD700] text-slate-900 flex items-center justify-center font-black">2</div>
                  <h3 className="text-xl font-black text-blue-400 uppercase tracking-widest">Chọn Mức Độ</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { id: 'easy', label: 'Nhận biết', color: 'bg-emerald-500' },
                    { id: 'medium', label: 'Thông hiểu', color: 'bg-amber-500' },
                    { id: 'hard', label: 'Vận dụng', color: 'bg-rose-500' },
                    { id: 'total', label: 'Tổng hợp', color: 'bg-indigo-500' }
                  ].map((lvl) => (
                    <button
                      key={lvl.id}
                      onClick={() => setSelectedDifficulty(lvl.id as Difficulty)}
                      className={`p-6 rounded-2xl border-2 transition-all flex items-center justify-between group ${
                        selectedDifficulty === lvl.id 
                        ? `${lvl.color}/20 border-[#FFD700]` 
                        : 'bg-slate-900/40 border-white/5 hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${lvl.color}`} />
                        <span className="font-bold text-lg whitespace-nowrap">{lvl.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-8 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                <button 
                  onClick={() => setStatus("leaderboard")}
                  className="px-8 py-5 bg-blue-600/20 hover:bg-blue-600/30 text-[#FFD700] font-black rounded-2xl text-xl flex items-center justify-center gap-3 transition-all border border-[#FFD700]/30"
                >
                  <Trophy className="w-6 h-6" /> BẢNG XẾP HẠNG
                </button>
                <button 
                  onClick={() => setStatus("history")}
                  className="px-8 py-5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl text-xl flex items-center justify-center gap-3 transition-all"
                >
                  <List className="w-6 h-6" /> LỊCH SỬ
                </button>
                <button 
                  onClick={startNewGame}
                  disabled={!selectedTopic || !selectedDifficulty}
                  className="px-12 py-5 bg-[#FFD700] hover:bg-[#FFC800] text-slate-900 font-black rounded-2xl text-2xl shadow-[0_10px_40px_rgba(255,215,0,0.3)] hover:-translate-y-1 transition-all flex items-center justify-center gap-3 disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed"
                >
                  <Award className="w-8 h-8" /> BẮT ĐẦU CHƠI
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {status === "history" && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col max-w-6xl mx-auto w-full">
                <HistoryView onBack={() => setStatus("menu")} />
            </motion.div>
        )}

        {status === "leaderboard" && (
            <motion.div key="leaderboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col max-w-7xl mx-auto w-full">
                <Leaderboard onBack={() => setStatus("menu")} />
            </motion.div>
        )}

        {(status === "loading" || status === "playing") && (
          <motion.div key="game" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col h-[calc(100vh-40px)] overflow-hidden">
            <div className="flex-1 flex flex-col md:flex-row gap-4 md:gap-6 overflow-hidden">
              {/* Left Column: Question & Answers */}
              <div className="flex-1 md:flex-[0.75] flex flex-col justify-center items-center space-y-4 md:space-y-6 overflow-y-auto px-2 scrollbar-hide py-4 order-2 md:order-1">
                {status === "loading" ? (
                  <div className="flex flex-col items-center gap-4 py-20">
                    <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
                    <p className="text-blue-300 font-black italic uppercase tracking-widest">ĐANG TẢI CÂU HỎI...</p>
                  </div>
                ) : question && (
                  <div className="w-full max-w-[800px] space-y-4 md:space-y-6 flex flex-col">
                    <div className="question-box p-5 md:p-10 min-h-[80px] md:min-h-[120px] relative rounded-[20px] md:rounded-[24px] border-2 border-[#FFD700] bg-gradient-to-b from-slate-800 to-slate-900 shadow-[0_10px_30px_rgba(0,0,0,0.7),0_0_15px_rgba(255,215,0,0.3)] text-center flex items-center justify-center shrink-0">
                      <span className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-1 md:px-6 md:py-2 bg-[#FFD700] text-slate-900 font-black rounded-full text-[10px] md:text-xs italic uppercase shadow-lg">Câu {currentLevel + 1}</span>
                      <h3 className="text-base md:text-[1.4rem] font-bold leading-relaxed" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(question.question) }} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 shrink-0">
                      {question.options.map((opt, idx) => {
                        if (hiddenIndices.includes(idx)) return <div key={idx} className="h-10 md:h-14" />;
                        const isSelected = selectedIdx === idx;
                        const isCorrectOpt = isCorrect !== null && idx === question.answer;
                        const isWrongOpt = isCorrect === false && isSelected;
                        return (
                          <button key={idx} onClick={() => handleAnswerSelect(idx)} disabled={selectedIdx !== null} className={`answer-btn p-3 md:p-4 rounded-xl md:rounded-2xl text-left flex items-center gap-3 md:gap-4 group relative overflow-hidden ${isSelected ? 'selected' : ''} ${isCorrectOpt ? 'correct' : ''} ${isWrongOpt ? 'wrong' : ''}`}>
                            <div className="w-7 h-7 md:w-10 md:h-10 bg-[#FFD700] text-slate-900 font-black rounded-full flex items-center justify-center shrink-0 text-xs md:text-sm">{String.fromCharCode(65 + idx)}</div>
                            <span className="text-xs md:text-base font-bold" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(opt) }} />
                          </button>
                        );
                      })}
                    </div>

                    {isCorrect !== null && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 px-1 md:px-2">
                        <div className="explanation-box p-3 md:p-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm">
                          <p className="text-[#FFD700] font-black uppercase text-[8px] md:text-[10px] mb-1 flex items-center gap-2">
                            <HelpingHand className="w-3 h-3" /> GIẢI THÍCH:
                          </p>
                          <div className="text-[11px] md:text-sm text-white/90 italic leading-relaxed" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(question.explanation) }} />
                        </div>
                        <div className="flex flex-col md:flex-row justify-center gap-2 md:gap-3">
                          {isCorrect ? (
                            <button onClick={nextLevel} className="w-full md:w-auto px-8 md:px-10 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl text-sm md:text-base flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95 shadow-lg">
                              {currentLevel === currentLadder.length - 1 ? "🏆 XEM KẾT QUẢ 🏆" : "CÂU TIẾP THEO ▶"}
                            </button>
                          ) : (
                            <>
                              <button onClick={() => { saveGameRecord(); startNewGame(); }} className="w-full md:w-auto px-8 md:px-10 py-3 bg-[#FFD700] text-slate-900 font-black rounded-xl text-sm md:text-base flex items-center justify-center gap-2 group transition-all hover:scale-105 active:scale-95">
                                <RotateCcw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" /> 🔄 CHƠI LẠI
                              </button>
                              <button onClick={() => { saveGameRecord(); setStatus("menu"); }} className="w-full md:w-auto px-8 md:px-10 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl text-sm md:text-base transition-all hover:scale-105 active:scale-95 border border-white/10">
                                🏠 VỀ MENU CHÍNH
                              </button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}

                    <div className="flex justify-center gap-2 md:gap-4 mt-auto pt-4 overflow-x-auto pb-2">
                      {LIFELINES.map(l => (
                        <button key={l.type} onClick={() => handleLifeline(l.type)} disabled={usedLifelines.includes(l.type) || selectedIdx !== null} className="lifeline-btn flex flex-col items-center justify-center gap-1 min-w-[70px] md:w-20 py-2 rounded-2xl disabled:opacity-20 transition-all active:scale-95 scale-90 md:scale-100">
                          <span className="text-xl md:text-2xl">{l.icon}</span>
                          <span className="text-[7px] md:text-[8px] font-black uppercase text-blue-300">{l.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Info & Prize Ladder */}
              <div className="w-full md:flex-[0.25] flex flex-col bg-slate-900/60 p-3 md:p-5 rounded-[1.5rem] md:rounded-[2.5rem] border border-white/10 overflow-hidden shadow-2xl backdrop-blur-md order-1 md:order-2 h-auto max-h-[35vh] md:max-h-none md:h-full lg:h-[calc(100vh-100px)]">
                {/* Info Bar (Horizontal Row) */}
                <div className="flex items-center justify-between gap-2 md:gap-3 mb-3 md:mb-6 p-2 md:p-4 bg-white/5 rounded-xl md:rounded-2xl border border-white/10 shrink-0 shadow-inner">
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                    <CheckCircle2 className="w-3 md:w-3.5 h-3 md:h-3.5 text-emerald-400" />
                    <span className="text-[9px] md:text-[11px] font-black text-emerald-400">{correctCount}/{currentLadder.length}</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Timer className="w-3 md:w-3.5 h-3 md:h-3.5 text-amber-400" />
                    <span className="text-[9px] md:text-[11px] font-black text-amber-400 font-mono tracking-tighter">{formatTime(gameTime)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-1 md:py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg min-w-0 flex-1 md:max-w-[45%]">
                    <BookOpen className="w-3 md:w-3.5 h-3 md:h-3.5 text-blue-400 shrink-0" />
                    <span className="text-[8px] md:text-[9px] font-black text-blue-300 uppercase truncate">
                       {selectedTopic === 'dai-cuong' ? 'Đại cương' : selectedTopic === 'hydrocarbon' ? 'Hydrocarbon' : 'Dẫn xuất Hydrocarbon'}
                    </span>
                  </div>
                </div>

                {/* Prize Ladder */}
                <div ref={ladderRef} className="flex-1 flex flex-col overflow-y-auto pr-0 md:pr-2 custom-scrollbar min-h-[50px] md:min-h-[200px]">
                  <div className="flex flex-col gap-0.5 md:gap-1 pb-2 md:pb-4 w-full">
                    {[...currentLadder].reverse().map((p, reverseIdx) => {
                      const idx = currentLadder.length - 1 - reverseIdx;
                      const lIdx = p.level - 1;
                      const state = lIdx === currentLevel ? 'active' : lIdx < currentLevel ? 'passed' : '';
                      return (
                        <div 
                          key={idx} 
                          id={`prize-${lIdx}`} 
                          className={`flex items-center justify-between px-3 md:px-4 py-1.5 md:py-2 rounded-lg md:rounded-xl text-[10px] md:text-xs font-mono border transition-all duration-300 w-full ${
                            state === 'active' 
                            ? 'bg-[#FFD700] text-slate-900 border-[#FFD700] font-black scale-[1.02] shadow-[0_0_20px_rgba(255,215,0,0.4)] z-10' 
                            : state === 'passed' 
                            ? 'text-white/20 border-transparent opacity-40' 
                            : 'text-white/60 border-white/5 hover:bg-white/5'
                          }`}
                        >
                          <span className={`${state === 'active' ? 'text-slate-900' : 'text-blue-400'} font-black w-6 text-left`}>{p.level}</span>
                          <span className="font-black tracking-tight">{p.amount} VNĐ</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Footer Action (Desktop only or very compact on mobile) */}
                <div className="mt-2 md:mt-4 pt-2 md:pt-4 border-t border-white/5 shrink-0 flex flex-row md:flex-col gap-2 items-center md:items-stretch">
                   <div className="flex flex-1 justify-between items-center px-3 md:px-4 py-1.5 md:py-2 bg-white/5 rounded-lg md:rounded-xl">
                      <span className="text-[8px] md:text-[9px] font-black text-blue-400 uppercase leading-none">💰</span>
                      <span className="text-sm md:text-lg font-black text-[#FFD700] italic leading-none">{winnings} VNĐ</span>
                   </div>
                   <button 
                      onClick={() => { saveGameRecord(); setStatus("end"); }}
                      className="px-4 md:px-0 py-2 md:py-4 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-lg md:rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-[0.98]"
                    >
                      {/* On mobile show smaller icon */}
                      <span className="md:inline hidden">⏹️ DỪNG CUỘC CHƠI & LƯU LẠI</span>
                      <span className="md:hidden inline">⏹️ DỪNG</span>
                    </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status === "end" && (
          <motion.div key="end" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex-1 flex items-center justify-center">
            <div className="bg-slate-900/60 p-12 md:p-20 rounded-[4rem] text-center space-y-12 max-w-4xl w-full border-2 border-white/10 shadow-2xl relative overflow-hidden backdrop-blur-3xl">
                <div className="space-y-4">
                    <Trophy className="w-24 h-24 text-[#FFD700] mx-auto animate-bounce" />
                    <h2 className="text-6xl md:text-8xl font-black italic tracking-tighter uppercase">KẾT THÚC</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-y border-white/10">
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-400 uppercase">TIỀN THƯỞNG</p>
                        <p className="text-4xl font-black text-[#FFD700] italic">{isCorrect === false ? previousWinnings : winnings} VNĐ</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[10px] font-black text-blue-400 uppercase">CÂU ĐÚNG</p>
                        <p className="text-4xl font-black text-white italic">{correctCount}/{currentLadder.length}</p>
                    </div>
                </div>
                <div className="flex flex-col md:flex-row gap-6 justify-center">
                    <button onClick={() => setStatus("menu")} className="px-12 py-5 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-2xl text-xl transition-all">VỀ MENU</button>
                    <button onClick={startNewGame} className="px-12 py-5 bg-[#FFD700] hover:bg-[#FFC800] text-slate-900 font-black rounded-2xl text-xl transition-all">CHƠI LẠI</button>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {activeLifeline && question && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {activeLifeline === 'phone' && <PhoneModal question={question} onClose={u => { if(u) setUsedLifelines(p => [...p, 'phone']); setActiveLifeline(null); }} />}
              {activeLifeline === 'audience' && <AudienceModal question={question} onClose={u => { if(u) setUsedLifelines(p => [...p, 'audience']); setActiveLifeline(null); }} />}
              {activeLifeline === 'expert' && <ExpertModal question={question} onClose={u => { if(u) setUsedLifelines(p => [...p, 'expert']); setActiveLifeline(null); }} />}
          </div>
      )}
      
      <footer className="mt-auto py-8 text-center space-y-2">
        <p className="text-slate-700 text-[10px] font-black tracking-[0.5em] uppercase">AI LÀ TRIỆU PHÚ — CHEMISTRY 11</p>
        <p className="text-white/60 text-[12px] font-medium">Người phát triển: Phạm Minh Hoàng và Nguyễn Trường Tân</p>
      </footer>
    </div>
  );
}

function HistoryView({ onBack }: { onBack: () => void }) {
    const [records, setRecords] = useState<GameRecord[]>([]);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [confirmDelete, setConfirmDelete] = useState<'selected' | 'all' | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        setRecords(historyService.getHistory());
    }, []);

    const handleSelectRow = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const idStr = String(id);
        setSelectedIds(prev => 
            prev.includes(idStr) ? prev.filter(i => i !== idStr) : [...prev, idStr]
        );
    };

    const handleSelectAll = () => {
        if (selectedIds.length === records.length && records.length > 0) {
            setSelectedIds([]);
        } else {
            setSelectedIds(records.map(r => String(r.id)));
        }
    };

    const executeDeleteSelected = () => {
        try {
            const updatedHistory = records.filter(r => !selectedIds.includes(String(r.id)));
            historyService.setHistory(updatedHistory);
            setRecords(updatedHistory);
            setSelectedIds([]);
            setConfirmDelete(null);
        } catch (err) {
            console.error("Error during deleteSelected:", err);
        }
    };

    const executeClearAll = () => {
        try {
            historyService.clearHistory();
            setRecords([]);
            setSelectedIds([]);
            setConfirmDelete(null);
        } catch (err) {
            console.error("Error during clearAll:", err);
        }
    };

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

        return (
        <div className="flex-1 flex flex-col space-y-8 h-full min-h-[600px] mb-20 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                   <h2 className="text-4xl md:text-6xl font-black italic text-[#FFD700] uppercase tracking-tighter">LỊCH SỬ CHƠI</h2>
                   <p className="text-blue-300 text-xs font-black uppercase tracking-[0.3em]">Hành trình chinh phục tri thức</p>
                </div>
                <div className="flex flex-wrap justify-center gap-4">
                    <button 
                        onClick={handleSelectAll}
                        className="px-6 py-4 bg-white/5 hover:bg-white/10 text-white font-black rounded-2xl text-xs transition-all border border-white/10"
                    >
                        {selectedIds.length === records.length && records.length > 0 ? 'BỎ CHỌN TẤT CẢ' : 'CHỌN TẤT CẢ'}
                    </button>
                    {records.length > 0 && (
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setConfirmDelete('selected')} 
                                disabled={selectedIds.length === 0}
                                className="px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-500 font-black rounded-2xl text-xs flex items-center gap-2 border border-red-500/20 transition-all disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" /> XÓA {selectedIds.length > 0 ? `${selectedIds.length} MỤC` : 'ĐÃ CHỌN'}
                            </button>
                            <button 
                                onClick={() => setConfirmDelete('all')}
                                className="px-6 py-4 bg-slate-800 hover:bg-slate-700 text-white/50 hover:text-white font-black rounded-2xl text-xs transition-all border border-white/5"
                            >
                                XÓA TẤT CẢ
                            </button>
                        </div>
                    )}
                    <button onClick={onBack} className="px-8 py-4 bg-[#FFD700] hover:bg-[#FFC800] text-slate-900 font-black rounded-2xl text-xs transition-all tracking-widest uppercase shadow-lg">QUAY LẠI MENU</button>
                </div>
            </div>

            <AnimatePresence>
                {confirmDelete && (
                    <motion.div 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }} 
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-6"
                    >
                        <motion.div 
                            initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                            animate={{ scale: 1, opacity: 1, y: 0 }} 
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            className="bg-slate-900 border-2 border-red-500/50 p-10 rounded-[3rem] max-w-md w-full text-center space-y-8 shadow-[0_0_50px_rgba(239,68,68,0.2)]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto">
                                <Trash2 className="w-10 h-10 text-red-500" />
                            </div>
                            <div className="space-y-2">
                                <h3 className="text-2xl font-black text-white uppercase italic">Xác nhận xóa</h3>
                                <p className="text-white/60 leading-relaxed font-medium">
                                    {confirmDelete === 'all' 
                                        ? "Bạn có chắc muốn xóa TOÀN BỘ lịch sử chơi? Hành động này không thể hoàn tác."
                                        : `Bạn có chắc muốn xóa ${selectedIds.length} mục đã chọn? Hành động này không thể hoàn tác.`
                                    }
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <button 
                                    onClick={() => setConfirmDelete(null)} 
                                    className="py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-bold uppercase tracking-widest transition-all text-xs text-white"
                                >
                                    HỦY
                                </button>
                                <button 
                                    onClick={confirmDelete === 'all' ? executeClearAll : executeDeleteSelected} 
                                    className="py-4 bg-red-600 hover:bg-red-500 text-white font-black rounded-2xl uppercase tracking-widest shadow-lg shadow-red-500/20 transition-all text-xs font-black"
                                >
                                    XÁC NHẬN XÓA
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="space-y-4">
                {records.length === 0 ? (
                    <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/5 p-32 text-center backdrop-blur-xl">
                        <div className="space-y-4 opacity-20">
                            <List className="w-16 h-16 mx-auto text-white" />
                            <p className="font-black italic uppercase text-2xl tracking-tighter text-white">Chưa có lần chơi nào. Hãy bắt đầu chinh phục ngay!</p>
                        </div>
                    </div>
                ) : (
                    records.map(r => {
                        const isExpanded = expandedId === r.id;
                        const isSelected = selectedIds.includes(String(r.id));
                        const isWin = r.correctAnswers.split('/')[0] === r.correctAnswers.split('/')[1] && r.correctAnswers.split('/')[0] !== "0";

                        return (
                            <div 
                                key={r.id} 
                                className={`relative border rounded-[1.5rem] transition-all duration-300 overflow-hidden ${
                                    isExpanded 
                                    ? 'bg-slate-900 border-[#FFD700] ring-4 ring-[#FFD700]/10 shadow-2xl' 
                                    : 'bg-white/5 border-white/10 hover:border-[#FFD700]/30 hover:bg-white/[0.08]'
                                } ${isWin ? 'border-amber-500/30 ring-1 ring-amber-500/10' : ''}`}
                            >
                                <div 
                                    className="p-6 md:p-8 cursor-pointer flex flex-col md:flex-row md:items-center gap-6"
                                    onClick={() => toggleExpand(r.id)}
                                >
                                    {/* Selection Checkbox */}
                                    <div 
                                        className="absolute top-4 right-4 md:static" 
                                        onClick={(e) => handleSelectRow(r.id, e)}
                                    >
                                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                                            isSelected 
                                            ? 'bg-[#FFD700] border-[#FFD700]' 
                                            : 'border-white/20 bg-black/20'
                                        }`}>
                                            {isSelected && <Check className="w-4 h-4 text-slate-900" />}
                                        </div>
                                    </div>

                                    {/* Main Content */}
                                    <div className="flex-1 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                                        {/* Date & Time */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-blue-400">
                                                <Calendar className="w-3 h-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Thời gian</span>
                                            </div>
                                            <p className="text-xs font-mono font-bold text-white/70">{r.date}</p>
                                            <p className="text-[10px] font-mono text-white/40">{r.timeSpent}</p>
                                        </div>

                                        {/* Player Info */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-blue-400">
                                                <User className="w-3 h-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Người chơi</span>
                                            </div>
                                            <p className="font-black text-white text-lg tracking-tight leading-none">{r.playerName}</p>
                                            <p className="text-[10px] text-blue-300 font-bold uppercase tracking-tighter opacity-60">{r.playerClass}</p>
                                        </div>

                                        {/* Topic & Level */}
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-blue-400">
                                                <BookOpen className="w-3 h-3" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Chủ đề</span>
                                            </div>
                                            <p className="text-xs font-bold text-white/80">{r.topic}</p>
                                            <span className="px-2 py-0.5 bg-white/5 rounded-md text-[8px] font-black uppercase tracking-tighter text-white/40">
                                                {r.gameMode}
                                            </span>
                                        </div>

                                        {/* Results */}
                                        <div className="text-right flex flex-col items-end">
                                            <div className="flex items-center gap-2 mb-1">
                                                {isWin && <span className="text-xl">🎉</span>}
                                                <span className="text-2xl font-black text-[#FFD700] italic drop-shadow-[0_4px_10px_rgba(255,215,0,0.3)]">
                                                    {r.prizeMoney}
                                                </span>
                                                <span className="text-[10px] font-black text-[#FFD700]/60 italic uppercase tracking-tighter">vnđ</span>
                                            </div>
                                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
                                                <span className="text-[#FFD700] text-sm">{r.correctAnswers.split('/')[0]}</span>/{r.correctAnswers.split('/')[1]} CÂU ĐÚNG
                                            </p>
                                        </div>
                                    </div>

                                    {/* Expand Indicator */}
                                    <div className="flex justify-center md:pl-4">
                                        {isExpanded ? <ChevronUp className="text-[#FFD700]" /> : <ChevronDown className="text-white/20" />}
                                    </div>
                                </div>

                                {/* Expanded Section: Wrong Question Details */}
                                <motion.div
                                    initial={false}
                                    animate={{ height: isExpanded ? 'auto' : 0, opacity: isExpanded ? 1 : 0 }}
                                    className="overflow-hidden bg-black/30 border-t border-white/5"
                                >
                                    <div className="p-8 space-y-8">
                                        {r.wrongQuestionDetails ? (
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                                    <h4 className="text-sm font-black text-red-400 uppercase tracking-widest">Chi tiết câu trả lời sai</h4>
                                                </div>
                                                
                                                <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
                                                    <p className="text-xl font-bold italic leading-relaxed text-white/90 mb-6" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(r.wrongQuestionDetails.question) }} />
                                                    
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                        {r.wrongQuestionDetails.options.map((opt, oIdx) => {
                                                            const isUserChosen = oIdx === r.wrongQuestionDetails?.selectedIdx;
                                                            const isCorrect = oIdx === r.wrongQuestionDetails?.correctIdx;
                                                            
                                                            return (
                                                                <div 
                                                                    key={oIdx} 
                                                                    className={`p-4 rounded-xl border flex items-center gap-4 transition-all ${
                                                                        isCorrect 
                                                                        ? 'bg-green-500/10 border-green-500/30' 
                                                                        : isUserChosen 
                                                                        ? 'bg-red-500/10 border-red-500/30' 
                                                                        : 'bg-black/20 border-white/5'
                                                                    }`}
                                                                >
                                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs ${
                                                                        isCorrect ? 'bg-green-500 text-white' : isUserChosen ? 'bg-red-500 text-white' : 'bg-white/10 text-white/40'
                                                                    }`}>
                                                                        {String.fromCharCode(65 + oIdx)}
                                                                    </div>
                                                                    <span className={`text-sm font-medium ${isCorrect ? 'text-green-300' : isUserChosen ? 'text-red-300' : 'text-white/50'}`} dangerouslySetInnerHTML={{ __html: formatChemicalFormula(opt) }} />
                                                                    <div className="ml-auto">
                                                                        {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                                                                        {isUserChosen && !isCorrect && <XCircle className="w-4 h-4 text-red-500" />}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>

                                                <div className="p-6 bg-blue-500/5 rounded-2xl border border-blue-500/10">
                                                    <p className="text-[#FFD700] text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
                                                        <HelpingHand className="w-3 h-3" /> GIẢI THÍCH CHI TIẾT
                                                    </p>
                                                    <p className="text-sm italic text-blue-200/70 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(r.wrongQuestionDetails.explanation) }} />
                                                </div>
                                            </div>
                                        ) : r.wrongQuestion !== "Không có" ? (
                                            /* Fallback for old records without wrongQuestionDetails */
                                            <div className="space-y-4">
                                                <div className="flex items-center gap-3">
                                                    <AlertCircle className="w-5 h-5 text-[#FFD700]/50" />
                                                    <h4 className="text-xs font-black text-white/40 uppercase tracking-widest">Dừng chân tại câu này</h4>
                                                </div>
                                                <p className="text-lg font-bold italic text-white/80" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(r.wrongQuestion || "") }} />
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-red-500/5 rounded-xl border border-red-500/10">
                                                        <p className="text-[8px] font-black text-red-400 uppercase mb-1">BẠN CHỌN</p>
                                                        <p className="text-lg font-black text-red-300">{r.wrongAnswerChosen}</p>
                                                    </div>
                                                    <div className="p-4 bg-green-500/5 rounded-xl border border-green-500/10">
                                                        <p className="text-[8px] font-black text-green-400 uppercase mb-1">ĐÁP ÁN ĐÚNG</p>
                                                        <p className="text-lg font-black text-green-300">{r.correctAnswer}</p>
                                                    </div>
                                                </div>
                                                <div className="p-4 bg-white/5 rounded-xl border border-white/5">
                                                    <p className="text-xs italic text-white/40 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatChemicalFormula(r.explanation || "") }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-center py-4 flex flex-col items-center gap-2">
                                                <div className="w-12 h-12 bg-amber-500/10 rounded-full flex items-center justify-center">
                                                    <Trophy className="text-amber-500 w-6 h-6" />
                                                </div>
                                                <p className="text-sm font-black text-amber-500 uppercase tracking-widest italic">Chúc mừng! Bạn không sai câu nào.</p>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
