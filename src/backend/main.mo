import Array "mo:core/Array";
import Text "mo:core/Text";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Float "mo:core/Float";
import Map "mo:core/Map";
import Runtime "mo:core/Runtime";
import Order "mo:core/Order";

actor {
  type Cylinder = {
    code : Text;
    capacityKg : Float;
    tareKg : Float;
    currentGasKg : Float;
  };

  module Cylinder {
    public func compareByCurrentGas(cylinder1 : Cylinder, cylinder2 : Cylinder) : Order.Order {
      Float.compare(cylinder1.currentGasKg, cylinder2.currentGasKg);
    };
  };

  type GasRecovery = {
    location : Text;
    equipment : Text;
    technician : Text;
    gasType : Text;
    kg : Float;
    timestamp : Time.Time;
  };

  type CylinderRecord = {
    cylinder : Cylinder;
    recoveries : [GasRecovery];
  };

  stable var cylindersEntries : [(Text, CylinderRecord)] = [];
  var cylinders = Map.empty<Text, CylinderRecord>();

  system func preupgrade() {
    cylindersEntries := cylinders.entries().toArray();
  };

  system func postupgrade() {
    for ((k, v) in cylindersEntries.vals()) {
      cylinders.add(k, v);
    };
    cylindersEntries := [];
  };

  func getCylinderRecordInternal(code : Text) : CylinderRecord {
    switch (cylinders.get(code)) {
      case (null) { Runtime.trap("Cylinder not found") };
      case (?record) { record };
    };
  };

  public query ({ caller }) func getCylinder(code : Text) : async Cylinder {
    getCylinderRecordInternal(code).cylinder;
  };

  public query ({ caller }) func getAllCylinders() : async [Cylinder] {
    cylinders.values().toArray().map(func(record) { record.cylinder });
  };

  public query ({ caller }) func getAllCylindersByCurrentGas() : async [Cylinder] {
    cylinders.values().toArray().map(func(record) { record.cylinder }).sort(Cylinder.compareByCurrentGas);
  };

  public shared ({ caller }) func createCylinder(code : Text, capacityKg : Float, tareKg : Float) : async () {
    if (cylinders.containsKey(code)) { Runtime.trap("Cylinder already exists") };
    let newCylinder = {
      code;
      capacityKg;
      tareKg;
      currentGasKg = 0.0;
    };
    let record : CylinderRecord = {
      cylinder = newCylinder;
      recoveries = [];
    };
    cylinders.add(code, record);
  };

  public shared ({ caller }) func registerRecovery(code : Text, location : Text, equipment : Text, technician : Text, gasType : Text, kg : Float) : async () {
    let record = getCylinderRecordInternal(code);
    let newRecovery = {
      location;
      equipment;
      technician;
      gasType;
      kg;
      timestamp = Time.now();
    };
    let newCylinder = {
      code = record.cylinder.code;
      capacityKg = record.cylinder.capacityKg;
      tareKg = record.cylinder.tareKg;
      currentGasKg = record.cylinder.currentGasKg + kg;
    };
    let newRecord = {
      cylinder = newCylinder;
      recoveries = record.recoveries.concat([newRecovery]);
    };
    cylinders.add(code, newRecord);
  };

  public shared ({ caller }) func totalDischarge(code : Text) : async () {
    let record = getCylinderRecordInternal(code);
    let updatedCylinder = {
      code = record.cylinder.code;
      capacityKg = record.cylinder.capacityKg;
      tareKg = record.cylinder.tareKg;
      currentGasKg = 0.0;
    };
    let updatedRecord = {
      cylinder = updatedCylinder;
      recoveries = [];
    };
    cylinders.add(code, updatedRecord);
  };

  public query ({ caller }) func getCylinderMovements(code : Text) : async [GasRecovery] {
    getCylinderRecordInternal(code).recoveries;
  };

  public query ({ caller }) func exportCylinderCsv(code : Text) : async Text {
    let record = getCylinderRecordInternal(code);
    let header = "Location,Equipment,Technician,GasType,Kg,Timestamp\n";
    let body = record.recoveries.map(
      func(recovery) {
        recovery.location # "," # recovery.equipment # "," # recovery.technician # "," # recovery.gasType # "," # recovery.kg.toText() # "," # recovery.timestamp.toText();
      }
    ).values().join("\n");
    header # body;
  };

  // Delete a single cylinder (only if empty)
  public shared ({ caller }) func deleteCylinder(code : Text) : async () {
    let record = getCylinderRecordInternal(code);
    if (record.cylinder.currentGasKg > 0.01) {
      Runtime.trap("Cylinder is not empty");
    };
    ignore cylinders.remove(code);
  };

  // Backup/Restore functions
  public shared ({ caller }) func deleteAllCylinders() : async () {
    cylinders := Map.empty<Text, CylinderRecord>();
  };

  public shared ({ caller }) func createCylinderFull(code : Text, capacityKg : Float, tareKg : Float, currentGasKg : Float) : async () {
    let newCylinder = {
      code;
      capacityKg;
      tareKg;
      currentGasKg;
    };
    let record : CylinderRecord = {
      cylinder = newCylinder;
      recoveries = [];
    };
    cylinders.add(code, record);
  };

  public shared ({ caller }) func registerRecoveryWithTimestamp(code : Text, location : Text, equipment : Text, technician : Text, gasType : Text, kg : Float, timestamp : Time.Time) : async () {
    let record = getCylinderRecordInternal(code);
    let newRecovery = {
      location;
      equipment;
      technician;
      gasType;
      kg;
      timestamp;
    };
    let newRecord = {
      cylinder = record.cylinder;
      recoveries = record.recoveries.concat([newRecovery]);
    };
    cylinders.add(code, newRecord);
  };
};
