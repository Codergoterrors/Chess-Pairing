"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Player, BRANCHES } from "@/lib/types";
import { generateId } from "@/lib/utils-chess";

interface PlayerFormProps {
  onSubmit: (player: Player) => void;
  initialPlayer?: Player;
  isSubmitting?: boolean;
}

export function PlayerForm({ onSubmit, initialPlayer, isSubmitting = false }: PlayerFormProps) {
  const [name, setName] = useState(initialPlayer?.name || "");
  const [rollNo, setRollNo] = useState(initialPlayer?.rollNo || "");
  const [branch, setBranch] = useState(initialPlayer?.branch || "CSE AIML");
  const [classYear, setClassYear] = useState(initialPlayer?.class || "");
  const [isRated, setIsRated] = useState(initialPlayer?.isRated ?? false);
  const [estimatedElo, setEstimatedElo] = useState(initialPlayer?.estimatedElo?.toString() || "1200");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !rollNo.trim() || !classYear.trim()) {
      alert("Please fill in all required fields");
      return;
    }

    const player: Player = {
      id: initialPlayer?.id || generateId(),
      name: name.trim(),
      rollNo: rollNo.trim(),
      branch: branch as typeof branch,
      class: classYear.trim(),
      isRated: isRated,
      estimatedElo: isRated ? Math.max(600, Math.min(3000, parseInt(estimatedElo) || 1200)) : undefined,
      gamesPlayed: initialPlayer?.gamesPlayed || 0,
      wins: initialPlayer?.wins || 0,
      losses: initialPlayer?.losses || 0,
      draws: initialPlayer?.draws || 0,
      createdAt: initialPlayer?.createdAt || Date.now(),
    };

    onSubmit(player);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>{initialPlayer ? "Edit Player" : "Add New Player"}</CardTitle>
        <CardDescription>Enter player details to register for the tournament</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Full Name *</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Roll Number */}
            <div className="space-y-2">
              <Label htmlFor="rollNo">Roll Number *</Label>
              <Input
                id="rollNo"
                placeholder="23CS001"
                value={rollNo}
                onChange={(e) => setRollNo(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <Label htmlFor="branch">Branch *</Label>
              <Select value={branch} onValueChange={setBranch} disabled={isSubmitting}>
                <SelectTrigger id="branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BRANCHES.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Class */}
            <div className="space-y-2">
              <Label htmlFor="class">Class/Year *</Label>
              <Input
                id="class"
                placeholder="SY-C or TY-B"
                value={classYear}
                onChange={(e) => setClassYear(e.target.value)}
                disabled={isSubmitting}
                required
              />
            </div>

            {/* Is Rated Checkbox */}
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRated"
                  checked={isRated}
                  onCheckedChange={(checked) => setIsRated(checked as boolean)}
                  disabled={isSubmitting}
                />
                <Label htmlFor="isRated" className="font-normal cursor-pointer">
                  Player has a chess rating
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">Check if player has an official Elo rating</p>
            </div>

            {/* Estimated Elo */}
            {isRated && (
              <div className="space-y-2">
                <Label htmlFor="elo">Estimated Elo Rating *</Label>
                <Input
                  id="elo"
                  type="number"
                  min="600"
                  max="3000"
                  placeholder="1200"
                  value={estimatedElo}
                  onChange={(e) => setEstimatedElo(e.target.value)}
                  disabled={isSubmitting}
                  required={isRated}
                />
                <p className="text-xs text-muted-foreground">Range: 600 (Beginner) - 3000 (Expert)</p>
              </div>
            )}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? "Saving..." : initialPlayer ? "Update Player" : "Add Player"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
