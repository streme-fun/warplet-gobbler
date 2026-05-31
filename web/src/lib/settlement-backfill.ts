import { boundScanRecords } from "@/lib/settlement-cache";
import {
  mergeSettlementRecords,
  type SettlementRecord,
} from "@/lib/settlement-records";

export function mergeSettlementScanProgress(
  current: readonly SettlementRecord[],
  windowRecords: readonly SettlementRecord[],
): SettlementRecord[] {
  if (windowRecords.length === 0) return [...current];
  return boundScanRecords(
    mergeSettlementRecords([...current, ...windowRecords]),
  );
}
