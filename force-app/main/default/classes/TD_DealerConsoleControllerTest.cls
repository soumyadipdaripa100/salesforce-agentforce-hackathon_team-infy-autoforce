@isTest
public class TD_DealerConsoleControllerTest {

    @testSetup
    static void setup() {
        Account dealer = new Account(
            Name = 'Electra Downtown Test Dealer',
            Industry = 'Automotive',
            BillingStreet = '200 Market Street',
            BillingCity = 'San Francisco',
            BillingState = 'CA'
        );
        insert dealer;

        // 3 bookings: one for today (Scheduled), one for tomorrow (Scheduled), one completed yesterday
        DateTime today2pm = DateTime.newInstance(Date.today(), Time.newInstance(14, 0, 0, 0));
        DateTime tomorrow10am = DateTime.newInstance(Date.today().addDays(1), Time.newInstance(10, 0, 0, 0));
        DateTime yesterday3pm = DateTime.newInstance(Date.today().addDays(-1), Time.newInstance(15, 0, 0, 0));

        insert new List<Test_Drive__c>{
            new Test_Drive__c(
                Customer_Name__c = 'Priya Sharma',
                Email__c = 'priya.dc@example.com',
                Model_Interested__c = 'Electra GT',
                Test_Drive_Date_Time__c = today2pm,
                Status__c = 'Scheduled',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id
            ),
            new Test_Drive__c(
                Customer_Name__c = 'Alex Johnson',
                Email__c = 'alex.dc@example.com',
                Model_Interested__c = 'Electra SUV',
                Test_Drive_Date_Time__c = tomorrow10am,
                Status__c = 'Scheduled',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id
            ),
            new Test_Drive__c(
                Customer_Name__c = 'Past Customer',
                Email__c = 'past.dc@example.com',
                Model_Interested__c = 'Electra Sedan',
                Test_Drive_Date_Time__c = yesterday3pm,
                Status__c = 'Completed',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id
            )
        };
    }

    @isTest
    static void testGetTodayBookings() {
        Account dealer = [SELECT Id FROM Account WHERE Name = 'Electra Downtown Test Dealer' LIMIT 1];
        List<Test_Drive__c> today = TD_DealerConsoleController.getTodayBookings(dealer.Id);
        System.assertEquals(1, today.size(), 'Only today booking should return');
        System.assertEquals('Priya Sharma', today[0].Customer_Name__c);
    }

    @isTest
    static void testGetUpcomingBookings() {
        Account dealer = [SELECT Id FROM Account WHERE Name = 'Electra Downtown Test Dealer' LIMIT 1];
        List<Test_Drive__c> upcoming = TD_DealerConsoleController.getUpcomingBookings(dealer.Id, 7);
        System.assertEquals(2, upcoming.size(), 'Today + tomorrow = 2 bookings');
    }

    @isTest
    static void testStatusTransitionArrived() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Priya Sharma' LIMIT 1];
        TD_DealerConsoleController.updateBookingStatus(t.Id, 'Arrived');
        Test_Drive__c after = [SELECT Status__c, Checked_In_At__c FROM Test_Drive__c WHERE Id = :t.Id];
        System.assertEquals('Arrived', after.Status__c);
        System.assertNotEquals(null, after.Checked_In_At__c, 'Checked_In_At__c stamped');
    }

    @isTest
    static void testStatusTransitionSequence() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Priya Sharma' LIMIT 1];
        TD_DealerConsoleController.updateBookingStatus(t.Id, 'Arrived');
        TD_DealerConsoleController.updateBookingStatus(t.Id, 'In Progress');
        TD_DealerConsoleController.updateBookingStatus(t.Id, 'Completed');
        Test_Drive__c after = [SELECT Status__c, Checked_In_At__c, Drive_Started_At__c, Drive_Ended_At__c
                               FROM Test_Drive__c WHERE Id = :t.Id];
        System.assertEquals('Completed', after.Status__c);
        System.assertNotEquals(null, after.Checked_In_At__c);
        System.assertNotEquals(null, after.Drive_Started_At__c);
        System.assertNotEquals(null, after.Drive_Ended_At__c);
    }

    @isTest
    static void testCaptureOutcome() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Priya Sharma' LIMIT 1];
        TD_DealerConsoleController.captureOutcome(t.Id, 'Very Interested',
            'Test drove the GT, loved Track Mode. Trade-in is a Model 3 Performance.',
            'Send Quote', 'BMW i7');
        Test_Drive__c after = [SELECT Outcome__c, Outcome_Notes__c, Next_Action__c, Competitor_Considered__c
                               FROM Test_Drive__c WHERE Id = :t.Id];
        System.assertEquals('Very Interested', after.Outcome__c);
        System.assertEquals('Send Quote', after.Next_Action__c);
        System.assertEquals('BMW i7', after.Competitor_Considered__c);
        System.assert(after.Outcome_Notes__c.contains('Track Mode'));
    }

    @isTest
    static void testGetIntelBrief() {
        Test_Drive__c t = [SELECT Id FROM Test_Drive__c WHERE Customer_Name__c = 'Priya Sharma' LIMIT 1];
        String brief = TD_DealerConsoleController.getIntelBrief(t.Id);
        System.assertNotEquals(null, brief);
        System.assert(brief.contains('Priya Sharma'), 'Brief should include customer name');
    }

}
