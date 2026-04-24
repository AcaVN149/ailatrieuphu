/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameRecord } from "../types";
import { db, auth } from "../lib/firebase";
import { collection, addDoc, getDocs, query, orderBy, limit, where, Timestamp } from "firebase/firestore";

const HISTORY_KEY = "millionaire_history";
const MAX_RECORDS = 5000; // Large limit for "unlimited" feel

interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: {
    userId: string;
    email: string;
    emailVerified: boolean;
    isAnonymous: boolean;
    providerInfo: { providerId: string; displayName: string; email: string; }[];
  }
}

const handleFirestoreError = (error: any, operation: FirestoreErrorInfo['operationType'], path: string | null) => {
  const user = auth.currentUser;
  const errorInfo: FirestoreErrorInfo = {
    error: error.message || String(error),
    operationType: operation,
    path: path,
    authInfo: {
      userId: user?.uid || 'unauthenticated',
      email: user?.email || '',
      emailVerified: user?.emailVerified || false,
      isAnonymous: user?.isAnonymous || false,
      providerInfo: user?.providerData.map(p => ({
        providerId: p.providerId,
        displayName: p.displayName || '',
        email: p.email || ''
      })) || []
    }
  };
  
  if (error.code === 'permission-denied') {
    throw new Error(JSON.stringify(errorInfo));
  }
  console.error(`Firestore Error [${operation}]:`, error);
  throw error;
};

export const historyService = {
  saveGameRecord: async (record: GameRecord) => {
    try {
      // 1. Save locally
      const existingHistory = historyService.getHistory();
      const updatedHistory = [record, ...existingHistory].slice(0, MAX_RECORDS);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

      // 2. Save to Firestore if user is authenticated
      if (auth.currentUser) {
        const docRef = await addDoc(collection(db, "records"), {
          ...record,
          uid: auth.currentUser.uid,
          createdAt: Timestamp.now()
        }).catch(err => handleFirestoreError(err, 'create', 'records'));
        return docRef;
      }
    } catch (error) {
      console.error("Failed to save game record:", error);
    }
  },

  getGlobalLeaderboard: async (topicId: string, levelId: string): Promise<GameRecord[]> => {
    try {
      const q = query(
        collection(db, "records"),
        where("topicId", "==", topicId),
        where("levelId", "==", levelId),
        orderBy("correctCount", "desc"),
        orderBy("durationSeconds", "asc"),
        limit(50)
      );

      const querySnapshot = await getDocs(q).catch(err => handleFirestoreError(err, 'list', 'records'));
      const records: GameRecord[] = [];
      querySnapshot.forEach((doc) => {
        records.push({ id: doc.id, ...doc.data() } as GameRecord);
      });

      return records;
    } catch (error) {
      console.error("Failed to fetch global leaderboard:", error);
      return [];
    }
  },

  getHistory: (): GameRecord[] => {
    try {
      const data = localStorage.getItem(HISTORY_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error("Failed to load history:", error);
      return [];
    }
  },

  clearHistory: () => {
    localStorage.removeItem(HISTORY_KEY);
  },

  setHistory: (history: GameRecord[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_RECORDS)));
    } catch (error) {
      console.error("Failed to update history:", error);
    }
  },

  formatDate: (date: Date): string => {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return `${d}/${m}/${y} ${h}:${min}`;
  },

  formatDuration: (seconds: number): string => {
    const min = Math.floor(seconds / 60).toString().padStart(2, '0');
    const sec = (seconds % 60).toString().padStart(2, '0');
    return `${min}:${sec}`;
  }
};
