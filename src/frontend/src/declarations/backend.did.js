/* eslint-disable */

// @ts-nocheck

import { IDL } from '@icp-sdk/core/candid';

export const Cylinder = IDL.Record({
  'code' : IDL.Text,
  'capacityKg' : IDL.Float64,
  'tareKg' : IDL.Float64,
  'currentGasKg' : IDL.Float64,
});
export const Time = IDL.Int;
export const GasRecovery = IDL.Record({
  'kg' : IDL.Float64,
  'technician' : IDL.Text,
  'equipment' : IDL.Text,
  'timestamp' : Time,
  'location' : IDL.Text,
  'gasType' : IDL.Text,
});

export const idlService = IDL.Service({
  'createCylinder' : IDL.Func([IDL.Text, IDL.Float64, IDL.Float64], [], []),
  'createCylinderFull' : IDL.Func([IDL.Text, IDL.Float64, IDL.Float64, IDL.Float64], [], []),
  'deleteAllCylinders' : IDL.Func([], [], []),
  'deleteCylinder' : IDL.Func([IDL.Text], [], []),
  'exportCylinderCsv' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
  'getAllCylinders' : IDL.Func([], [IDL.Vec(Cylinder)], ['query']),
  'getAllCylindersByCurrentGas' : IDL.Func([], [IDL.Vec(Cylinder)], ['query']),
  'getCylinder' : IDL.Func([IDL.Text], [Cylinder], ['query']),
  'getCylinderMovements' : IDL.Func(
      [IDL.Text],
      [IDL.Vec(GasRecovery)],
      ['query'],
    ),
  'registerRecovery' : IDL.Func(
      [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Float64],
      [],
      [],
    ),
  'registerRecoveryWithTimestamp' : IDL.Func(
      [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Int],
      [],
      [],
    ),
  'totalDischarge' : IDL.Func([IDL.Text], [], []),
});

export const idlInitArgs = [];

export const idlFactory = ({ IDL }) => {
  const Cylinder = IDL.Record({
    'code' : IDL.Text,
    'capacityKg' : IDL.Float64,
    'tareKg' : IDL.Float64,
    'currentGasKg' : IDL.Float64,
  });
  const Time = IDL.Int;
  const GasRecovery = IDL.Record({
    'kg' : IDL.Float64,
    'technician' : IDL.Text,
    'equipment' : IDL.Text,
    'timestamp' : Time,
    'location' : IDL.Text,
    'gasType' : IDL.Text,
  });
  
  return IDL.Service({
    'createCylinder' : IDL.Func([IDL.Text, IDL.Float64, IDL.Float64], [], []),
    'createCylinderFull' : IDL.Func([IDL.Text, IDL.Float64, IDL.Float64, IDL.Float64], [], []),
    'deleteAllCylinders' : IDL.Func([], [], []),
    'deleteCylinder' : IDL.Func([IDL.Text], [], []),
    'exportCylinderCsv' : IDL.Func([IDL.Text], [IDL.Text], ['query']),
    'getAllCylinders' : IDL.Func([], [IDL.Vec(Cylinder)], ['query']),
    'getAllCylindersByCurrentGas' : IDL.Func(
        [],
        [IDL.Vec(Cylinder)],
        ['query'],
      ),
    'getCylinder' : IDL.Func([IDL.Text], [Cylinder], ['query']),
    'getCylinderMovements' : IDL.Func(
        [IDL.Text],
        [IDL.Vec(GasRecovery)],
        ['query'],
      ),
    'registerRecovery' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Float64],
        [],
        [],
      ),
    'registerRecoveryWithTimestamp' : IDL.Func(
        [IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Text, IDL.Float64, IDL.Int],
        [],
        [],
      ),
    'totalDischarge' : IDL.Func([IDL.Text], [], []),
  });
};

export const init = ({ IDL }) => { return []; };
