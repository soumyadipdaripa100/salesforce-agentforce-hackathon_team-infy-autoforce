@isTest
public class TD_DealerMetricsControllerTest {

    @testSetup
    static void setup() {
        Account dealer = new Account(
            Name = 'Metrics Test Dealer',
            Industry = 'Automotive'
        );
        insert dealer;

        DateTime today9am = DateTime.newInstance(Date.today(), Time.newInstance(9, 0, 0, 0));
        DateTime today1pm = DateTime.newInstance(Date.today(), Time.newInstance(13, 0, 0, 0));
        DateTime today4pm = DateTime.newInstance(Date.today(), Time.newInstance(16, 0, 0, 0));
        DateTime tomorrow = DateTime.newInstance(Date.today().addDays(1), Time.newInstance(10, 0, 0, 0));

        // 3 today: 1 Completed+Very Interested+Opp, 1 Arrived, 1 Scheduled. 1 tomorrow.
        Opportunity opp = new Opportunity(Name = 'Test Metrics Opp', StageName = 'Qualification',
                                          CloseDate = Date.today().addDays(30), Amount = 50000);
        insert opp;

        insert new List<Test_Drive__c>{
            new Test_Drive__c(
                Customer_Name__c = 'Completed Customer',
                Email__c = 'completed@example.com',
                Model_Interested__c = 'Electra GT',
                Test_Drive_Date_Time__c = today9am,
                Status__c = 'Completed',
                Outcome__c = 'Very Interested',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id,
                Opportunity__c = opp.Id
            ),
            new Test_Drive__c(
                Customer_Name__c = 'Arrived Customer',
                Email__c = 'arrived@example.com',
                Model_Interested__c = 'Electra GT',
                Test_Drive_Date_Time__c = today1pm,
                Status__c = 'Arrived',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id
            ),
            new Test_Drive__c(
                Customer_Name__c = 'Scheduled Customer',
                Email__c = 'scheduled@example.com',
                Model_Interested__c = 'Electra SUV',
                Test_Drive_Date_Time__c = today4pm,
                Status__c = 'Scheduled',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id
            ),
            new Test_Drive__c(
                Customer_Name__c = 'Tomorrow Customer',
                Email__c = 'tomorrow@example.com',
                Model_Interested__c = 'Electra Sedan',
                Test_Drive_Date_Time__c = tomorrow,
                Status__c = 'Scheduled',
                Drive_Type__c = 'Standard Drive',
                Assigned_Dealership__c = dealer.Id
            )
        };
    }

    @isTest
    static void testGetMetricsBasic() {
        Account dealer = [SELECT Id FROM Account WHERE Name = 'Metrics Test Dealer' LIMIT 1];
        TD_DealerMetricsController.MetricsWrapper m = TD_DealerMetricsController.getMetrics(dealer.Id, 0);
        System.assertEquals(3, m.todayTotal, 'Three bookings today');
        System.assertEquals(2, m.arrivedCount, 'Arrived + Completed count as "arrived"');
        System.assertEquals(1, m.completedCount);
        System.assertEquals(1, m.interestedCount);
        System.assertEquals(1, m.opportunityCount);
        System.assertEquals(1, m.upcomingNext7Days, 'One booking tomorrow');
        System.assertEquals('Electra GT', m.topModel, 'GT requested twice, SUV once');
        // show-up rate = 2/3 = 66.7%
        System.assert(m.showUpRate > 60 && m.showUpRate < 70, 'Show-up rate around 66.7%');
        // conversion rate = 1 interested / 1 completed = 100%
        System.assertEquals(100, m.conversionRate, 'Conversion rate 100% (1 of 1 completed was interested)');
    }

    @isTest
    static void testGetMetricsNoBookings() {
        Account emptyDealer = new Account(Name = 'Empty Dealer', Industry = 'Automotive');
        insert emptyDealer;
        TD_DealerMetricsController.MetricsWrapper m = TD_DealerMetricsController.getMetrics(emptyDealer.Id, 0);
        System.assertEquals(0, m.todayTotal);
        System.assertEquals(0, m.showUpRate);
        System.assertEquals(0, m.conversionRate);
        System.assertEquals('N/A', m.topModel);
    }
}
