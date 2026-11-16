import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  clearPendingDeleteLocal,
  getOffsetDateStr,
  getReportedLog,
  markShiftAsReportedLocal,
  mergeRemoteReportedLog,
  unmarkShiftAsReportedLocal,
  type ReportedLogEntry,
  type ShiftName,
} from '../data/tpmData';

const COLLECTION_NAME = 'shift_reports';

let firestoreWriteBlocked = false;

export interface SyncWriteResult {
  ok: boolean;
  errorMessage?: string;
}

export function setFirestoreWriteBlocked(blocked: boolean): void {
  firestoreWriteBlocked = blocked;
}

export function isFirestoreWriteBlocked(): boolean {
  return firestoreWriteBlocked;
}

function buildQueryFromCutoff() {
  const cutoffDateStr = getOffsetDateStr(-60);
  return query(collection(db, COLLECTION_NAME), where('date', '>=', cutoffDateStr));
}

function extractEntriesFromDocs(
  docs: Array<{ data: () => unknown }>
): Record<string, ReportedLogEntry> {
  const remoteEntries: Record<string, ReportedLogEntry> = {};
  docs.forEach((docSnap) => {
    const data = docSnap.data() as {
      date?: unknown;
      shift?: unknown;
      area?: unknown;
      reportedAt?: { toMillis?: () => number } | null;
    };
    if (typeof data.date === 'string' && typeof data.shift === 'string') {
      const ts =
        data.reportedAt && typeof data.reportedAt.toMillis === 'function'
          ? data.reportedAt.toMillis()
          : Date.now();
      remoteEntries[`${data.date}_${data.shift}`] = {
        area: typeof data.area === 'string' ? data.area : '-',
        ts,
      };
    }
  });
  return remoteEntries;
}

export function subscribeToShiftReports(
  onUpdate: (mergedLog: Record<string, ReportedLogEntry>) => void,
  onError?: (errorMessage: string) => void
): () => void {
  // Emit local cache immediately so offline / instant load works without delay
  onUpdate(getReportedLog());

  const q = buildQueryFromCutoff();

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const remoteEntries = extractEntriesFromDocs(snapshot.docs);
      const isAuthoritativeFromServer = !snapshot.metadata.fromCache;
      // Saat Test Mode aktif, pertahankan integritas cache lokal tanpa menimpa data uji sementara
      if (firestoreWriteBlocked) {
        return;
      }
      const merged = mergeRemoteReportedLog(remoteEntries, isAuthoritativeFromServer);
      onUpdate(merged);
    },
    (error) => {
      if (error.code === 'permission-denied') {
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
        } catch (err) {
          console.error(err);
        }
        onError?.('Akses sinkronisasi Firestore ditolak.');
      } else {
        console.warn('Firestore sync listener warning (falling back to local cache):', error);
      }
    }
  );

  return unsubscribe;
}

export async function reloadShiftReportsFromFirestore(): Promise<Record<string, ReportedLogEntry>> {
  const localFallback = getReportedLog();
  if (firestoreWriteBlocked) return localFallback;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return localFallback;
  }

  try {
    const snapshot = await getDocs(buildQueryFromCutoff());
    const remoteEntries = extractEntriesFromDocs(snapshot.docs);
    const isAuthoritativeFromServer = !snapshot.metadata.fromCache;
    return mergeRemoteReportedLog(remoteEntries, isAuthoritativeFromServer);
  } catch (error) {
    console.warn('Gagal menyegarkan data Firestore saat keluar Test Mode:', error);
    return localFallback;
  }
}

export async function publishShiftReport(
  dateStr: string,
  shift: ShiftName,
  area: string
): Promise<SyncWriteResult> {
  if (firestoreWriteBlocked) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, errorMessage: 'Format tanggal laporan tidak valid.' };
  }
  const cleanArea = (area || '-').trim().slice(0, 120) || '-';

  // Optimistic local write marked pending until Firestore confirms
  markShiftAsReportedLocal(dateStr, shift, cleanArea, true);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      errorMessage: 'Koneksi offline: status tersimpan lokal dan menunggu sinkronisasi server.',
    };
  }

  const docId = `${dateStr}_${shift}`;
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    await setDoc(docRef, {
      date: dateStr,
      shift,
      area: cleanArea,
      reportedAt: serverTimestamp(),
    });
    markShiftAsReportedLocal(dateStr, shift, cleanArea, false);
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      try {
        handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${docId}`);
      } catch (err) {
        console.error(err);
      }
      return {
        ok: false,
        errorMessage: 'Gagal sinkronisasi ke Firestore (izin ditolak). Tersimpan di lokal.',
      };
    }
    console.warn('Gagal sinkron ke server (tersimpan di lokal):', error);
    return {
      ok: false,
      errorMessage: 'Gagal sinkronisasi status laporan ke server. Data tersimpan di lokal.',
    };
  }
}

export async function unpublishShiftReport(
  dateStr: string,
  shift: ShiftName
): Promise<SyncWriteResult> {
  if (firestoreWriteBlocked) return { ok: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return { ok: false, errorMessage: 'Format tanggal laporan tidak valid.' };
  }

  // Immediately update local cache & tombstone for instant responsive UI
  unmarkShiftAsReportedLocal(dateStr, shift);

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      errorMessage: 'Koneksi offline: reset status tersimpan lokal dan menunggu koneksi.',
    };
  }

  const docId = `${dateStr}_${shift}`;
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    await deleteDoc(docRef);
    clearPendingDeleteLocal(dateStr, shift);
    return { ok: true };
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      try {
        handleFirestoreError(error, OperationType.DELETE, `${COLLECTION_NAME}/${docId}`);
      } catch (err) {
        console.error(err);
      }
      return {
        ok: false,
        errorMessage: 'Gagal mereset status di Firestore (izin ditolak).',
      };
    }
    console.warn('Gagal menghapus status di server (dihapus di lokal):', error);
    return {
      ok: false,
      errorMessage: 'Gagal mereset status laporan di server. Perubahan tersimpan di lokal.',
    };
  }
}
