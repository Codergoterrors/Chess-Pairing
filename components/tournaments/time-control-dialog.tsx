"use client";

import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TimeControl, TimeControlConfig } from "@/lib/types";

interface TimeControlDialogProps {
  open: boolean;
  roundNumber: number;
  onSelect: (timeControl: TimeControl, config: Omit<TimeControlConfig, "type">) => void;
  onCancel: () => void;
}

const presetsByCategory = {
  Bullet: { label: "Bullet", minutesPerSide: 1, increment: 0, description: "1 minute per side" },
  Blitz:  { label: "Blitz",  minutesPerSide: 3, increment: 2, description: "3 minutes + 2 sec increment" },
  Rapid:  { label: "Rapid",  minutesPerSide: 10, increment: 0, description: "10 minutes per side" },
  Classical: { label: "Classical", minutesPerSide: 30, increment: 0, description: "30 minutes per side" },
};

export function TimeControlDialog({ open, roundNumber, onSelect, onCancel }: TimeControlDialogProps) {
  const [selectedTimeControl, setSelectedTimeControl] = useState<TimeControl>("Blitz");
  const [customMinutes, setCustomMinutes] = useState<number>(5);
  const [customIncrement, setCustomIncrement] = useState<number>(0);

  const previewText = useMemo(() => {
    if (selectedTimeControl === "Custom") {
      return customIncrement > 0 ? `${customMinutes}+${customIncrement}` : `${customMinutes} min`;
    }
    const preset = presetsByCategory[selectedTimeControl as keyof typeof presetsByCategory];
    return preset.increment > 0 ? `${preset.minutesPerSide}+${preset.increment}` : `${preset.minutesPerSide} min`;
  }, [selectedTimeControl, customMinutes, customIncrement]);

  const handleConfirm = () => {
    if (selectedTimeControl === "Custom") {
      // Pass the actual custom values the user typed
      onSelect("Custom", { minutesPerSide: customMinutes, increment: customIncrement });
    } else {
      const preset = presetsByCategory[selectedTimeControl as keyof typeof presetsByCategory];
      onSelect(selectedTimeControl, { minutesPerSide: preset.minutesPerSide, increment: preset.increment });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Time Control for Round {roundNumber}</DialogTitle>
          <DialogDescription>
            Choose the time control settings for this round before generating pairings.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Preset Options */}
          <div className="space-y-3">
            <Label>Quick Presets</Label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(presetsByCategory).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setSelectedTimeControl(key as TimeControl)}
                  className={`p-3 rounded-lg border-2 transition-all text-left ${
                    selectedTimeControl === key
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-semibold text-sm">{preset.label}</div>
                  <div className="text-xs text-muted-foreground">{preset.description}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Custom Time Control */}
          <div className="space-y-3 border-t pt-4">
            <Label>Custom Time Control</Label>
            <button
              onClick={() => setSelectedTimeControl("Custom")}
              className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                selectedTimeControl === "Custom"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              }`}
            >
              <div className="font-semibold text-sm">Custom</div>
              <div className="text-xs text-muted-foreground">Set your own minutes + increment</div>
            </button>

            {selectedTimeControl === "Custom" && (
              <div className="space-y-3 bg-secondary/30 p-3 rounded-lg">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="minutes" className="text-xs">Minutes per Side</Label>
                    <Input
                      id="minutes"
                      type="number"
                      min="1"
                      max="120"
                      value={customMinutes}
                      onChange={(e) => setCustomMinutes(Math.max(1, parseInt(e.target.value) || 1))}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="increment" className="text-xs">Increment (seconds)</Label>
                    <Input
                      id="increment"
                      type="number"
                      min="0"
                      max="60"
                      value={customIncrement}
                      onChange={(e) => setCustomIncrement(Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="bg-secondary/50 p-3 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Preview</p>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm px-3 py-1">
                ⏱ {previewText}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {selectedTimeControl === "Custom" ? "Custom" : presetsByCategory[selectedTimeControl as keyof typeof presetsByCategory]?.label}
              </span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm & Generate Pairings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
