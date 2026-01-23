import { useEffect, useState } from "react";
import {
  SimulationHistoryEntry,
  getAllHistory,
  deleteHistoryEntry,
  clearAllHistory,
} from "@/lib/historyDB";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Trash2,
  Clock,
  Cpu,
  List,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useSimulatorStore } from "@/store/simulatorStore";

interface HistoryPopupProps {
  open: boolean;
  onClose: () => void;
}

export function HistoryPopup({ open, onClose }: HistoryPopupProps) {
  const [history, setHistory] = useState<SimulationHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<number | null>(null);

  const setMultiLevelConfig = useSimulatorStore((s) => s.setMultiLevelConfig);
  const setMemoryConfig = useSimulatorStore((s) => s.setMemoryConfig);
  const toggleCacheLevel = useSimulatorStore((s) => s.toggleCacheLevel);

  useEffect(() => {
    if (open) {
      loadHistory();
    }
  }, [open]);

  const loadHistory = async () => {
    setLoading(true);
    console.log("[History] Loading history...");
    try {
      const entries = await getAllHistory();
      console.log("[History] Loaded entries:", entries.length);
      setHistory(entries);
    } catch (error) {
      console.error("[History] Failed to load history:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteTargetId !== null) {
      try {
        await deleteHistoryEntry(deleteTargetId);
        await loadHistory();
      } catch (error) {
        console.error("Failed to delete history entry:", error);
      }
    }
    setDeleteConfirmOpen(false);
    setDeleteTargetId(null);
  };

  const handleClearAll = () => {
    setClearConfirmOpen(true);
  };

  const confirmClearAll = async () => {
    try {
      await clearAllHistory();
      await loadHistory();
    } catch (error) {
      console.error("Failed to clear history:", error);
    }
    setClearConfirmOpen(false);
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const loadConfiguration = (entry: SimulationHistoryEntry) => {
    try {
      // Load cache configuration
      setMultiLevelConfig({
        l1: entry.config.l1 as any,
        l2: entry.config.l2 as any,
        enabled: entry.config.enabled,
      });

      // Load cache level states
      toggleCacheLevel("l1", entry.config.enabled.l1);
      toggleCacheLevel("l2", entry.config.enabled.l2);

      onClose();
    } catch (error) {
      console.error("Failed to load configuration:", error);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4 border-b flex-shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Clock size={24} className="text-primary" />
              Simulation History
            </DialogTitle>
            <DialogDescription>
              View and manage your previous simulation runs
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-between px-6 py-3 border-b flex-shrink-0 bg-muted/30">
            <div className="text-sm text-muted-foreground">
              {history.length} {history.length === 1 ? "run" : "runs"} saved
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={loadHistory}
                className="flex items-center gap-2"
              >
                <RefreshCw size={14} />
                Refresh
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleClearAll}
                disabled={history.length === 0}
                className="flex items-center gap-2"
              >
                <Trash2 size={14} />
                Clear All
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="px-6 py-4">
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="text-muted-foreground">
                      Loading history...
                    </div>
                  </div>
                ) : history.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Clock
                      size={48}
                      className="text-muted-foreground/50 mb-4"
                    />
                    <p className="text-muted-foreground">
                      No simulation history yet
                    </p>
                    <p className="text-sm text-muted-foreground/70 mt-2">
                      Run a simulation to see it here
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-3 px-4 py-2 bg-muted/50 rounded-lg text-xs font-semibold text-muted-foreground">
                      <div className="col-span-2">Date / Config</div>
                      <div className="col-span-2">Cache Setup</div>
                      <div className="col-span-2 text-center">L1 Hit Rate</div>
                      <div className="col-span-2 text-center">L2 Hit Rate</div>
                      <div className="col-span-2 text-center">Combined</div>
                      <div className="col-span-2 text-right">Actions</div>
                    </div>

                    {/* Table Rows */}
                    {history.map((entry) => (
                      <Card
                        key={entry.id}
                        className="hover:border-primary/50 transition-colors group"
                      >
                        <div className="grid grid-cols-12 gap-3 p-4 items-center">
                          {/* Date & Info Column */}
                          <div className="col-span-2 flex flex-col gap-1.5">
                            <div className="flex items-center gap-2">
                              <Clock
                                size={12}
                                className="text-muted-foreground flex-shrink-0"
                              />
                              <span className="text-xs font-medium">
                                {formatDate(entry.timestamp)}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <List
                                size={12}
                                className="text-muted-foreground flex-shrink-0"
                              />
                              <span className="text-xs text-muted-foreground">
                                {entry.trace.length.toLocaleString()} accesses
                              </span>
                            </div>
                            <Badge
                              variant="outline"
                              className="text-[10px] w-fit"
                            >
                              {entry.config.enabled.l1 &&
                              entry.config.enabled.l2
                                ? "L1 + L2"
                                : entry.config.enabled.l1
                                  ? "L1 Only"
                                  : "L2 Only"}
                            </Badge>
                          </div>

                          {/* Cache Setup Column */}
                          <div className="col-span-2 flex flex-col gap-1.5 text-xs">
                            {entry.config.enabled.l1 && entry.config.l1 && (
                              <div className="font-mono text-[10px] bg-primary/10 px-2 py-1 rounded">
                                <div className="font-semibold text-primary">
                                  L1
                                </div>
                                <div>
                                  {formatBytes(entry.config.l1.cacheSize)}
                                </div>
                                <div className="text-muted-foreground">
                                  {entry.config.l1.blockSize}B /{" "}
                                  {entry.config.l1.associativity}-way
                                </div>
                              </div>
                            )}
                            {entry.config.enabled.l2 && entry.config.l2 && (
                              <div className="font-mono text-[10px] bg-secondary/10 px-2 py-1 rounded">
                                <div className="font-semibold text-secondary">
                                  L2
                                </div>
                                <div>
                                  {formatBytes(entry.config.l2.cacheSize)}
                                </div>
                                <div className="text-muted-foreground">
                                  {entry.config.l2.blockSize}B /{" "}
                                  {entry.config.l2.associativity}-way
                                </div>
                              </div>
                            )}
                          </div>

                          {/* L1 Hit Rate Column */}
                          <div className="col-span-2 text-center">
                            {entry.config.enabled.l1 && entry.stats.l1 ? (
                              <div className="flex flex-col gap-1">
                                <div className="text-2xl font-bold text-primary">
                                  {(entry.stats.l1.hitRate * 100).toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {entry.stats.l1.hits.toLocaleString()} /{" "}
                                  {entry.stats.l1.totalAccesses.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  WB:{" "}
                                  {entry.stats.l1.writebacks.toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>

                          {/* L2 Hit Rate Column */}
                          <div className="col-span-2 text-center">
                            {entry.config.enabled.l2 && entry.stats.l2 ? (
                              <div className="flex flex-col gap-1">
                                <div className="text-2xl font-bold text-secondary">
                                  {(entry.stats.l2.hitRate * 100).toFixed(1)}%
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  {entry.stats.l2.hits.toLocaleString()} /{" "}
                                  {entry.stats.l2.totalAccesses.toLocaleString()}
                                </div>
                                <div className="text-[10px] text-muted-foreground">
                                  WB:{" "}
                                  {entry.stats.l2.writebacks.toLocaleString()}
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                —
                              </span>
                            )}
                          </div>

                          {/* Combined Stats Column */}
                          <div className="col-span-2 text-center">
                            <div className="flex flex-col gap-1">
                              <div className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                {(entry.stats.combined.hitRate * 100).toFixed(
                                  1,
                                )}
                                %
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                {entry.stats.combined.hits.toLocaleString()} /{" "}
                                {entry.stats.combined.totalAccesses.toLocaleString()}
                              </div>
                              {entry.memoryStats &&
                                entry.memoryStats.totalAccesses > 0 && (
                                  <div className="text-[10px] text-muted-foreground mt-1">
                                    Mem:{" "}
                                    {entry.memoryStats.totalAccesses.toLocaleString()}{" "}
                                    (
                                    {entry.memoryStats.averageLatency.toFixed(
                                      0,
                                    )}
                                    c)
                                  </div>
                                )}
                            </div>
                          </div>

                          {/* Actions Column */}
                          <div className="col-span-2 flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-3"
                              onClick={(e) => {
                                e.stopPropagation();
                                loadConfiguration(entry);
                              }}
                            >
                              Load
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (entry.id) handleDelete(entry.id);
                              }}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <div className="p-4 border-t flex-shrink-0">
            <Button variant="outline" onClick={onClose} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-destructive" />
              Delete History Entry
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this simulation run from your
              history? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear All Confirmation Dialog */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle size={20} className="text-destructive" />
              Clear All History
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete all {history.length} simulation
              runs from your history? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Clear All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
