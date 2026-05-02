@isTest
public class TD_GetVehicleModelsTest {

    @testSetup
    static void setupData() {
        Product2 p = new Product2(Name='Test EV', IsActive=true, Family='Electric Vehicle');
        insert p;
        VehicleDefinition v = new VehicleDefinition(
            Name='Electra GT', ProductId=p.Id, BodyType='Sports',
            FuelSource='Electric', AccelerationTime='3.2s', MaximumBatteryRange='280 miles',
            TopSpeed='155 mph', TotalPower='670 hp'
        );
        insert v;
    }

    @isTest
    static void testGetModels() {
        List<String> results = TD_GetVehicleModels.getModels(new List<String>{'dummy'});
        System.assertEquals(1, results.size());
        System.assert(results[0].contains('Electra GT'), 'Should contain model name');
        System.assert(results[0].contains('Sports'), 'Should contain body type');
        System.assert(results[0].contains('$52,000'), 'Should contain pricing');
    }

    @isTest
    static void testGetModelsEmpty() {
        delete [SELECT Id FROM VehicleDefinition];
        List<String> results = TD_GetVehicleModels.getModels(new List<String>{'dummy'});
        System.assert(results[0].contains('No vehicle models'), 'Should show empty message');
    }
}
