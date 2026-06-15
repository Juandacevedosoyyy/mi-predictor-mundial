"use client";

import { useTransition, useState } from "react";
import { saveResult, clearResult } from "./actions";

interface Props {
  fixtureId: number;
  currentHome: number | null;
  currentAway: number | null;
  status: string;
}

export default function ResultForm({ fixtureId, currentHome, currentAway, status }: Props) {
  const [isPending, startTransition] = useTransition();
  const [home, setHome] = useState(currentHome?.toString() ?? "");
  const [away, setAway] = useState(currentAway?.toString() ?? "");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const isPlayed = status === "FT";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const h = parseInt(home, 10);
    const a = parseInt(away, 10);
    if (isNaN(h) || isNaN(a) || h < 0 || a < 0) {
      setError("Marcador inválido");
      return;
    }
    startTransition(async () => {
      await saveResult(fixtureId, h, a);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });
  }

  function handleClear() {
    startTransition(async () => {
      await clearResult(fixtureId);
      setHome("");
      setAway("");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        max={99}
        value={home}
        onChange={(e) => setHome(e.target.value)}
        placeholder="0"
        className="w-12 text-center bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1 text-sm font-bold focus:outline-none focus:border-[var(--accent)] transition-colors"
        disabled={isPending}
      />
      <span className="text-[var(--muted-foreground)] font-bold">–</span>
      <input
        type="number"
        min={0}
        max={99}
        value={away}
        onChange={(e) => setAway(e.target.value)}
        placeholder="0"
        className="w-12 text-center bg-[var(--muted)] border border-[var(--border)] rounded px-2 py-1 text-sm font-bold focus:outline-none focus:border-[var(--accent)] transition-colors"
        disabled={isPending}
      />

      <button
        type="submit"
        disabled={isPending || home === "" || away === ""}
        className="px-3 py-1 rounded text-xs font-medium border transition-colors disabled:opacity-40
          border-[var(--accent)] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-[var(--accent-foreground)]
          disabled:border-[var(--border)] disabled:text-[var(--muted-foreground)]"
      >
        {isPending ? "..." : saved ? "✓" : isPlayed ? "Actualizar" : "Guardar"}
      </button>

      {isPlayed && (
        <button
          type="button"
          onClick={handleClear}
          disabled={isPending}
          className="px-2 py-1 rounded text-xs text-[var(--muted-foreground)] hover:text-[var(--destructive)] transition-colors disabled:opacity-40"
          title="Borrar resultado"
        >
          ✕
        </button>
      )}

      {error && <span className="text-xs text-[var(--destructive)]">{error}</span>}
    </form>
  );
}
