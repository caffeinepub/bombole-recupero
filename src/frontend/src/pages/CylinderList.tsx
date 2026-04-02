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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuery } from "@tanstack/react-query";
import {
  FileDown,
  HardDriveDownload,
  Loader2,
  Package,
  Plus,
  Trash2,
  Upload,
  Warehouse,
  Wind,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import type { GasRecovery } from "../backend.d";
import { useActor } from "../hooks/useActor";
import {
  useBackupRestore,
  useCreateCylinder,
  useDeleteCylinder,
  useGetAllAssignments,
  useGetAllCylinders,
} from "../hooks/useQueries";

interface Props {
  onSelectCylinder: (code: string) => void;
}

export default function CylinderList({ onSelectCylinder }: Props) {
  const { data: cylinders = [], isLoading } = useGetAllCylinders();
  const { data: assignments = {} } = useGetAllAssignments();
  const createCylinder = useCreateCylinder();
  const deleteCylinder = useDeleteCylinder();
  const { actor, isFetching } = useActor();
  const { exportBackup, restoreBackup } = useBackupRestore();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ code: "", capacityKg: "", tareKg: "" });
  const [pendingRestore, setPendingRestore] = useState<object[] | null>(null);
  const [showDeleteList, setShowDeleteList] = useState(false);
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(
    null,
  );
  const [activeFilter, setActiveFilter] = useState<string>("tutti");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load gas types for all cylinders in parallel
  const { data: gasMap = {} } = useQuery<Record<string, string[]>>({
    queryKey: ["all-gas-types", cylinders.map((c) => c.code).join(",")],
    queryFn: async () => {
      if (!actor || cylinders.length === 0) return {};
      const results = await Promise.all(
        cylinders.map((c) =>
          actor.getCylinderMovements(c.code).then((movs: GasRecovery[]) => ({
            code: c.code,
            gases: [...new Set(movs.map((m) => m.gasType))],
          })),
        ),
      );
      return Object.fromEntries(results.map((r) => [r.code, r.gases]));
    },
    enabled: !!actor && !isFetching && cylinders.length > 0,
  });

  const emptyCylinders = cylinders.filter((c) => c.currentGasKg <= 0.01);

  // Technician list from assignments
  const technicianList = [
    ...new Set(Object.values(assignments).filter((t) => t !== "")),
  ].sort();

  // Filtered cylinders
  const filteredCylinders = cylinders.filter((c) => {
    if (activeFilter === "tutti") return true;
    if (activeFilter === "magazzino")
      return !assignments[c.code] || assignments[c.code] === "";
    return assignments[c.code] === activeFilter;
  });

  async function handleCreate() {
    if (!form.code.trim() || !form.capacityKg || !form.tareKg) {
      toast.error("Compila tutti i campi");
      return;
    }
    if (!actor) {
      toast.error("Connessione al backend non pronta, riprova tra un secondo");
      return;
    }
    try {
      await createCylinder.mutateAsync({
        code: form.code.trim(),
        capacityKg: Number.parseFloat(form.capacityKg),
        tareKg: Number.parseFloat(form.tareKg),
      });
      toast.success("Bombola creata");
      setOpen(false);
      setForm({ code: "", capacityKg: "", tareKg: "" });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Errore nella creazione: ${msg}`);
    }
  }

  async function handleExportBackup() {
    try {
      const data = await exportBackup.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `backup-bombole-${date}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup esportato");
    } catch {
      toast.error("Errore nell'esportazione");
    }
  }

  function handleExportReportCsv() {
    if (cylinders.length === 0) {
      toast.error("Nessuna bombola da esportare");
      return;
    }
    const rows: string[] = ["Codice Bombola;Tipo Gas;Quantita (kg)"];
    for (const cyl of cylinders) {
      const gases = gasMap[cyl.code] ?? [];
      const tipoGas = gases.length > 0 ? gases.join(" / ") : "Nessun gas";
      const quantita = cyl.currentGasKg.toFixed(2);
      rows.push(`${cyl.code};${tipoGas};${quantita}`);
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const date = new Date().toISOString().slice(0, 10);
    a.download = `report-bombole-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report CSV scaricato");
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (!Array.isArray(parsed)) {
          toast.error("File non valido: il backup deve essere un array JSON");
          return;
        }
        setPendingRestore(parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        toast.error(`File non valido: ${msg}`);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function handleConfirmRestore() {
    if (!pendingRestore) return;
    try {
      await restoreBackup.mutateAsync(
        pendingRestore as Parameters<typeof restoreBackup.mutateAsync>[0],
      );
      toast.success("Backup ripristinato");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Errore nel ripristino: ${msg}`);
    } finally {
      setPendingRestore(null);
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDeleteCode) return;
    try {
      await deleteCylinder.mutateAsync(confirmDeleteCode);
      toast.success("Bombola eliminata");
    } catch {
      toast.error("Errore nella cancellazione");
    } finally {
      setConfirmDeleteCode(null);
    }
  }

  const isRestoring = restoreBackup.isPending;
  const isExporting = exportBackup.isPending;

  // Stats
  const totalCount = cylinders.length;
  const _vuoteCount = cylinders.filter((c) => c.currentGasKg <= 0.01).length;
  const pieneCount = cylinders.filter(
    (c) => c.capacityKg > 0 && c.currentGasKg >= c.capacityKg * 0.98,
  ).length;
  const _inUsoCount = cylinders.filter(
    (c) =>
      c.currentGasKg > 0.01 &&
      (c.capacityKg <= 0 || c.currentGasKg < c.capacityKg * 0.98),
  ).length;
  const inMagazzinoCount = cylinders.filter(
    (c) => !assignments[c.code] || assignments[c.code] === "",
  ).length;
  const assegnateCount = cylinders.filter(
    (c) => assignments[c.code] && assignments[c.code] !== "",
  ).length;

  const stats = [
    {
      label: "Totale",
      value: totalCount,
      color: "text-foreground",
      bg: "bg-muted/50",
    },
    {
      label: "In Magazzino",
      value: inMagazzinoCount,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950/30",
    },
    {
      label: "Assegnate",
      value: assegnateCount,
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/30",
    },
    {
      label: "Piene",
      value: pieneCount,
      color: "text-green-600 dark:text-green-400",
      bg: "bg-green-50 dark:bg-green-950/30",
    },
  ];

  // Filter tabs
  const filterTabs = [
    { id: "tutti", label: `Tutti (${totalCount})` },
    { id: "magazzino", label: `Magazzino (${inMagazzinoCount})` },
    ...technicianList.map((t) => ({
      id: t,
      label: `${t} (${cylinders.filter((c) => assignments[c.code] === t).length})`,
    })),
  ];

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-5 flex items-center justify-between sticky top-0 z-10 shadow-md">
        <div className="flex items-center gap-3">
          <Wind className="h-6 w-6 opacity-80" />
          <h1 className="font-display text-xl font-bold tracking-tight">
            Bombole Recupero
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {emptyCylinders.length > 0 && (
            <Button
              data-ocid="delete_cylinder.open_modal_button"
              size="sm"
              variant="secondary"
              className="gap-1.5 font-semibold bg-destructive/20 hover:bg-destructive/30 text-destructive-foreground"
              onClick={() => setShowDeleteList(true)}
            >
              <Trash2 className="h-4 w-4" />
              Cancella
            </Button>
          )}
          <Button
            data-ocid="cylinder.open_modal_button"
            size="sm"
            variant="secondary"
            className="gap-1.5 font-semibold"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Nuova
          </Button>
        </div>
      </header>

      {/* Backup/Restore + Report bar */}
      <div className="bg-muted/30 border-b border-border px-4 py-2 flex items-center gap-2 justify-end flex-wrap">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileChange}
        />
        <Button
          data-ocid="report_csv.button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8"
          onClick={handleExportReportCsv}
          disabled={cylinders.length === 0}
        >
          <FileDown className="h-3.5 w-3.5" />
          Report CSV
        </Button>
        <Button
          data-ocid="backup.button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8"
          onClick={handleExportBackup}
          disabled={isExporting || isRestoring}
        >
          {isExporting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <HardDriveDownload className="h-3.5 w-3.5" />
          )}
          Backup JSON
        </Button>
        <Button
          data-ocid="restore.button"
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs h-8"
          onClick={() => fileInputRef.current?.click()}
          disabled={isExporting || isRestoring}
        >
          {isRestoring ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5" />
          )}
          Ripristina
        </Button>
      </div>

      {/* Content */}
      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full">
        {isLoading ? (
          <div
            data-ocid="cylinders.loading_state"
            className="flex justify-center items-center py-16"
          >
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : cylinders.length === 0 ? (
          <motion.div
            data-ocid="cylinders.empty_state"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-display font-semibold text-muted-foreground">
              Nessuna bombola registrata
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Aggiungi la prima bombola per iniziare
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-4"
          >
            {/* Stats bar */}
            <div className="grid grid-cols-2 gap-2">
              {stats.map((s) => (
                <div
                  key={s.label}
                  className={`rounded-xl p-3 border border-border ${s.bg} flex flex-col`}
                >
                  <span className="text-xs text-muted-foreground font-medium">
                    {s.label}
                  </span>
                  <span className={`text-2xl font-bold mt-0.5 ${s.color}`}>
                    {s.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFilter(tab.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    activeFilter === tab.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  {tab.id === "magazzino" && <Warehouse className="h-3 w-3" />}
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence>
              {filteredCylinders.length === 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-8 text-sm text-muted-foreground"
                >
                  Nessuna bombola in questo filtro
                </motion.div>
              ) : (
                filteredCylinders.map((cyl, i) => {
                  const isFull =
                    cyl.capacityKg > 0 &&
                    cyl.currentGasKg >= cyl.capacityKg * 0.98;
                  const assignedTo = assignments[cyl.code] ?? "";
                  const inMagazzino = assignedTo === "";
                  return (
                    <motion.button
                      key={cyl.code}
                      data-ocid={`cylinders.item.${i + 1}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => onSelectCylinder(cyl.code)}
                      className="w-full text-left bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md hover:border-primary/40 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-display font-bold text-lg text-foreground truncate">
                              {cyl.code}
                            </p>
                            {isFull && (
                              <Badge className="text-xs font-bold bg-green-500 hover:bg-green-500 text-white shrink-0">
                                PIENA
                              </Badge>
                            )}
                            {inMagazzino ? (
                              <Badge
                                variant="outline"
                                className="text-xs font-semibold text-blue-600 border-blue-300 shrink-0"
                              >
                                Magazzino
                              </Badge>
                            ) : (
                              <Badge className="text-xs font-semibold bg-amber-100 text-amber-800 hover:bg-amber-100 shrink-0">
                                {assignedTo}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            Gas attuale:{" "}
                            <span className="font-semibold text-foreground">
                              {cyl.currentGasKg.toFixed(2)} kg
                            </span>
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5 justify-end">
                          {(gasMap[cyl.code] ?? []).length > 0 ? (
                            (gasMap[cyl.code] ?? []).map((gas) => (
                              <Badge
                                key={gas}
                                variant="secondary"
                                className="text-xs font-semibold"
                              >
                                {gas}
                              </Badge>
                            ))
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              Nessun gas
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              isFull ? "bg-green-500" : "bg-accent"
                            }`}
                            style={{
                              width: `${Math.min(
                                100,
                                (cyl.currentGasKg / cyl.capacityKg) * 100,
                              )}%`,
                            }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Cap. {cyl.capacityKg} kg · Tara {cyl.tareKg} kg
                        </p>
                      </div>
                    </motion.button>
                  );
                })
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-xs text-muted-foreground">
        © {new Date().getFullYear()} · Built with love using{" "}
        <a
          href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
          className="underline hover:text-foreground"
          target="_blank"
          rel="noreferrer"
        >
          caffeine.ai
        </a>
      </footer>

      {/* Modal nuova bombola */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-ocid="cylinder.dialog" className="max-w-sm mx-4">
          <DialogHeader>
            <DialogTitle className="font-display">Nuova Bombola</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="code">Codice</Label>
              <Input
                id="code"
                data-ocid="cylinder.input"
                placeholder="es. BOM-001"
                value={form.code}
                onChange={(e) =>
                  setForm((p) => ({ ...p, code: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capacityKg">Capacità (kg)</Label>
              <Input
                id="capacityKg"
                type="number"
                placeholder="es. 12.5"
                value={form.capacityKg}
                onChange={(e) =>
                  setForm((p) => ({ ...p, capacityKg: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tareKg">Tara (kg)</Label>
              <Input
                id="tareKg"
                type="number"
                placeholder="es. 3.0"
                value={form.tareKg}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tareKg: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              data-ocid="cylinder.cancel_button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annulla
            </Button>
            <Button
              data-ocid="cylinder.submit_button"
              onClick={handleCreate}
              disabled={createCylinder.isPending || !actor}
            >
              {createCylinder.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Crea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete list dialog */}
      <Dialog open={showDeleteList} onOpenChange={setShowDeleteList}>
        <DialogContent
          data-ocid="delete_cylinder.dialog"
          className="max-w-sm mx-4"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Cancella Bombola</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              Seleziona la bombola vuota da eliminare:
            </p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {emptyCylinders.map((cyl, i) => (
                <div
                  key={cyl.code}
                  data-ocid={`delete_cylinder.item.${i + 1}`}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <span className="font-semibold text-foreground">
                    {cyl.code}
                  </span>
                  <Button
                    data-ocid={`delete_cylinder.delete_button.${i + 1}`}
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setShowDeleteList(false);
                      setConfirmDeleteCode(cyl.code);
                    }}
                  >
                    Elimina
                  </Button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button
              data-ocid="delete_cylinder.close_button"
              variant="outline"
              onClick={() => setShowDeleteList(false)}
            >
              Annulla
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm delete dialog */}
      <AlertDialog
        open={!!confirmDeleteCode}
        onOpenChange={(v) => !v && setConfirmDeleteCode(null)}
      >
        <AlertDialogContent data-ocid="delete_cylinder.modal">
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la bombola?</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare la bombola{" "}
              <span className="font-semibold">{confirmDeleteCode}</span>? Questa
              azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="delete_cylinder.cancel_button">
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="delete_cylinder.confirm_button"
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteCylinder.isPending}
            >
              {deleteCylinder.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirm restore dialog */}
      <AlertDialog
        open={!!pendingRestore}
        onOpenChange={(v) => !v && setPendingRestore(null)}
      >
        <AlertDialogContent data-ocid="restore.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Ripristinare il backup?</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro? Tutti i dati attuali verranno sovrascritti con il
              backup. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="restore.cancel_button">
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="restore.confirm_button"
              onClick={handleConfirmRestore}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRestoring ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Conferma
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
