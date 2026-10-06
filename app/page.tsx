"use client";

import { useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fmt, useOrders, type Order } from "@/lib/use-orders";

const MIN = 60000;

const columns = [
  { key: "green", title: "0 – 5 min", head: "bg-green-600" },
  { key: "orange", title: "5 – 10 min", head: "bg-orange-500" },
  { key: "red", title: "10+ min", head: "bg-red-600" },
  { key: "done", title: "Finalizados", head: "bg-slate-600" },
] as const;

const cardStyle = {
  green: "bg-green-500 border-green-600 text-white",
  orange: "bg-orange-500 border-orange-600 text-white",
  red: "bg-red-600 border-red-700 text-white scale-105 shadow-2xl shadow-red-500/50 animate-pulse",
  done: "bg-slate-800 border-slate-700 text-slate-200",
};

export default function Pedidos() {
  const { orders, now, online, add, finish, remove, clearDone } = useOrders();
  const [number, setNumber] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function submit() {
    const n = number.trim();
    if (!n) return;
    add(n);
    setNumber("");
    inputRef.current?.focus();
  }

  const bucket = (o: Order) => {
    if (o.doneAt) return "done";
    const e = now - o.createdAt;
    return e < 5 * MIN ? "green" : e < 10 * MIN ? "orange" : "red";
  };

  return (
    <main className="flex h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center gap-4 border-b border-slate-800 px-6 py-3">
        <div className="flex flex-1 justify-center gap-2">
          <Input
            ref={inputRef}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Número do pedido"
            inputMode="numeric"
            autoFocus
            className="h-12 max-w-xs bg-slate-900 text-center text-2xl"
          />
          <Button className="h-12 px-6 text-base" onClick={submit}>
            Adicionar
          </Button>
        </div>
        {!online && <Badge variant="destructive">Sem conexão</Badge>}
      </header>

      <div className="grid flex-1 grid-cols-4 gap-4 overflow-hidden p-4">
        {columns.map((col) => {
          const list = orders
            .filter((o) => bucket(o) === col.key)
            .sort((a, b) =>
              col.key === "done" ? b.doneAt! - a.doneAt! : a.createdAt - b.createdAt
            );

          return (
            <section key={col.key} className="flex flex-col overflow-hidden rounded-xl bg-slate-900">
              <div className={`flex items-center justify-between px-4 py-3 ${col.head}`}>
                <span className="font-semibold">{col.title}</span>
                <Badge variant="secondary">{list.length}</Badge>
                {col.key === "done" && list.length > 0 && (
                  <Button size="sm" variant="secondary" onClick={clearDone}>
                    Limpar
                  </Button>
                )}
              </div>

              <div className="grid flex-1 grid-cols-2 content-start gap-4 overflow-y-auto p-4">
                {list.map((o) => {
                  const k = bucket(o);
                  const elapsed = (o.doneAt ?? now) - o.createdAt;
                  return (
                    <Card
                      key={o.id}
                      className={`relative border-2 py-4 transition-all duration-500 ${cardStyle[k]}`}
                    >
                      {k !== "done" && (
                        <button
                          onClick={() => remove(o.id)}
                          title="Cancelar pedido (digitado errado)"
                          className="absolute right-2 top-1 text-sm opacity-60 hover:opacity-100"
                        >
                          ✕
                        </button>
                      )}
                      <CardContent className="flex flex-col items-center gap-2 px-2">
                        <span className="text-3xl font-extrabold xl:text-4xl">#{o.number}</span>
                        <span className="font-mono text-xl tabular-nums xl:text-2xl">
                          {fmt(elapsed)}
                        </span>
                        {k !== "done" && (
                          <Button
                            variant="secondary"
                            className="mt-1 w-full font-semibold"
                            onClick={() => finish(o.id)}
                          >
                            ✓ Finalizar
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
