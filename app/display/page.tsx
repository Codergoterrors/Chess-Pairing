"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Users, Calendar, ChevronRight, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface TournamentRow {
  id: string;
  name: string;
  description?: string;
  format: string;
  status: string;
  rounds: number;
  currentRound: number;
  playerCount: number;
  startDate?: number;
}

function mapTournament(r: any): TournamentRow {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    format: r.format,
    status: r.status,
    rounds: r.rounds,
    currentRound: r.current_round ?? 0,
    playerCount: (r.players ?? []).length,
    startDate: r.start_date,
  };
}

const STATUS_LABEL: Record<string, string> = {
  "planning":    "Planning",
  "in-progress": "Live",
  "completed":   "Completed",
  "upcoming":    "Upcoming",
};

export default function DisplayIndexPage() {
  const router = useRouter();
  const [tournaments, setTournaments] = useState<TournamentRow[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  const fetchTournaments = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("tournaments")
      .select("id,name,description,format,status,rounds,current_round,players,start_date")
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
    } else {
      // Sort: in-progress first, then by date desc
      const rows = (data ?? []).map(mapTournament).sort((a, b) => {
        const priority = (s: string) =>
          s === "in-progress" ? 0 : s === "upcoming" ? 1 : s === "planning" ? 2 : 3;
        return priority(a.status) - priority(b.status) || (b.startDate ?? 0) - (a.startDate ?? 0);
      });
      setTournaments(rows);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTournaments(); }, [fetchTournaments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-2">
          <Trophy className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Loading tournaments…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-10 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Unable to load tournaments</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
              <p className="font-medium">To enable public access:</p>
              <p className="text-muted-foreground">
                Run the <strong>public read SQL</strong> in your Supabase dashboard.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-10">
      {/* Header */}
      <div className="mb-8 flex items-start gap-3">
        <Monitor className="h-8 w-8 text-primary mt-1 shrink-0" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tournament Display</h1>
          <p className="text-muted-foreground mt-1">
            Select a tournament to open the live display board
          </p>
        </div>
      </div>

      {/* Tournament list */}
      {tournaments.length === 0 ? (
        <Card>
          <CardContent className="pt-12 pb-12 flex flex-col items-center gap-3 text-center">
            <Trophy className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-muted-foreground">No tournaments found.</p>
            <p className="text-xs text-muted-foreground/60">
              Make sure public read is enabled in Supabase.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <button
              key={t.id}
              onClick={() => router.push(`/display/${t.id}`)}
              className="text-left w-full group focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg"
            >
              <Card className={cn(
                "h-full transition-all duration-200 cursor-pointer",
                "group-hover:border-primary/50 group-hover:shadow-md group-hover:bg-accent/30",
                t.status === "in-progress" && "border-green-500/30",
              )}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                      {t.name}
                    </CardTitle>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 group-hover:text-primary transition-colors" />
                  </div>
                  {t.description && (
                    <CardDescription className="line-clamp-2 mt-1">{t.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge variant="secondary" className="text-xs">{t.format}</Badge>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        t.status === "in-progress" && "border-green-500/50 text-green-500 bg-green-500/5",
                        t.status === "completed"   && "border-yellow-500/40 text-yellow-500",
                        t.status === "planning"    && "text-muted-foreground",
                      )}
                    >
                      {t.status === "in-progress" && (
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 inline-block animate-pulse" />
                      )}
                      {STATUS_LABEL[t.status] ?? t.status}
                    </Badge>
                  </div>

                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      <span>{t.playerCount} players · {t.rounds} rounds</span>
                    </div>
                    {t.status === "in-progress" && t.currentRound > 0 && (
                      <div className="flex items-center gap-1.5 text-green-500 font-medium">
                        <Trophy className="h-3 w-3" />
                        <span>Round {t.currentRound} of {t.rounds} in progress</span>
                      </div>
                    )}
                    {t.startDate && (
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3" />
                        <span>
                          {new Date(t.startDate).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground/50 text-center mt-10">
        ♟ Chess Club · Chess Pairing
      </p>
    </div>
  );
}
