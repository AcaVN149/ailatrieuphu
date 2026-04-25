/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameRecord } from "../types";
import { db, auth } from "../lib/firebase";
import { collection, getDocs, query, limit, where, serverTimestamp, setDoc, doc, deleteDoc } from "firebase/firestore";

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
        window.dispatchEvent(new Event('history-updated'));
      }

      // 2. Save to Firestore if user is authenticated
      if (auth.currentUser) {
        // We use setDoc with a specific ID to ensure consistency
        const docId = record.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, "records", docId), {
          ...record,
          id: docId,
          uid: auth.currentUser.uid,
          createdAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, 'create', 'records'));
        return { id: docId };
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
        const docId = record.id || `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        await setDoc(doc(db, "records", docId), {
          ...record,
          id: docId,
          uid: auth.currentUser.uid,
          createdAt: serverTimestamp()
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
      // Fetch all recent records and filter in-memory to be resilient to field name changes (topicId vs topic)
      // and to avoid composite index requirements during development.
      const q = query(
        collection(db, "records"),
        limit(300)
      );

      const querySnapshot = await getDocs(q).catch(err => handleFirestoreError(err, 'list', 'records'));
      const records: GameRecord[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        records.push({ 
          id: doc.id, // Primary ID from document
          ...data 
        } as GameRecord);
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

  clearHistory: async () => {
    const localHistory = historyService.getHistory();
    localStorage.removeItem(HISTORY_KEY);
    
    // If authenticated, we should ideally delete from cloud too if we want "no trash"
    if (auth.currentUser) {
      for (const record of localHistory) {
        if (record.uid === auth.currentUser.uid) {
          await deleteDoc(doc(db, "records", record.id)).catch(err => console.error("Cloud delete failed", err));
        }
      }
    }
    
    window.dispatchEvent(new Event('history-updated'));
  },

  deleteRecords: async (ids: string[]) => {
    const localHistory = historyService.getHistory();
    const updatedHistory = localHistory.filter(r => !ids.includes(String(r.id)));
    
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));

    // Sync with cloud
    if (auth.currentUser) {
      for (const id of ids) {
        // Find if it was a synced record
        const record = localHistory.find(r => String(r.id) === id);
        if (record && record.uid === auth.currentUser.uid) {
          await deleteDoc(doc(db, "records", id)).catch(err => console.error("Cloud delete failed", err));
        }
      }
    }

    window.dispatchEvent(new Event('history-updated'));
  },

  setHistory: (history: GameRecord[]) => {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_RECORDS)));
      window.dispatchEvent(new Event('history-updated'));
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
