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
      // Avoid duplicate local records
      if (!existingHistory.some(r => r.id === record.id)) {
        const updatedHistory = [record, ...existingHistory].slice(0, MAX_RECORDS);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
      }

      // 2. Save to Firestore if user is authenticated
      if (auth.currentUser) {
        // We use setDoc with a specific ID to prevent duplicates on cloud if synced multiple times
        // The record.id is usually Date.now().toString()
        const docId = record.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const docRef = await addDoc(collection(db, "records"), {
          ...record,
          id: docId, // Ensure it has an ID
          uid: auth.currentUser.uid,
          createdAt: Timestamp.now()
        }).catch(err => handleFirestoreError(err, 'create', 'records'));
        return docRef;
      }
    } catch (error) {
      console.error("Failed to save game record:", error);
    }
  },

  syncLocalHistory: async () => {
    if (!auth.currentUser) return;
    const localHistory = historyService.getHistory();
    // Only sync records that don't have a uid yet (locally created)
    const unsynced = localHistory.filter(r => !r.uid);
    
    if (unsynced.length === 0) return;

    console.log(`Syncing ${unsynced.length} records to cloud...`);
    for (const record of unsynced) {
      try {
        await addDoc(collection(db, "records"), {
          ...record,
          uid: auth.currentUser.uid,
          createdAt: Timestamp.now()
        });
        // Update local record to mark it as synced
        record.uid = auth.currentUser.uid;
      } catch (err) {
        console.error("Sync error for record:", record.id, err);
      }
    }
    // Save the updated local history (now with UIDs)
    historyService.setHistory(localHistory);
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
