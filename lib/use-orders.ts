"use client";

import { supabase } from "@/lib/supabase";
import { useCallback, useEffect, useRef, useState } from "react";

export type Order = { id: string; number: string; createdAt: number; doneAt?: number };
type Row = { id: string; number: string; created_at: string; done_at: string | null };

const toOrder = (r: Row): Order => ({
  id: r.id,
  number: r.number,
  createdAt: Date.parse(r.created_at),
  doneAt: r.done_at ? Date.parse(r.done_at) : undefined,
});

export function fmt(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = String(Math.floor(total / 60)).padStart(2, "0");
  const s = String(total % 60).padStart(2, "0");
  return `${m}:${s}`;
}


export function useOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [, setTick] = useState(0);
  const [online, setOnline] = useState(true);
  const offset = useRef(0); // hora do servidor - hora deste aparelho

  const refresh = useCallback(async () => {
    const [list, srv] = await Promise.all([
      supabase.from("orders").select("*").order("created_at"),
      supabase.rpc("server_now"),
    ]);
    if (list.error || srv.error) return setOnline(false);
    offset.current = Date.parse(srv.data as string) - Date.now();
    setOrders((list.data as Row[]).map(toOrder));
    setOnline(true);
  }, []);

  useEffect(() => {
    refresh();
    const poll = setInterval(refresh, 2000);
    const clock = setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [refresh]);

  const run = async (q: PromiseLike<unknown>) => {
    await q;
    await refresh();
  };

  return {
    orders,
    online,
    now: Date.now() + offset.current,
    add: (number: string) => run(supabase.from("orders").insert({ number })),
    finish: (id: string) =>
      run(
        supabase
          .from("orders")
          .update({ done_at: new Date(Date.now() + offset.current).toISOString() })
          .eq("id", id)
      ),
    remove: (id: string) => run(supabase.from("orders").delete().eq("id", id)),
    clearDone: () => run(supabase.from("orders").delete().not("done_at", "is", null)),
  };
}