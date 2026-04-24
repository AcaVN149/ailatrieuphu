/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Trophy, Clock, Target, CreditCard, ChevronLeft, Award, Star } from "lucide-react";
import { GameRecord, Topic, Difficulty } from "../types";
import { historyService } from "../services/historyService";

interface LeaderboardProps {
  onBack: () => void;
}

const TOPICS: { id: Topic; label: string }[] = [
  { id: "dai-cuong", label: "Đại cương" },
  { id: "hydrocarbon", label: "Hydrocarbon" },
  { id: "dan-xuat", label: "Dẫn xuất Hydrocarbon" },
];

const LEVELS: { id: Difficulty; label: string }[] = [
  { id: "easy", label: "Nhận biết" },
  { id: "medium", label: "Thông hiểu" },
  { id: "hard", label: "Vận dụng" },
  { id: "total", label: "Tổng hợp" },
];

export function Leaderboard({ onBack }: LeaderboardProps) {
  const [activeTopic, setActiveTopic] = useState<Topic>("dai-cuong");
  const [activeLevel, setActiveLevel] = useState<Difficulty>("easy");
  const [history, setHistory] = useState<GameRecord[]>([]);
  const [globalHistory, setGlobalHistory] = useState<GameRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setHistory(historyService.getHistory());
  }, []);

  useEffect(() => {
    const fetchGlobal = async () => {
      setLoading(true);
      const records = await historyService.getGlobalLeaderboard(activeTopic, activeLevel);
      setGlobalHistory(records);
      setLoading(false);
    };
    fetchGlobal();
  }, [activeTopic, activeLevel]);

  // Combined History (Local + Global)
  const combinedHistory = useMemo(() => {
    const map = new Map<string, GameRecord>();
    
    // Add local records first
    history.forEach(r => map.set(r.id, r));
    
    // Add global records (overwrite if ID matches, but doc IDs are different from timestamp IDs usually)
    globalHistory.forEach(r => map.set(r.id, r));
    
    return Array.from(map.values());
  }, [history, globalHistory]);

  // Filter, Group by Player (Name+Class), and Sort
  const processedRecords = useMemo(() => {
    // 1. Get current topic and level labels for fallback matching
    const currentTopicObj = TOPICS.find(t => t.id === activeTopic);
    const currentLevelObj = LEVELS.find(l => l.id === activeLevel);
    
    const topicLabel = currentTopicObj?.label;
    const levelLabel = currentLevelObj?.label;

    const relevant = combinedHistory.filter(r => {
        // Robust topic matching: by ID or by Label (including partial/alternate labels)
        const topicMatch = 
            r.topicId === activeTopic || 
            r.topic === topicLabel ||
            (activeTopic === 'dan-xuat' && (r.topic === 'Dẫn xuất' || r.topic === 'Dẫn xuất Hydrocarbon'));
            
        // Robust level matching: by ID or by Label
        const levelMatch = 
            r.levelId === activeLevel || 
            r.gameMode === levelLabel;

        return topicMatch && levelMatch;
    });

    // 2. Group by Player (Name + Class) and find BEST record for THIS specific topic/level
    const playerBestMap: Record<string, GameRecord> = {};

    relevant.forEach(record => {
        // Clean name and class for consistent lookup
        const name = (record.playerName || "Vô danh").trim();
        const grade = (record.playerClass || "Không rõ lớp").trim();
        const key = `${name.toLowerCase()}_${grade.toLowerCase()}`;
        
        const existing = playerBestMap[key];

        if (!existing) {
            playerBestMap[key] = record;
        } else {
            // Compare results: correctCount desc, durationSeconds asc
            if (record.correctCount > existing.correctCount) {
                playerBestMap[key] = record;
            } else if (record.correctCount === existing.correctCount) {
                if (record.durationSeconds < existing.durationSeconds) {
                    playerBestMap[key] = record;
                }
            }
        }
    });

    // 3. Convert back to array and sort globally for ranking
    return Object.values(playerBestMap).sort((a, b) => {
        if (b.correctCount !== a.correctCount) {
            return b.correctCount - a.correctCount;
        }
        return a.durationSeconds - b.durationSeconds;
    });
  }, [combinedHistory, activeTopic, activeLevel]);

  return (
    <div className="flex-1 flex flex-col space-y-6 md:space-y-8 h-full animate-in fade-in duration-700 pt-4 pb-20 px-4">
      {/* Header Row */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-all border border-white/10 group"
          >
            <ChevronLeft className="w-6 h-6 text-[#FFD700] group-hover:-translate-x-1 transition-transform" />
          </button>
          <div>
            <h2 className="text-4xl md:text-6xl font-black italic text-[#FFD700] uppercase tracking-tighter">BẢNG XẾP HẠNG</h2>
            <p className="text-blue-300 text-xs font-black uppercase tracking-[0.3em]">Hệ thống ghi danh hào kiệt</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3 px-6 py-3 bg-blue-600/10 border border-blue-500/20 rounded-full">
            <Star className="w-5 h-5 text-[#FFD700] fill-[#FFD700]" />
            <span className="text-xs font-black text-blue-200 uppercase tracking-widest">Thành tích tốt nhất theo người chơi</span>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col bg-slate-900/40 rounded-[2.5rem] border border-white/5 shadow-2xl backdrop-blur-xl overflow-hidden min-h-[600px]">
        {/* Topic Tabs (Horizontal) */}
        <div className="flex flex-wrap p-2 bg-black/40 border-b border-white/5">
            {TOPICS.map(topic => (
                <button
                    key={topic.id}
                    onClick={() => setActiveTopic(topic.id)}
                    className={`flex-1 py-4 px-6 text-sm font-black uppercase tracking-widest transition-all rounded-2xl ${
                        activeTopic === topic.id 
                        ? 'bg-[#FFD700] text-slate-900 shadow-[0_5px_20px_rgba(255,215,0,0.3)]' 
                        : 'text-white/40 hover:text-white/70 hover:bg-white/5'
                    }`}
                >
                    {topic.label}
                </button>
            ))}
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Level Tabs (Vertical Side on Desktop) */}
            <div className="w-full md:w-64 bg-slate-900/60 p-4 border-r border-white/5 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-y-auto custom-scrollbar">
                {LEVELS.map(level => (
                    <button
                        key={level.id}
                        onClick={() => setActiveLevel(level.id)}
                        className={`flex-1 md:flex-none p-4 rounded-xl border flex items-center justify-between transition-all group shrink-0 ${
                            activeLevel === level.id 
                            ? 'bg-blue-600/20 border-[#FFD700] text-[#FFD700]' 
                            : 'bg-black/20 border-white/5 text-white/40 hover:border-white/20'
                        }`}
                    >
                        <span className="font-black text-xs uppercase tracking-widest">{level.label}</span>
                        {activeLevel === level.id && <div className="w-1.5 h-1.5 rounded-full bg-[#FFD700] shadow-[0_0_10px_#FFD700]" />}
                    </button>
                ))}
            </div>

            {/* Records List */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-32 space-y-4">
                        <div className="w-12 h-12 border-4 border-[#FFD700] border-t-transparent rounded-full animate-spin" />
                        <p className="text-blue-300 font-black uppercase tracking-widest text-xs">Đang tải bảng xếp hạng...</p>
                    </div>
                ) : (
                    <AnimatePresence mode="wait">
                    <motion.div 
                        key={`${activeTopic}-${activeLevel}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-4"
                    >
                        {processedRecords.length > 0 ? (
                            <div className="w-full">
                                <div className="hidden md:grid grid-cols-12 px-6 py-3 text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">
                                    <div className="col-span-1">Hạng</div>
                                    <div className="col-span-5">Người chơi</div>
                                    <div className="col-span-2 text-center">Số câu đúng</div>
                                    <div className="col-span-2 text-center">Thời gian</div>
                                    <div className="col-span-2 text-right">Tiền thưởng</div>
                                </div>

                                <div className="space-y-3">
                                    {processedRecords.map((r, idx) => {
                                        const isTop3 = idx < 3;
                                        return (
                                            <div 
                                                key={r.id} 
                                                className={`grid grid-cols-1 md:grid-cols-12 items-center px-6 py-4 rounded-[1.5rem] border transition-all ${
                                                    idx === 0 
                                                    ? 'bg-[#FFD700]/10 border-[#FFD700]/30 shadow-[0_0_20px_rgba(255,215,0,0.1)]' 
                                                    : 'bg-white/5 border-white/5 hover:border-white/10'
                                                }`}
                                            >
                                                <div className="col-span-1 flex items-center md:block mb-2 md:mb-0">
                                                    <span className="md:hidden text-[10px] font-black text-blue-400 uppercase mr-3">Hạng:</span>
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${
                                                        idx === 0 ? 'bg-gradient-to-br from-yellow-300 to-yellow-600 text-slate-950 scale-110 shadow-lg' : 
                                                        idx === 1 ? 'bg-gradient-to-br from-slate-200 to-slate-400 text-slate-900 shadow-md' : 
                                                        idx === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-900 text-white shadow-md' : 'text-white/30'
                                                    }`}>
                                                        {idx + 1 === 1 ? '🥇' : idx + 1 === 2 ? '🥈' : idx + 1 === 3 ? '🥉' : idx + 1}
                                                    </div>
                                                </div>

                                                <div className="col-span-5 flex items-center md:block mb-4 md:mb-0">
                                                    <div className="flex flex-col">
                                                        <span className="font-black text-white text-lg tracking-tight truncate">{r.playerName}</span>
                                                        <span className="text-[10px] text-blue-300 font-bold uppercase tracking-widest opacity-60">{r.playerClass}</span>
                                                    </div>
                                                </div>

                                                <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center border-t border-white/5 pt-3 md:pt-0 md:border-0 mb-3 md:mb-0">
                                                    <div className="flex items-center gap-2 md:hidden">
                                                        <Target className="w-3 h-3 text-blue-400" />
                                                        <span className="text-[10px] font-black text-blue-400 uppercase">Câu đúng:</span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <span className="text-xl font-black text-[#FFD700] italic">{r.correctCount}</span>
                                                        <span className="text-xs text-white/30 font-bold">/{r.totalQuestions}</span>
                                                    </div>
                                                </div>

                                                <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-center mb-3 md:mb-0">
                                                    <div className="flex items-center gap-2 md:hidden">
                                                        <Clock className="w-3 h-3 text-blue-400" />
                                                        <span className="text-[10px] font-black text-blue-400 uppercase">Thời gian:</span>
                                                    </div>
                                                    <span className="text-sm font-mono font-bold text-white/70">{r.timeSpent}</span>
                                                </div>

                                                <div className="col-span-1 md:col-span-2 flex items-center justify-between md:justify-end">
                                                    <div className="flex items-center gap-2 md:hidden">
                                                        <CreditCard className="w-3 h-3 text-blue-400" />
                                                        <span className="text-[10px] font-black text-blue-400 uppercase">Tiền thưởng:</span>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="text-lg font-black text-[#FFD700] italic">{r.prizeMoney}</span>
                                                        <span className="text-[8px] font-black text-[#FFD700]/60 ml-1 uppercase">vnđ</span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-32 space-y-6 opacity-20">
                                <Award className="w-24 h-24 text-white" />
                                <h3 className="text-2xl font-black uppercase tracking-tighter text-white">Chưa có ai chinh phục mốc này</h3>
                                <p className="text-sm font-medium text-blue-200">Hãy là người đầu tiên ghi tên lên bảng vàng!</p>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>
                )}
            </div>
        </div>
      </div>
    </div>
  );
}
