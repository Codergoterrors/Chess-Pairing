"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useChessData } from "@/hooks/useChessData";
import { Users, Trophy, Zap, BarChart3 } from "lucide-react";

export default function HomePage() {
  const { players, tournaments, isLoaded } = useChessData();

  const activeTournaments = tournaments.filter((t) => t.status === "in-progress");
  const completedTournaments = tournaments.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      {/* Hero Section */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-4xl font-bold tracking-tight">Chess Pairing System</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Manage chess tournaments with Swiss system pairings. Register players, create tournaments, generate fair pairings, and track standings.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4" />
                Registered Players
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{players.length}</p>
              <p className="text-xs text-muted-foreground mt-1">total participants</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Trophy className="h-4 w-4" />
                Total Tournaments
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{tournaments.length}</p>
              <p className="text-xs text-muted-foreground mt-1">all time</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Zap className="h-4 w-4" />
                Active Now
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{activeTournaments.length}</p>
              <p className="text-xs text-muted-foreground mt-1">in progress</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <BarChart3 className="h-4 w-4" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{completedTournaments.length}</p>
              <p className="text-xs text-muted-foreground mt-1">tournaments</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Create Tournament Card */}
          <Card>
            <CardHeader>
              <CardTitle>Create Tournament</CardTitle>
              <CardDescription>Start a new Swiss system tournament</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/tournaments?tab=create">
                <Button className="w-full">New Tournament</Button>
              </Link>
            </CardContent>
          </Card>

          {/* Add Player Card */}
          <Card>
            <CardHeader>
              <CardTitle>Add Player</CardTitle>
              <CardDescription>Register a new player in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href="/players?tab=add">
                <Button className="w-full">New Player</Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Active Tournaments */}
        {activeTournaments.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold tracking-tight mb-6">Active Tournaments</h2>
            <div className="grid grid-cols-1 gap-4">
              {activeTournaments.slice(0, 3).map((tournament) => (
                <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
                  <Card className="hover:border-primary transition-colors cursor-pointer">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{tournament.name}</CardTitle>
                          <CardDescription>
                            Round {tournament.currentRound}/{tournament.rounds} • {tournament.players.length} players
                          </CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                          View
                        </Button>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Tournaments */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-6">All Tournaments</h2>
          {tournaments.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <p className="text-center text-muted-foreground">No tournaments yet. Create one to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {tournaments.slice(0, 5).map((tournament) => (
                <Link key={tournament.id} href={`/tournaments/${tournament.id}`}>
                  <div className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold">{tournament.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {tournament.format} • {tournament.players.length} players • {tournament.status}
                        </p>
                      </div>
                      <p className="text-sm font-medium">{new Date(tournament.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
