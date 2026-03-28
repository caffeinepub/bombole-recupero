import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Cylinder, GasRecovery } from "../backend.d";
import { useActor } from "./useActor";

export function useGetAllCylinders() {
  const { actor, isFetching } = useActor();
  return useQuery<Cylinder[]>({
    queryKey: ["cylinders"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllCylinders();
    },
    enabled: !!actor && !isFetching,
  });
}

export function useGetCylinder(code: string) {
  const { actor, isFetching } = useActor();
  return useQuery<Cylinder>({
    queryKey: ["cylinder", code],
    queryFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.getCylinder(code);
    },
    enabled: !!actor && !isFetching && !!code,
  });
}

export function useGetCylinderMovements(code: string) {
  const { actor, isFetching } = useActor();
  return useQuery<GasRecovery[]>({
    queryKey: ["movements", code],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getCylinderMovements(code);
    },
    enabled: !!actor && !isFetching && !!code,
  });
}

export function useCreateCylinder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      code,
      capacityKg,
      tareKg,
    }: {
      code: string;
      capacityKg: number;
      tareKg: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.createCylinder(code, capacityKg, tareKg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders"] });
    },
  });
}

export function useRegisterRecovery(code: string) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      location: string;
      equipment: string;
      technician: string;
      gasType: string;
      kg: number;
    }) => {
      if (!actor) throw new Error("No actor");
      return actor.registerRecovery(
        code,
        data.location,
        data.equipment,
        data.technician,
        data.gasType,
        data.kg,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders"] });
      queryClient.invalidateQueries({ queryKey: ["cylinder", code] });
      queryClient.invalidateQueries({ queryKey: ["movements", code] });
    },
  });
}

export function useTotalDischarge(code: string) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.totalDischarge(code);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders"] });
      queryClient.invalidateQueries({ queryKey: ["cylinder", code] });
      queryClient.invalidateQueries({ queryKey: ["movements", code] });
    },
  });
}

export function useExportCsv(code: string) {
  const { actor } = useActor();
  return useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      return actor.exportCylinderCsv(code);
    },
  });
}

export function useBackupRestore() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  const exportBackup = useMutation({
    mutationFn: async () => {
      if (!actor) throw new Error("No actor");
      const cylinders = await actor.getAllCylinders();
      const allMovements = await Promise.all(
        cylinders.map(async (c) => ({
          code: c.code,
          movements: await actor.getCylinderMovements(c.code),
        })),
      );
      const data = cylinders.map((c) => ({
        code: c.code,
        capacityKg: c.capacityKg,
        tareKg: c.tareKg,
        currentGasKg: c.currentGasKg,
        recoveries: (
          allMovements.find((m) => m.code === c.code)?.movements ?? []
        ).map((r) => ({
          location: r.location,
          equipment: r.equipment,
          technician: r.technician,
          gasType: r.gasType,
          kg: r.kg,
          timestamp: r.timestamp.toString(),
        })),
      }));
      return data;
    },
  });

  const restoreBackup = useMutation({
    mutationFn: async (
      data: Array<{
        code: string;
        capacityKg: number;
        tareKg: number;
        currentGasKg: number;
        recoveries: Array<{
          location: string;
          equipment: string;
          technician: string;
          gasType: string;
          kg: number;
          timestamp: string;
        }>;
      }>,
    ) => {
      if (!actor) throw new Error("No actor");
      await actor.deleteAllCylinders();
      for (const cyl of data) {
        await actor.createCylinderFull(
          cyl.code,
          cyl.capacityKg,
          cyl.tareKg,
          cyl.currentGasKg,
        );
        for (const rec of cyl.recoveries) {
          await actor.registerRecoveryWithTimestamp(
            cyl.code,
            rec.location,
            rec.equipment,
            rec.technician,
            rec.gasType,
            rec.kg,
            BigInt(rec.timestamp),
          );
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });

  return { exportBackup, restoreBackup };
}

export function useDeleteCylinder() {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => {
      if (!actor) throw new Error("No actor");
      return actor.deleteCylinder(code);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cylinders"] });
    },
  });
}
