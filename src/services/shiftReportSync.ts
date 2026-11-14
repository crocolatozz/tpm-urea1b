import {
  collection,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  getOffsetDateStr,
  getReportedLog,
  mergeRemoteReportedLog,
  markShiftAsReportedLocal,
  type ReportedLogEntry,
  type ShiftName,
} from '../data/tpmData';

const COLLECTION_NAME = 'shift_reports';

export function subscribeToShiftReports(
  onUpdate: (mergedLog: Record<string, ReportedLogEntry>) => void
): () => void {
  // Emit local cache immediately so offline / instant load works without delay
  onUpdate(getReportedLog());

  const cutoffDateStr = getOffsetDateStr(-60);
  const q = query(collection(db, COLLECTION_NAME), where('date', '>=', cutoffDateStr));

  const unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      const remoteEntries: Record<string, ReportedLogEntry> = {};
      snapshot.forEach((docSnap) => {
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
      const merged = mergeRemoteReportedLog(remoteEntries);
      onUpdate(merged);
    },
    (error) => {
      if (error.code === 'permission-denied') {
        try {
          handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
        } catch (err) {
          console.error(err);
        }
      } else {
        console.warn('Firestore sync listener warning (falling back to local cache):', error);
      }
    }
  );

  return unsubscribe;
}

export async function publishShiftReport(
  dateStr: string,
  shift: ShiftName,
  area: string
): Promise<void> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return;
  const cleanArea = (area || '-').trim().slice(0, 120) || '-';

  // Update local cache immediately for instant UI responsiveness
  markShiftAsReportedLocal(dateStr, shift, cleanArea);

  const docId = `${dateStr}_${shift}`;
  const docRef = doc(db, COLLECTION_NAME, docId);

  try {
    await setDoc(docRef, {
      date: dateStr,
      shift,
      area: cleanArea,
      reportedAt: serverTimestamp(),
    });
  } catch (error) {
    const code = (error as { code?: string })?.code;
    if (code === 'permission-denied') {
      try {
        handleFirestoreError(error, OperationType.WRITE, `${COLLECTION_NAME}/${docId}`);
      } catch (err) {
        console.error(err);
      }
    } else {
      console.warn('Gagal sinkron ke server (tersimpan di lokal):', error);
    }
  }
}
