/**
 * Consolidated test class for the 5 Agentforce wrapper classes on the dealer surface.
 * Each method exercises one wrapper's bulkified @InvocableMethod path.
 */
@isTest
public class TD_Agent_DealerTest {

    @testSetup
    static void setup() {
        Account dealer = new Account(Name = 'Agent Dealer Test', Industry = 'Automotive');
        insert dealer;

        DateTime today2pm = DateTime.newInstance(Date.today(), Time.newInstance(14, 0, 0, 0));
        insert new Test_Drive__c(
            Customer_Name__c = 'Agent Customer',
            Email__c = 'agent.test@example.com',
            Model_Interested__c = 'Electra GT',
            Test_Drive_Date_Time__c = today2pm,
            Status__c = 'Scheduled',
            Drive_Type__c = 'Standard Drive',
            Assigned_Dealership__c = dealer.Id
        );
    }

    @isTest
    static void testAgentGetBookings() {
        Account dealer = [SELECT Id FROM Account WHERE Name = 'Agent Dealer Test' LIMIT 1];
        TD_Agent_DealerGetBookings.Request r = new TD_Agent_DealerGetBookings.Request();
        r.dealerAccountId = dealer.Id;
        List<String> out = TD_Agent_DealerGetBookings.run(new List<TD_Agent_DealerGetBookings.Request>{r});
        System.assertEquals(1, out.size());
        System.assert(out[0].contains('Agent Customer'));
    }

    @isTest
    static void testAgentUpdateStatus() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Agent Customer' LIMIT 1];
        TD_Agent_DealerUpdateStatus.Request r = new TD_Agent_DealerUpdateStatus.Request();
        r.bookingId = t.Id;
        r.newStatus = 'Arrived';
        List<String> out = TD_Agent_DealerUpdateStatus.run(new List<TD_Agent_DealerUpdateStatus.Request>{r});
        System.assertEquals(1, out.size());
        System.assert(out[0].contains('Arrived'));

        Test_Drive__c after = [SELECT Status__c, Checked_In_At__c FROM Test_Drive__c WHERE Id = :t.Id];
        System.assertEquals('Arrived', after.Status__c);
        System.assertNotEquals(null, after.Checked_In_At__c);
    }

    @isTest
    static void testAgentCaptureOutcome() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Agent Customer' LIMIT 1];
        TD_Agent_DealerCaptureOutcome.Request r = new TD_Agent_DealerCaptureOutcome.Request();
        r.bookingId = t.Id;
        r.outcome = 'Very Interested';
        r.notes = 'Loved the Track Mode';
        r.nextAction = 'Send Quote';
        r.competitor = 'Tesla Model S';
        List<String> out = TD_Agent_DealerCaptureOutcome.run(new List<TD_Agent_DealerCaptureOutcome.Request>{r});
        System.assertEquals(1, out.size());
        System.assert(out[0].contains('Very Interested'));
        System.assert(out[0].contains('Opportunity'));
    }

    @isTest
    static void testAgentGetIntelBrief() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Agent Customer' LIMIT 1];
        TD_Agent_DealerGetIntelBrief.Request r = new TD_Agent_DealerGetIntelBrief.Request();
        r.bookingId = t.Id;
        List<String> out = TD_Agent_DealerGetIntelBrief.run(new List<TD_Agent_DealerGetIntelBrief.Request>{r});
        System.assertEquals(1, out.size());
        System.assert(out[0].contains('Agent Customer'));
    }

    @isTest
    static void testAgentGetMetrics() {
        Account dealer = [SELECT Id FROM Account WHERE Name = 'Agent Dealer Test' LIMIT 1];
        TD_Agent_DealerGetMetrics.Request r = new TD_Agent_DealerGetMetrics.Request();
        r.dealerAccountId = dealer.Id;
        List<String> out = TD_Agent_DealerGetMetrics.run(new List<TD_Agent_DealerGetMetrics.Request>{r});
        System.assertEquals(1, out.size());
        System.assert(out[0].contains('Today\'s bookings'));
    }
}
