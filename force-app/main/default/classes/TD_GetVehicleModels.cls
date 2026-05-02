/**
 * TD_GetVehicleModels - Agent Action: Returns formatted list of all Electra vehicle models
 * Invocable from Agentforce as an Agent Action
 */
public with sharing class TD_GetVehicleModels {

    @InvocableMethod(label='Get Vehicle Models'
                     description='Returns a formatted list of all available Electra vehicle models with specs and pricing. Use when customer asks about models or hasnt specified one.')
    public static List<String> getModels(List<String> dummyInputs) {
        List<VehicleDefinition> vehicles = [
            SELECT Name, BodyType, AccelerationTime, MaximumBatteryRange,
                   TopSpeed, TotalPower, BatteryCapacity, DoorCount
            FROM VehicleDefinition
            ORDER BY Name ASC
        ];

        if (vehicles.isEmpty()) {
            return new List<String>{ 'No vehicle models are currently available.' };
        }

        // Pricing map (not stored in VehicleDefinition, maintained here)
        Map<String, String> pricing = new Map<String, String>{
            'Electra GT' => '$52,000',
            'Electra SUV' => '$48,000',
            'Electra Sedan' => '$45,000',
            'Electra Crossover' => '$38,000'
        };

        List<String> lines = new List<String>();
        Integer i = 1;
        for (VehicleDefinition v : vehicles) {
            String price = pricing.containsKey(v.Name) ? pricing.get(v.Name) : 'Contact us';
            String line = i + '. ' + v.Name + ' - ' + safeStr(v.BodyType) +
                ' | 0-60: ' + safeStr(v.AccelerationTime) +
                ' | Range: ' + safeStr(v.MaximumBatteryRange) +
                ' | Power: ' + safeStr(v.TotalPower) +
                ' | From ' + price;
            lines.add(line);
            i++;
        }

        return new List<String>{ String.join(lines, '\n') };
    }

    private static String safeStr(String val) {
        return val != null ? val : 'N/A';
    }
}
