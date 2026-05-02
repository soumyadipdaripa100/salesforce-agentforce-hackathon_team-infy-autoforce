@isTest
public class TD_OmniScript_RemoteActionsTest {

    @testSetup
    static void setup() {
        Account dealer = new Account(Name = 'Electra OS Test Dealer', Industry = 'Automotive');
        insert dealer;

        Test_Drive__c t = new Test_Drive__c(
            Customer_Name__c = 'OmniScript Test Customer',
            Email__c = 'os.test@example.com',
            Model_Interested__c = 'Electra GT',
            Test_Drive_Date_Time__c = DateTime.newInstance(Date.today(), Time.newInstance(14, 0, 0, 0)),
            Status__c = 'Completed',
            Drive_Type__c = 'Standard Drive',
            Assigned_Dealership__c = dealer.Id
        );
        insert t;
    }

    @isTest
    static void testCaptureOutcomeSuccess() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'OmniScript Test Customer' LIMIT 1];
        Map<String, Object> r = TD_OmniScript_RemoteActions.captureOutcome(
            t.Id, 'Interested', 'OmniScript test note', 'Send Quote', 'BMW i7'
        );
        System.assertEquals(true, r.get('success'));
        System.assertEquals('Interested', (String) r.get('outcome'));
        System.assertEquals('Send Quote', (String) r.get('nextAction'));
    }

    @isTest
    static void testGetBookingHeader() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'OmniScript Test Customer' LIMIT 1];
        Map<String, Object> r = TD_OmniScript_RemoteActions.getBookingHeader(t.Id);
        System.assertEquals(true, r.get('success'));
        System.assertEquals('OmniScript Test Customer', (String) r.get('customerName'));
        System.assertEquals('Electra GT', (String) r.get('vehicle'));
    }

    @isTest
    static void testCaptureOutcomeInvalidId() {
        Map<String, Object> r = TD_OmniScript_RemoteActions.captureOutcome(
            '000000000000000', 'Interested', 'note', 'Send Quote', ''
        );
        System.assertEquals(false, r.get('success'));
        System.assertNotEquals(null, r.get('error'));
    }
}
