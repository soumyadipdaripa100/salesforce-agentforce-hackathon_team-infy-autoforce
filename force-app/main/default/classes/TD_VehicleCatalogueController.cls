/**
 * TD_VehicleCatalogueController - returns full VehicleDefinition records for the Electra lineup,
 * joined with Product2 for pricing. Consumed by electraProductCatalogue and electraVehicleShowcase LWCs.
 */
public without sharing class TD_VehicleCatalogueController {

    @AuraEnabled(cacheable=true)
    public static List<VehicleResult> getAllModels() {
        List<VehicleResult> out = new List<VehicleResult>();
        for (VehicleDefinition v : [
            SELECT Id, Name, BodyType, FuelSource, FuelType, VehicleClass, ModelCode, VariantName,
                   EngineName, TransmissionType, DrivetrainType, MainBatteryType, EmissionStandard,
                   DoorCount, AccelerationTime, MinimumBatteryRange, MaximumBatteryRange,
                   BatteryCapacity, TopSpeed, TotalPower, MaximumTorque, CurbWeight, Wheelbase,
                   Height, Width, Length, CombinedFuelEconomy,
                   ProductId, Product.Name, Product.Family, Product.IsActive
            FROM VehicleDefinition
            WHERE Name LIKE 'Electra%'
            WITH SYSTEM_MODE
            ORDER BY Name ASC
            LIMIT 50
        ]) {
            VehicleResult r = new VehicleResult();
            r.id = v.Id;
            r.name = v.Name;
            r.bodyType = v.BodyType;
            r.vehicleClass = v.VehicleClass;
            r.modelCode = v.ModelCode;
            r.variantName = v.VariantName;
            r.engineName = v.EngineName;
            r.transmissionType = v.TransmissionType;
            r.drivetrainType = v.DrivetrainType;
            r.fuelSource = v.FuelSource;
            r.fuelType = v.FuelType;
            r.mainBatteryType = v.MainBatteryType;
            r.emissionStandard = v.EmissionStandard;
            r.doorCount = v.DoorCount;
            r.accelerationTime = v.AccelerationTime;
            r.minimumBatteryRange = v.MinimumBatteryRange;
            r.maximumBatteryRange = v.MaximumBatteryRange;
            r.batteryCapacity = v.BatteryCapacity;
            r.topSpeed = v.TopSpeed;
            r.totalPower = v.TotalPower;
            r.maximumTorque = v.MaximumTorque;
            r.curbWeight = v.CurbWeight;
            r.wheelbase = v.Wheelbase;
            r.height = v.Height;
            r.width = v.Width;
            r.length_x = v.Length;
            r.combinedFuelEconomy = v.CombinedFuelEconomy;
            r.productId = v.ProductId;
            r.productName = v.Product != null ? v.Product.Name : null;
            r.productFamily = v.Product != null ? v.Product.Family : null;
            out.add(r);
        }
        return out;
    }

    public class VehicleResult {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String bodyType;
        @AuraEnabled public String vehicleClass;
        @AuraEnabled public String modelCode;
        @AuraEnabled public String variantName;
        @AuraEnabled public String engineName;
        @AuraEnabled public String transmissionType;
        @AuraEnabled public String drivetrainType;
        @AuraEnabled public String fuelSource;
        @AuraEnabled public String fuelType;
        @AuraEnabled public String mainBatteryType;
        @AuraEnabled public String emissionStandard;
        @AuraEnabled public Integer doorCount;
        @AuraEnabled public String accelerationTime;
        @AuraEnabled public String minimumBatteryRange;
        @AuraEnabled public String maximumBatteryRange;
        @AuraEnabled public String batteryCapacity;
        @AuraEnabled public String topSpeed;
        @AuraEnabled public String totalPower;
        @AuraEnabled public String maximumTorque;
        @AuraEnabled public String curbWeight;
        @AuraEnabled public String wheelbase;
        @AuraEnabled public String height;
        @AuraEnabled public String width;
        @AuraEnabled public String length_x;
        @AuraEnabled public String combinedFuelEconomy;
        @AuraEnabled public String productId;
        @AuraEnabled public String productName;
        @AuraEnabled public String productFamily;
    }
}