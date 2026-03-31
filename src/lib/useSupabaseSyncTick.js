import { useEffect, useState } from "react";
import { onSupabaseDataChanged, subscribeToSupabaseChanges } from "./supabaseStore.js";

let realtimeStarted = false;

export function useSupabaseSyncTick() {
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!realtimeStarted) {
      realtimeStarted = true;
      subscribeToSupabaseChanges();
    }
    const unsub = onSupabaseDataChanged(() => setTick((n) => n + 1));
    return unsub;
  }, []);
}

