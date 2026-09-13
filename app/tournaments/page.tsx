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
  const { hasPermission } = useAuth();
  const { toast } = useToast();
  const [editingTournament, setEditingTournament] = useState<Tournament | null>(null);
  const [activeTab, setActiveTab] = useState<string>("list");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canManageTournaments = hasPermission("manage_tournaments");

  const handleAddTournament = async (tournament: Tournament) => {
    if (!canManageTournaments) {
      toast({
        title: "Access Denied",
        description: "Only the President & Chief Arbiter can create or edit tournaments.",
        variant: "destructive",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      if (editingTournament) {
        updateTournament({
          ...editingTournament,
          ...tournament,
          // Retain existing fields if not edited
          status: editingTournament.status,
          currentRound: editingTournament.currentRound,
        });
        toast({
          title: "Success",
          description: `${tournament.name} has been updated.`,
        });
        setEditingTournament(null);
        setActiveTab("list");
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
    if (!canManageTournaments) {
      toast({
        title: "Access Denied",
        description: "Only the President & Chief Arbiter can delete tournaments.",
        variant: "destructive",
      });
      return;
    }
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

      <Tabs value={activeTab} onValueChange={(val) => {
        setActiveTab(val);
        if (val === "list") {
          setEditingTournament(null);
        }
      }} className="w-full">
        <TabsList>
          <TabsTrigger value="list">Tournaments ({tournaments.length})</TabsTrigger>
          {canManageTournaments && (
            <TabsTrigger value="create">{editingTournament ? "Edit Tournament" : "Create Tournament"}</TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="list" className="mt-6">
          <TournamentList
            tournaments={tournaments}
            players={players}
            onEdit={canManageTournaments ? (tournament) => {
              setEditingTournament(tournament);
              setActiveTab("create");
            } : undefined}
            onDelete={canManageTournaments ? handleDeleteTournament : undefined}
            isLoading={!isLoaded}
          />
        </TabsContent>

        {canManageTournaments && (
          <TabsContent value="create" className="mt-6">
            <div className="flex justify-center">
              <TournamentForm
                key={editingTournament ? editingTournament.id : "new"}
                players={players}
                onSubmit={handleAddTournament}
                initialTournament={editingTournament || undefined}
                isSubmitting={isSubmitting}
              />
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
