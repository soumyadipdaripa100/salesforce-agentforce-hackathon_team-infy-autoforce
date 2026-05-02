/**
 * TD_DealerMetricsController - KPI aggregation for the dealer console tile and Agent "show me my metrics" queries.
 *
 * Dual surface:
 *   - @AuraEnabled(cacheable=true) returns structured MetricsWrapper for LWC
 *   - @InvocableMethod returns formatted string for Agent
 */
public with sharing class TD_DealerMetricsController {

    public class MetricsWrapper {
        @AuraEnabled public Integer todayTotal;
        @AuraEnabled public Integer arrivedCount;
        @AuraEnabled public Integer completedCount;
        @AuraEnabled public Integer interestedCount;
        @AuraEnabled public Integer opportunityCount;
        @AuraEnabled public Decimal showUpRate;
        @AuraEnabled public Decimal conversionRate;
        @AuraEnabled public String topModel;
        @AuraEnabled public Integer noShowCount;
        @AuraEnabled public Integer upcomingNext7Days;
    }

    @AuraEnabled(cacheable=true)
    public static MetricsWrapper getMetrics(Id dealerAccountId, Integer daysBack) {
        if (daysBack == null || daysBack < 0) daysBack = 0;
        return compute(dealerAccountId, daysBack);
    }

    // Shared helpers used by the Agent surface class (TD_Agent_DealerGetMetrics)
    // Apex allows only one @InvocableMethod per class.
    public static MetricsWrapper computeShared(Id dealerAccountId, Integer daysBack) {
        return compute(dealerAccountId, daysBack);
    }

    public static String formatShared(MetricsWrapper m, Integer daysBack) {
        return format(m, daysBack);
    }

    private static MetricsWrapper compute(Id dealerAccountId, Integer daysBack) {
        MetricsWrapper m = new MetricsWrapper();
        m.todayTotal = 0;
        m.arrivedCount = 0;
        m.completedCount = 0;
        m.interestedCount = 0;
        m.opportunityCount = 0;
        m.noShowCount = 0;
        m.upcomingNext7Days = 0;
        m.showUpRate = 0;
        m.conversionRate = 0;
        m.topModel = 'N/A';

        DateTime startOfToday = DateTime.newInstance(Date.today(), Time.newInstance(0, 0, 0, 0));
        DateTime endOfToday = DateTime.newInstance(Date.today(), Time.newInstance(23, 59, 59, 0));
        DateTime rangeStart = DateTime.newInstance(Date.today().addDays(-daysBack), Time.newInstance(0, 0, 0, 0));
        DateTime next7End = DateTime.newInstance(Date.today().addDays(7), Time.newInstance(23, 59, 59, 0));

        String dealerClause = (dealerAccountId != null) ? ' AND Assigned_Dealership__c = :dealerAccountId ' : ' ';

        // Today's bookings
        List<Test_Drive__c> today = Database.query(
            'SELECT Id, Status__c, Outcome__c, Opportunity__c, Model_Interested__c ' +
            'FROM Test_Drive__c ' +
            'WHERE Test_Drive_Date_Time__c >= :startOfToday ' +
            '  AND Test_Drive_Date_Time__c <= :endOfToday ' +
            dealerClause +
            'LIMIT 2000'
        );
        m.todayTotal = today.size();
        Map<String, Integer> modelCounts = new Map<String, Integer>();
        for (Test_Drive__c t : today) {
            if (t.Status__c == 'Arrived' || t.Status__c == 'In Progress' || t.Status__c == 'Completed') m.arrivedCount++;
            if (t.Status__c == 'Completed') m.completedCount++;
            if (t.Status__c == 'No-Show') m.noShowCount++;
            if (t.Outcome__c == 'Very Interested' || t.Outcome__c == 'Interested') m.interestedCount++;
            if (t.Opportunity__c != null) m.opportunityCount++;
            if (String.isNotBlank(t.Model_Interested__c)) {
                Integer c = modelCounts.containsKey(t.Model_Interested__c) ? modelCounts.get(t.Model_Interested__c) : 0;
                modelCounts.put(t.Model_Interested__c, c + 1);
            }
        }

        // Upcoming next 7 days
        List<AggregateResult> upc = Database.query(
            'SELECT COUNT(Id) cnt FROM Test_Drive__c ' +
            'WHERE Test_Drive_Date_Time__c > :endOfToday ' +
            '  AND Test_Drive_Date_Time__c <= :next7End ' +
            dealerClause
        );
        m.upcomingNext7Days = upc.isEmpty() ? 0 : (Integer)upc[0].get('cnt');

        // Rates
        if (m.todayTotal > 0) {
            m.showUpRate = ((Decimal)m.arrivedCount / m.todayTotal * 100).setScale(1);
        }
        if (m.completedCount > 0) {
            m.conversionRate = ((Decimal)m.interestedCount / m.completedCount * 100).setScale(1);
        }

        // Top model today
        Integer topCount = 0;
        for (String model : modelCounts.keySet()) {
            if (modelCounts.get(model) > topCount) {
                topCount = modelCounts.get(model);
                m.topModel = model;
            }
        }

        // If window extends beyond today, also include earlier days for rates (conversion trend)
        if (daysBack > 0) {
            List<Test_Drive__c> window = Database.query(
                'SELECT Id, Status__c, Outcome__c, Opportunity__c ' +
                'FROM Test_Drive__c ' +
                'WHERE Test_Drive_Date_Time__c >= :rangeStart ' +
                '  AND Test_Drive_Date_Time__c < :startOfToday ' +
                dealerClause +
                'LIMIT 2000'
            );
            Integer totalWin = window.size();
            Integer arrivedWin = 0;
            Integer completedWin = 0;
            Integer interestedWin = 0;
            for (Test_Drive__c t : window) {
                if (t.Status__c == 'Arrived' || t.Status__c == 'In Progress' || t.Status__c == 'Completed') arrivedWin++;
                if (t.Status__c == 'Completed') completedWin++;
                if (t.Outcome__c == 'Very Interested' || t.Outcome__c == 'Interested') interestedWin++;
            }
            // Blend window + today
            Integer totalBlend = m.todayTotal + totalWin;
            Integer arrivedBlend = m.arrivedCount + arrivedWin;
            Integer completedBlend = m.completedCount + completedWin;
            Integer interestedBlend = m.interestedCount + interestedWin;
            if (totalBlend > 0) m.showUpRate = ((Decimal)arrivedBlend / totalBlend * 100).setScale(1);
            if (completedBlend > 0) m.conversionRate = ((Decimal)interestedBlend / completedBlend * 100).setScale(1);
        }

        return m;
    }

    private static String format(MetricsWrapper m, Integer daysBack) {
        String window = (daysBack == 0) ? 'today' : ('over the past ' + daysBack + ' days');
        return 'Metrics ' + window + ':\n' +
               '- Today\'s bookings: ' + m.todayTotal + '\n' +
               '- Arrived: ' + m.arrivedCount + ' | Completed: ' + m.completedCount + ' | No-show: ' + m.noShowCount + '\n' +
               '- Interested outcomes: ' + m.interestedCount + ' | Opportunities created: ' + m.opportunityCount + '\n' +
               '- Show-up rate: ' + m.showUpRate + '% | Conversion rate: ' + m.conversionRate + '%\n' +
               '- Most-requested model today: ' + m.topModel + '\n' +
               '- Upcoming (next 7 days): ' + m.upcomingNext7Days;
    }
}
