import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface GasRecovery {
    kg: number;
    technician: string;
    equipment: string;
    timestamp: Time;
    location: string;
    gasType: string;
}
export type Time = bigint;
export interface Cylinder {
    code: string;
    capacityKg: number;
    tareKg: number;
    currentGasKg: number;
}
export interface backendInterface {
    assignCylinder(code: string, technician: string): Promise<void>;
    createCylinder(code: string, capacityKg: number, tareKg: number): Promise<void>;
    createCylinderFull(code: string, capacityKg: number, tareKg: number, currentGasKg: number): Promise<void>;
    deleteAllCylinders(): Promise<void>;
    deleteCylinder(code: string): Promise<void>;
    exportCylinderCsv(code: string): Promise<string>;
    getAllAssignments(): Promise<Array<[string, string]>>;
    getAllCylinders(): Promise<Array<Cylinder>>;
    getAllCylindersByCurrentGas(): Promise<Array<Cylinder>>;
    getCylinder(code: string): Promise<Cylinder>;
    getCylinderMovements(code: string): Promise<Array<GasRecovery>>;
    registerRecovery(code: string, location: string, equipment: string, technician: string, gasType: string, kg: number): Promise<void>;
    registerRecoveryWithTimestamp(code: string, location: string, equipment: string, technician: string, gasType: string, kg: number, timestamp: Time): Promise<void>;
    returnCylinder(code: string): Promise<void>;
    totalDischarge(code: string): Promise<void>;
}
