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
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  Loader2,
  LogIn,
  LogOut,
  PlusCircle,
  Trash2,
  Warehouse,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useAssignCylinder,
  useGetAllAssignments,
  useGetCylinder,
  useGetCylinderMovements,
  useRegisterRecovery,
  useReturnCylinder,
  useTotalDischarge,
} from "../hooks/useQueries";

interface Props {
  code: string;
  onBack: () => void;
}

function formatDate(ts: bigint) {
  const d = new Date(Number(ts / 1_000_000n));
  return d.toLocaleString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CylinderDetail({ code, onBack }: Props) {
  const { data: cylinder, isLoading: loadingCyl } = useGetCylinder(code);
  const { data: movements = [], isLoading: loadingMov } =
    useGetCylinderMovements(code);
  const { data: assignments = {} } = useGetAllAssignments();
  const registerRecovery = useRegisterRecovery(code);
  const totalDischarge = useTotalDischarge(code);
  const assignCylinder = useAssignCylinder();
  const returnCylinder = useReturnCylinder();

  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [dischargeOpen, setDischargeOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [technicianName, setTechnicianName] = useState("");
  const [reportDownloaded, setReportDownloaded] = useState(false);
  const [form, setForm] = useState({
    location: "",
    equipment: "",
    technician: "",
    gasType: "",
    kg: "",
  });

  const assignedTo = assignments[code] ?? "";
  const inMagazzino = assignedTo === "";

  async function handleAddRecovery() {
    if (
      !form.location.trim() ||
      !form.equipment.trim() ||
      !form.technician.trim() ||
      !form.gasType.trim() ||
      !form.kg
    ) {
      toast.error("Compila tutti i campi");
      return;
    }

    if (cylinder) {
      const enteredKg = Number.parseFloat(form.kg);
      if (cylinder.currentGasKg + enteredKg > cylinder.capacityKg) {
        const available = (cylinder.capacityKg - cylinder.currentGasKg).toFixed(
          2,
        );
        toast.error(
          `Capacità massima superata. Max disponibile: ${available} kg`,
        );
        return;
      }
    }

    try {
      await registerRecovery.mutateAsync({
        location: form.location.trim(),
        equipment: form.equipment.trim(),
        technician: form.technician.trim(),
        gasType: form.gasType.trim(),
        kg: Number.parseFloat(form.kg),
      });
      toast.success("Recupero registrato");
      setRecoveryOpen(false);
      setForm({
        location: "",
        equipment: "",
        technician: "",
        gasType: "",
        kg: "",
      });
    } catch {
      toast.error("Errore nel recupero");
    }
  }

  async function handleDischarge() {
    try {
      await totalDischarge.mutateAsync();
      toast.success("Bombola scaricata");
      setDischargeOpen(false);
      setReportDownloaded(false);
    } catch {
      toast.error("Errore nello scarico");
    }
  }

  function handleExportCsv() {
    try {
      setExportingCsv(true);
      const sorted = [...movements].sort((a, b) =>
        Number(a.timestamp - b.timestamp),
      );
      const header = "Codice,Luogo,Apparecchiatura,Tecnico,Tipo Gas,Kg,Data\n";
      const rows = sorted
        .map((m) => {
          const data = formatDate(m.timestamp);
          // Wrap fields with commas or quotes in double-quotes
          const escapeCsv = (v: string) =>
            v.includes(",") || v.includes('"')
              ? `"${v.replace(/"/g, '""')}"`
              : v;
          return [
            escapeCsv(code),
            escapeCsv(m.location),
            escapeCsv(m.equipment),
            escapeCsv(m.technician),
            escapeCsv(m.gasType),
            m.kg.toFixed(2),
            escapeCsv(data),
          ].join(",");
        })
        .join("\n");
      const csv = header + rows;
      const blob = new Blob([`\uFEFF${csv}`], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bombola-${code}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV esportato");
      setReportDownloaded(true);
    } catch {
      toast.error("Errore esportazione CSV");
    } finally {
      setExportingCsv(false);
    }
  }

  async function handleAssign() {
    if (!technicianName.trim()) {
      toast.error("Inserisci il nome del tecnico");
      return;
    }
    try {
      await assignCylinder.mutateAsync({
        code,
        technician: technicianName.trim(),
      });
      toast.success(`Bombola assegnata a ${technicianName.trim()}`);
      setAssignOpen(false);
      setTechnicianName("");
    } catch {
      toast.error("Errore nell'assegnazione");
    }
  }

  async function handleReturn() {
    try {
      await returnCylinder.mutateAsync(code);
      toast.success("Bombola restituita al magazzino");
    } catch {
      toast.error("Errore nel reso");
    }
  }

  const gasPresenti = [...new Set(movements.map((m) => m.gasType))];
  const fillPct =
    cylinder && cylinder.capacityKg > 0
      ? Math.min(100, (cylinder.currentGasKg / cylinder.capacityKg) * 100)
      : 0;
  const isFull = fillPct >= 98;
  const dischargeBlocked = movements.length > 0 && !reportDownloaded;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button
          type="button"
          data-ocid="detail.back_button"
          onClick={onBack}
          className="p-2 -ml-2 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Torna alla lista"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-display font-bold text-lg truncate">{code}</h1>
          <p className="text-xs opacity-70">Dettaglio bombola</p>
        </div>
        {/* Assignment status in header */}
        {inMagazzino ? (
          <Badge
            variant="outline"
            className="text-xs font-semibold bg-white/10 text-white border-white/30"
          >
            <Warehouse className="h-3 w-3 mr-1" />
            Magazzino
          </Badge>
        ) : (
          <Badge className="text-xs font-semibold bg-amber-400/20 text-amber-100 border-amber-300/30">
            <LogIn className="h-3 w-3 mr-1" />
            {assignedTo}
          </Badge>
        )}
      </header>

      <main className="flex-1 px-4 py-5 max-w-2xl mx-auto w-full space-y-5">
        {/* Info card */}
        {loadingCyl ? (
          <div
            data-ocid="detail.loading_state"
            className="flex justify-center py-10"
          >
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        ) : cylinder ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-card border border-border rounded-xl p-5 shadow-sm"
          >
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Codice</p>
                <div className="flex items-center gap-2">
                  <p className="font-display font-bold text-lg">
                    {cylinder.code}
                  </p>
                  {isFull && (
                    <Badge className="text-xs font-bold bg-green-500 hover:bg-green-500 text-white">
                      PIENA
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Gas attuale</p>
                <p className="font-bold text-lg">
                  {cylinder.currentGasKg.toFixed(2)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    kg
                  </span>
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Capacità</p>
                <p className="font-semibold">{cylinder.capacityKg} kg</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tara</p>
                <p className="font-semibold">{cylinder.tareKg} kg</p>
              </div>
            </div>

            {/* Fill bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Riempimento</span>
                <span>{fillPct.toFixed(0)}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isFull ? "bg-green-500" : "bg-accent"
                  }`}
                  style={{ width: `${fillPct}%` }}
                />
              </div>
            </div>

            {/* Gas types */}
            {gasPresenti.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {gasPresenti.map((g) => (
                  <Badge key={g} variant="secondary" className="font-semibold">
                    {g}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>
        ) : null}

        {/* Assignment section */}
        <div
          className={`rounded-xl border p-4 flex items-center justify-between gap-3 ${
            inMagazzino
              ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
              : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
          }`}
        >
          <div className="flex items-center gap-2">
            {inMagazzino ? (
              <Warehouse className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            ) : (
              <LogIn className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
            <div>
              <p className="text-sm font-semibold">
                {inMagazzino ? "In magazzino" : `Assegnata a ${assignedTo}`}
              </p>
              <p className="text-xs text-muted-foreground">
                {inMagazzino
                  ? "Disponibile per essere presa in carico"
                  : "Il tecnico ha la bombola in carico"}
              </p>
            </div>
          </div>
          {inMagazzino ? (
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => setAssignOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              Assegna
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 shrink-0"
              onClick={handleReturn}
              disabled={returnCylinder.isPending}
            >
              {returnCylinder.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Reso
            </Button>
          )}
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Button
              data-ocid="recovery.open_modal_button"
              className="h-12 text-base gap-2 font-semibold w-full"
              onClick={() => {
                setForm((p) => ({ ...p, technician: assignedTo }));
                setRecoveryOpen(true);
              }}
              disabled={inMagazzino}
            >
              <PlusCircle className="h-5 w-5" />
              Aggiungi Recupero
            </Button>
            {inMagazzino && (
              <p className="text-xs text-muted-foreground text-center mt-1">
                Assegna prima la bombola a un tecnico per aggiungere recuperi
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Button
                data-ocid="discharge.open_modal_button"
                variant="destructive"
                className="h-12 text-sm gap-2 font-semibold w-full"
                onClick={() => setDischargeOpen(true)}
                disabled={totalDischarge.isPending || dischargeBlocked}
              >
                {totalDischarge.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Scarica Bombola
              </Button>
              {dischargeBlocked && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center leading-tight">
                  Scarica prima il report CSV per poter svuotare la bombola
                </p>
              )}
            </div>
            <Button
              data-ocid="export.button"
              variant="outline"
              className="h-12 text-sm gap-2 font-semibold"
              onClick={handleExportCsv}
              disabled={exportingCsv}
            >
              {exportingCsv ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Esporta CSV
            </Button>
          </div>
        </div>

        <Separator />

        {/* Movimenti */}
        <div>
          <h2 className="font-display font-bold text-base mb-3 flex items-center gap-2">
            Movimenti
            {movements.length > 0 && (
              <Badge variant="outline" className="text-xs">
                {movements.length}
              </Badge>
            )}
          </h2>

          {loadingMov ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div
              data-ocid="movements.empty_state"
              className="text-center py-8 text-sm text-muted-foreground"
            >
              Nessun movimento registrato
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {[...movements]
                .sort((a, b) => Number(b.timestamp - a.timestamp))
                .map((mov, i) => (
                  <motion.div
                    key={`${mov.timestamp}-${mov.gasType}`}
                    data-ocid={`movements.item.${i + 1}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-border rounded-lg p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge
                            variant="secondary"
                            className="text-xs font-bold"
                          >
                            {mov.gasType}
                          </Badge>
                          <span className="font-semibold text-sm">
                            {mov.kg.toFixed(2)} kg
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(mov.timestamp)}
                        </p>
                        <div className="mt-2 text-xs text-muted-foreground space-y-0.5">
                          <p>
                            <span className="font-medium text-foreground">
                              Tecnico:
                            </span>{" "}
                            {mov.technician}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              Luogo:
                            </span>{" "}
                            {mov.location}
                          </p>
                          <p>
                            <span className="font-medium text-foreground">
                              Apparecchiatura:
                            </span>{" "}
                            {mov.equipment}
                          </p>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Assegna */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent
          data-ocid="assign.dialog"
          className="max-w-sm mx-4 max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="font-display">Assegna Bombola</DialogTitle>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label htmlFor="technician-name">Nome Tecnico</Label>
            <Input
              id="technician-name"
              placeholder="es. Mario Rossi"
              value={technicianName}
              onChange={(e) => setTechnicianName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAssign()}
              onFocus={(e) =>
                e.currentTarget.scrollIntoView({
                  block: "center",
                  behavior: "smooth",
                })
              }
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssignOpen(false)}>
              Annulla
            </Button>
            <Button onClick={handleAssign} disabled={assignCylinder.isPending}>
              {assignCylinder.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Assegna
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Aggiungi Recupero */}
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent
          data-ocid="recovery.dialog"
          className="max-w-sm mx-4 max-h-[85vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="font-display">
              Aggiungi Recupero
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-1">
            {(
              [
                {
                  id: "location",
                  label: "Luogo",
                  placeholder: "es. Via Roma 1",
                },
                {
                  id: "equipment",
                  label: "Apparecchiatura",
                  placeholder: "es. Condizionatore split",
                },
                {
                  id: "technician",
                  label: "Tecnico",
                  placeholder: "es. Mario Rossi",
                },
                { id: "gasType", label: "Tipo Gas", placeholder: "es. R410A" },
              ] as const
            ).map(({ id, label, placeholder }) => (
              <div key={id} className="space-y-1.5">
                <Label htmlFor={id}>{label}</Label>
                <Input
                  id={id}
                  data-ocid={`recovery.${id === "gasType" ? "input" : "input"}`}
                  placeholder={placeholder}
                  value={form[id]}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, [id]: e.target.value }))
                  }
                  onFocus={(e) =>
                    e.currentTarget.scrollIntoView({
                      block: "center",
                      behavior: "smooth",
                    })
                  }
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="kg">Kg recuperati</Label>
              <Input
                id="kg"
                data-ocid="recovery.input"
                type="number"
                placeholder="es. 0.5"
                value={form.kg}
                onChange={(e) => setForm((p) => ({ ...p, kg: e.target.value }))}
                onFocus={(e) =>
                  e.currentTarget.scrollIntoView({
                    block: "center",
                    behavior: "smooth",
                  })
                }
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              data-ocid="recovery.cancel_button"
              variant="outline"
              onClick={() => setRecoveryOpen(false)}
            >
              Annulla
            </Button>
            <Button
              data-ocid="recovery.submit_button"
              onClick={handleAddRecovery}
              disabled={registerRecovery.isPending}
            >
              {registerRecovery.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Dialog Scarica Bombola */}
      <AlertDialog open={dischargeOpen} onOpenChange={setDischargeOpen}>
        <AlertDialogContent
          data-ocid="discharge.dialog"
          className="max-w-sm mx-4"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">
              Scarica Bombola
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler azzerare completamente la bombola{" "}
              <strong>{code}</strong>? Questa azione elimina tutti i movimenti
              registrati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-ocid="discharge.cancel_button">
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              data-ocid="discharge.confirm_button"
              onClick={handleDischarge}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Scarica
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
