"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

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
  const version = useRef(0); // sobe a cada ação do usuário; descarta consultas antigas

  const serverNow = () => Date.now() + offset.current;

  const refresh = useCallback(async () => {
    const v = version.current;
    const [list, srv] = await Promise.all([
      supabase.from("orders").select("*").order("created_at"),
      supabase.rpc("server_now"),
    ]);
    if (list.error || srv.error) return setOnline(false);
    if (v !== version.current) return; // resposta velha: ignora
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

  // Mostra a mudança na hora e confirma com o servidor em seguida
  const mutate = async (optimistic: (o: Order[]) => Order[], q: PromiseLike<unknown>) => {
    version.current++;
    setOrders(optimistic);
    await q;
    version.current++;
    await refresh();
  };

  return {
    orders,
    online,
    now: serverNow(),
    add: (number: string) => {
      const id = crypto.randomUUID();
      const createdAt = serverNow();
      return mutate(
        (o) => [...o, { id, number, createdAt }],
        supabase
          .from("orders")
          .insert({ id, number, created_at: new Date(createdAt).toISOString() })
      );
    },
    finish: (id: string) => {
      const doneAt = serverNow();
      return mutate(
        (o) => o.map((x) => (x.id === id ? { ...x, doneAt } : x)),
        supabase
          .from("orders")
          .update({ done_at: new Date(doneAt).toISOString() })
          .eq("id", id)
      );
    },
    remove: (id: string) =>
      mutate((o) => o.filter((x) => x.id !== id), supabase.from("orders").delete().eq("id", id)),
    clearDone: () =>
      mutate(
        (o) => o.filter((x) => !x.doneAt),
        supabase.from("orders").delete().not("done_at", "is", null)
      ),
  };
}