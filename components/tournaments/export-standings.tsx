"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Player, Standing } from "@/lib/types";
import { FileDown, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportStandingsProps {
  tournament: { id: string; name: string };
  standings: Standing[];
  players: Map<string, Player>;
}

export function ExportStandings({ tournament, standings, players }: ExportStandingsProps) {
  const [isExportingPDF, setIsExportingPDF] = useState(false);
  const [isExportingPNG, setIsExportingPNG] = useState(false);
  const { toast } = useToast();

  const sortedStandings = [...standings].sort((a, b) =>
    b.score !== a.score ? b.score - a.score : b.buchholz - a.buchholz
  );

  // ── PNG: draw pixel-perfect dark-themed standings on Canvas ──────────────
  const exportToPNG = async () => {
    setIsExportingPNG(true);
    try {
      // Layout constants
      const W = 1100;
      const HEADER_H = 90;
      const COL_HEADER_H = 44;
      const ROW_H = 52;
      const FOOTER_H = 48;
      const PADDING = 32;
      const totalRows = sortedStandings.length;
      const H = HEADER_H + COL_HEADER_H + ROW_H * totalRows + FOOTER_H + 16;

      const canvas = document.createElement("canvas");
      canvas.width = W * 2;   // 2x for retina sharpness
      canvas.height = H * 2;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(2, 2);

      // ── Background ──────────────────────────────────────────────────────
      ctx.fillStyle = "#0a0a0a";
      ctx.fillRect(0, 0, W, H);

      // ── Card background ──────────────────────────────────────────────────
      roundRect(ctx, PADDING - 8, 16, W - (PADDING - 8) * 2, H - 32, 12, "#111111");

      // ── Title ────────────────────────────────────────────────────────────
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText("Tournament Standings", PADDING + 8, 52);
      ctx.fillStyle = "#6b7280";
      ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(`${totalRows} participants`, PADDING + 8, 72);

      // Tournament name right-aligned
      ctx.fillStyle = "#9ca3af";
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(tournament.name, W - PADDING - 8, 72);
      ctx.textAlign = "left";

      // ── Column header row ─────────────────────────────────────────────────
      const colHeaderY = HEADER_H;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(PADDING - 8, colHeaderY, W - (PADDING - 8) * 2, COL_HEADER_H);

      const cols = [
        { label: "Rank",     x: PADDING + 8,  w: 68,  align: "left"   },
        { label: "Player",   x: PADDING + 88, w: 190, align: "left"   },
        { label: "Roll No",  x: PADDING + 288,w: 110, align: "left"   },
        { label: "Branch",   x: PADDING + 408,w: 100, align: "left"   },
        { label: "Rating",   x: PADDING + 508,w: 80,  align: "right"  },
        { label: "Score",    x: PADDING + 598,w: 80,  align: "center" },
        { label: "W-L-D",    x: PADDING + 688,w: 130, align: "center" },
        { label: "Buchholz", x: PADDING + 828,w: 80,  align: "center" },
      ];

      ctx.fillStyle = "#6b7280";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      cols.forEach(col => {
        drawAligned(ctx, col.label, col.x, colHeaderY + 27, col.w, col.align as any);
      });

      // ── Rows ──────────────────────────────────────────────────────────────
      sortedStandings.forEach((standing, i) => {
        const player = players.get(standing.playerId);
        if (!player) return;
        const rank = i + 1;
        const rowY = HEADER_H + COL_HEADER_H + i * ROW_H;

        // Row background
        let rowBg = i % 2 === 0 ? "#111111" : "#141414";
        if (rank === 1) rowBg = "#1a1500";
        if (rank === 2) rowBg = "#131313";
        if (rank === 3) rowBg = "#140d00";
        ctx.fillStyle = rowBg;
        ctx.fillRect(PADDING - 8, rowY, W - (PADDING - 8) * 2, ROW_H);

        // Left accent bar for top 3
        if (rank <= 3) {
          ctx.fillStyle = rank === 1 ? "#eab308" : rank === 2 ? "#9ca3af" : "#b45309";
          ctx.fillRect(PADDING - 8, rowY, 4, ROW_H);
        }

        // Separator line
        ctx.fillStyle = "#1f1f1f";
        ctx.fillRect(PADDING - 8, rowY + ROW_H - 1, W - (PADDING - 8) * 2, 1);

        const textY = rowY + ROW_H / 2 + 5;

        // Rank + medal
        const medalColor = rank === 1 ? "#eab308" : rank === 2 ? "#9ca3af" : "#b45309";
        if (rank <= 3) {
          // Draw medal circle
          ctx.beginPath();
          ctx.arc(PADDING + 8 + 10, rowY + ROW_H / 2, 10, 0, Math.PI * 2);
          ctx.fillStyle = medalColor + "22";
          ctx.fill();
          ctx.strokeStyle = medalColor;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = medalColor;
          ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(rank.toString(), PADDING + 8 + 10, rowY + ROW_H / 2 + 4);
          ctx.textAlign = "left";
        } else {
          ctx.fillStyle = "#9ca3af";
          ctx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
          ctx.fillText(rank.toString(), PADDING + 14, textY);
        }

        // Player name
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 14px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(player.name, cols[1].x, textY);

        // Roll No
        ctx.fillStyle = "#9ca3af";
        ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        ctx.fillText(player.rollNo, cols[2].x, textY);

        // Branch badge
        drawBadge(ctx, player.branch || "—", cols[3].x, rowY + ROW_H / 2 - 10, 20);

        // Rating
        const ratingStr = (standing.rating && standing.rating > 0) ? standing.rating.toString() : "NR";
        ctx.fillStyle = ratingStr === "NR" ? "#6b7280" : "#e5e7eb";
        ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        drawAligned(ctx, ratingStr, cols[4].x, textY, cols[4].w, "right");

        // Score
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 18px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        drawAligned(ctx, standing.score.toFixed(1), cols[5].x, textY, cols[5].w, "center");

        // W-L-D
        const wldX = cols[6].x + cols[6].w / 2;
        const wldY = textY;
        const wStr = `${standing.wins}W`;
        const lStr = `${standing.losses}L`;
        const dStr = `${standing.draws}D`;
        ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        const wW = ctx.measureText(wStr).width;
        const slashW = ctx.measureText(" / ").width;
        const lW = ctx.measureText(lStr).width;
        const dW = ctx.measureText(dStr).width;
        const totalWLD = wW + slashW + lW + slashW + dW;
        let wx = wldX - totalWLD / 2;
        ctx.fillStyle = "#16a34a"; ctx.fillText(wStr, wx, wldY); wx += wW;
        ctx.fillStyle = "#4b5563"; ctx.fillText(" / ", wx, wldY); wx += slashW;
        ctx.fillStyle = "#dc2626"; ctx.fillText(lStr, wx, wldY); wx += lW;
        ctx.fillStyle = "#4b5563"; ctx.fillText(" / ", wx, wldY); wx += slashW;
        ctx.fillStyle = "#2563eb"; ctx.fillText(dStr, wx, wldY);

        // Buchholz
        ctx.fillStyle = "#d1d5db";
        ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
        drawAligned(ctx, standing.buchholz.toFixed(1), cols[7].x, textY, cols[7].w, "center");
      });

      // ── Footer ────────────────────────────────────────────────────────────
      const footerY = HEADER_H + COL_HEADER_H + totalRows * ROW_H + 20;
      ctx.fillStyle = "#4b5563";
      ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
      ctx.fillText(`Generated ${new Date().toLocaleString()}  •  Chess Pairing  •  Developed by Osm Omkar`, PADDING + 8, footerY);

      // ── Download ──────────────────────────────────────────────────────────
      canvas.toBlob((blob) => {
        if (!blob) { toast({ title: "Failed to export PNG" }); return; }
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${tournament.name}-standings.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "PNG downloaded!" });
      }, "image/png");

    } catch (err) {
      console.error(err);
      toast({ title: "PNG export failed", description: String(err) });
    } finally {
      setIsExportingPNG(false);
    }
  };

  // ── PDF export (unchanged) ────────────────────────────────────────────────
  const exportToPDF = async () => {
    try {
      setIsExportingPDF(true);
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF();

      doc.setFontSize(16);
      doc.text(tournament.name, 14, 20);
      doc.setFontSize(10);
      doc.text("Tournament Standings", 14, 28);

      const headers = ["Rank", "Player", "Roll No", "Branch", "Score", "W/L/D", "Buchholz"];
      const columnWidths = [10, 35, 25, 30, 15, 20, 15];
      let yPosition = 38;

      doc.setFontSize(10);
      doc.setFont(undefined as any, "bold");
      let xPosition = 14;
      headers.forEach((header, i) => {
        doc.text(header, xPosition, yPosition);
        xPosition += columnWidths[i];
      });

      yPosition += 8;
      doc.setDrawColor(200);
      doc.line(14, yPosition - 2, 196, yPosition - 2);
      doc.setFont(undefined as any, "normal");
      doc.setFontSize(9);

      sortedStandings.forEach((standing, index) => {
        const player = players.get(standing.playerId);
        if (!player) return;
        if (yPosition > 270) { doc.addPage(); yPosition = 20; }
        const rowData = [
          (index + 1).toString(), player.name, player.rollNo, player.branch,
          standing.score.toFixed(1), `${standing.wins}-${standing.losses}-${standing.draws}`,
          standing.buchholz.toFixed(1),
        ];
        xPosition = 14;
        rowData.forEach((data, i) => { doc.text(data, xPosition, yPosition); xPosition += columnWidths[i]; });
        yPosition += 6;
      });

      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(`Generated: ${new Date().toLocaleString()}`, 14, doc.internal.pageSize.height - 10);
      doc.save(`${tournament.name}-standings.pdf`);
      toast({ title: "PDF exported!" });
    } catch (error) {
      console.error(error);
      toast({ title: "PDF export failed" });
    } finally {
      setIsExportingPDF(false);
    }
  };

  return (
    <div className="flex gap-2">
      <Button variant="outline" size="sm" onClick={exportToPDF} disabled={isExportingPDF || standings.length === 0} className="gap-2">
        {isExportingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        PDF
      </Button>
      <Button variant="outline" size="sm" onClick={exportToPNG} disabled={isExportingPNG || standings.length === 0} className="gap-2">
        {isExportingPNG ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
        PNG
      </Button>
    </div>
  );
}

// ── Canvas helpers ────────────────────────────────────────────────────────────
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
  ctx.fill();
}

function drawAligned(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, align: "left" | "center" | "right") {
  if (align === "center") ctx.fillText(text, x + width / 2 - ctx.measureText(text).width / 2, y);
  else if (align === "right") ctx.fillText(text, x + width - ctx.measureText(text).width, y);
  else ctx.fillText(text, x, y);
}

function drawBadge(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number) {
  const padding = 8;
  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const tw = ctx.measureText(text).width;
  const bw = tw + padding * 2;
  roundRect(ctx, x, y, bw, h, 4, "#1f2937");
  ctx.strokeStyle = "#374151";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(x, y, bw, h, 4);
  ctx.stroke();
  ctx.fillStyle = "#d1d5db";
  ctx.fillText(text, x + padding, y + h * 0.72);
}
