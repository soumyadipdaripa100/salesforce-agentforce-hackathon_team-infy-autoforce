@isTest
public class TD_MyTestDrivesControllerTest {

    @testSetup
    static void setupData() {
        Product2 p = new Product2(Name='Test EV', IsActive=true, Family='Electric Vehicle');
        insert p;
        VehicleDefinition v = new VehicleDefinition(Name='Electra SUV', ProductId=p.Id, BodyType='SUV', FuelSource='Electric');
        insert v;

        Account dealer = new Account(Name='Test Dealer', Industry='Automotive');
        insert dealer;

        Test_Drive__c td = new Test_Drive__c(
            Customer_Name__c='Jane Doe', Email__c='jane@email.com',
            Vehicle_Model__c=v.Id, Model_Interested__c='Electra SUV',
            Test_Drive_Date_Time__c=DateTime.now().addDays(1),
            Assigned_Dealership__c=dealer.Id, Status__c='Scheduled',
            Drive_Type__c='Standard Drive', Zip_Code__c='94105'
        );
        insert td;
    }

    @isTest
    static void testGetMyTestDrives() {
        List<Test_Drive__c> drives = TD_MyTestDrivesController.getMyTestDrives('jane@email.com');
        System.assertEquals(1, drives.size());
        System.assertEquals('Jane Doe', drives[0].Customer_Name__c);
    }

    @isTest
    static void testGetMyTestDrivesNoMatch() {
        List<Test_Drive__c> drives = TD_MyTestDrivesController.getMyTestDrives('nobody@email.com');
        System.assertEquals(0, drives.size());
    }

    @isTest
    static void testGetMyTestDrivesBlankEmail() {
        List<Test_Drive__c> drives = TD_MyTestDrivesController.getMyTestDrives('');
        System.assertEquals(0, drives.size());
    }
}
