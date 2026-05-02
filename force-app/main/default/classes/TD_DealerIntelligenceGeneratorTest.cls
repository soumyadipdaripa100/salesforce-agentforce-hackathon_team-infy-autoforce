@isTest
public class TD_DealerIntelligenceGeneratorTest {

    @testSetup
    static void setupData() {
        Product2 p = new Product2(Name='Test EV', IsActive=true, Family='Electric Vehicle');
        insert p;
        VehicleDefinition v = new VehicleDefinition(
            Name='Electra GT', ProductId=p.Id, BodyType='Sports', FuelSource='Electric',
            AccelerationTime='3.2s', MaximumBatteryRange='280 miles', TopSpeed='155 mph', TotalPower='670 hp'
        );
        insert v;

        Account dealer = new Account(Name='Test Dealer', Industry='Automotive', BillingCity='SF', BillingState='CA');
        insert dealer;

        Lead l = new Lead(FirstName='Test', LastName='User', Email='test@email.com', Company='Individual');
        insert l;

        Test_Drive__c booking = new Test_Drive__c(
            Customer_Name__c='Test User', Email__c='test@email.com',
            Vehicle_Model__c=v.Id, Model_Interested__c='Electra GT',
            Test_Drive_Date_Time__c=DateTime.now().addDays(1),
            Assigned_Dealership__c=dealer.Id, Status__c='Scheduled',
            Drive_Type__c='Standard Drive', Booking_Channel__c='Web Chat',
            Lead__c=l.Id, Zip_Code__c='94105'
        );
        insert booking;
    }

    @isTest
    static void testGenerateSummaryGT() {
        Test_Drive__c booking = [SELECT Id FROM Test_Drive__c LIMIT 1];
        List<String> summaries = TD_DealerIntelligenceGenerator.generateSummary(new List<Id>{booking.Id});

        System.assertEquals(1, summaries.size());
        System.assert(summaries[0].contains('CUSTOMER INTELLIGENCE BRIEF'), 'Should have header');
        System.assert(summaries[0].contains('Test User'), 'Should contain customer name');
        System.assert(summaries[0].contains('Electra GT'), 'Should contain model');
        System.assert(summaries[0].contains('Track Mode'), 'Should have GT-specific talking points');
        System.assert(summaries[0].contains('PREPARATION CHECKLIST'), 'Should have checklist');
    }
}
