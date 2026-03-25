"use client";

import { useState } from "react";
import { useChessData } from "@/hooks/useChessData";
import { Tournament } from "@/lib/types";
import { TournamentForm } from "@/components/tournaments/tournament-form";
import { TournamentList } from "@/components/tournaments/tournament-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function TournamentsPage() {
  const { players, tournaments, isLoaded, addTournament, updateTournament, deleteTournament } = useChessData();
  const { toast } = useToast();
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddTournament = async (tournament: Tournament) => {
    setIsSubmitting(true);
    try {
      if (editingTournament) {
        updateTournament(tournament);
        toast({
          title: "Success",
          description: `${tournament.name} has been updated.`,
        });
        setEditingTournament(null);
      } else {
        addTournament(tournament);
        toast({
          title: "Success",
          description: `${tournament.name} has been created.`,
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTournament = (id: string) => {
    deleteTournament(id);
    toast({
      title: "Success",
      description: "Tournament has been deleted.",
    });
  };

  if (!isLoaded) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Tournaments</h1>
        <p className="text-muted-foreground mt-2">Manage chess tournaments and pairings</p>
      </div>

      <Tabs defaultValue="list" className="w-full">
        <TabsList>
          <TabsTrigger value="list">Tournaments ({tournaments.length})</TabsTrigger>
          <TabsTrigger value="create">{editingTournament ? "Edit Tournament" : "Create Tournament"}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <TournamentList
            tournaments={tournaments}
            players={players}
            onEdit={(tournament) => {
              setEditingTournament(tournament);
            }}
            onDelete={handleDeleteTournament}
            isLoading={!isLoaded}
          />
        </TabsContent>

        <TabsContent value="create" className="mt-6">
          <div className="flex justify-center">
            <TournamentForm
              players={players}
              onSubmit={handleAddTournament}
              initialTournament={editingTournament || undefined}
              isSubmitting={isSubmitting}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
