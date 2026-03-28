/* eslint-disable */

// @ts-nocheck

import type { ActorMethod } from '@icp-sdk/core/agent';
import type { IDL } from '@icp-sdk/core/candid';
import type { Principal } from '@icp-sdk/core/principal';

export interface Cylinder {
  'code' : string,
  'capacityKg' : number,
  'tareKg' : number,
  'currentGasKg' : number,
}
export interface GasRecovery {
  'kg' : number,
  'technician' : string,
  'equipment' : string,
  'timestamp' : Time,
  'location' : string,
  'gasType' : string,
}
export type Time = bigint;
export interface _SERVICE {
  'createCylinder' : ActorMethod<[string, number, number], undefined>,
  'createCylinderFull' : ActorMethod<[string, number, number, number], undefined>,
  'deleteAllCylinders' : ActorMethod<[], undefined>,
  'deleteCylinder' : ActorMethod<[string], undefined>,
  'exportCylinderCsv' : ActorMethod<[string], string>,
  'getAllCylinders' : ActorMethod<[], Array<Cylinder>>,
  'getAllCylindersByCurrentGas' : ActorMethod<[], Array<Cylinder>>,
  'getCylinder' : ActorMethod<[string], Cylinder>,
  'getCylinderMovements' : ActorMethod<[string], Array<GasRecovery>>,
  'registerRecovery' : ActorMethod<
    [string, string, string, string, string, number],
    undefined
  >,
  'registerRecoveryWithTimestamp' : ActorMethod<
    [string, string, string, string, string, number, bigint],
    undefined
  >,
  'totalDischarge' : ActorMethod<[string], undefined>,
}
export declare const idlService: IDL.ServiceClass;
export declare const idlInitArgs: IDL.Type[];
export declare const idlFactory: IDL.InterfaceFactory;
export declare const init: (args: { IDL: typeof IDL }) => IDL.Type[];
