/**
 * TD_DealerConsoleController - Dealer-side operations controller.
 *
 * Dual surface:
 *   1. @AuraEnabled methods - consumed by the electraDealerConsole LWC (strongly-typed SObject data)
 *   2. @InvocableMethod wrappers - consumed by the Electra_Dealer_Assistant Agentforce agent (LLM-friendly strings/wrappers)
 *
 * Both surfaces share the same underlying logic via private helpers.
 */
public with sharing class TD_DealerConsoleController {

    // =========================================================
    // LWC surface (@AuraEnabled)
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static List<Test_Drive__c> getTodayBookings(Id dealerAccountId) {
        return queryBookings(dealerAccountId, 0, 0, false);
    }

    @AuraEnabled(cacheable=true)
    public static List<Test_Drive__c> getUpcomingBookings(Id dealerAccountId, Integer daysAhead) {
        if (daysAhead == null || daysAhead <= 0) daysAhead = 7;
        return queryBookings(dealerAccountId, 0, daysAhead, false);
    }

    @AuraEnabled(cacheable=true)
    public static List<Test_Drive__c> getCompletedTodayBookings(Id dealerAccountId) {
        return queryBookings(dealerAccountId, 0, 0, true);
    }

    @AuraEnabled
    public static Test_Drive__c updateBookingStatus(Id bookingId, String newStatus) {
        return applyStatusTransition(bookingId, newStatus);
    }

    @AuraEnabled
    public static Test_Drive__c captureOutcome(Id bookingId, String outcome, String notes, String nextAction, String competitor) {
        return applyOutcome(bookingId, outcome, notes, nextAction, competitor);
    }

    @AuraEnabled(cacheable=true)
    public static String getIntelBrief(Id bookingId) {
        List<String> briefs = TD_DealerIntelligenceGenerator.generateSummary(new List<Id>{bookingId});
        return briefs != null && !briefs.isEmpty() ? briefs[0] : 'Intel brief unavailable.';
    }

    // =========================================================
    // Shared helpers — used by LWC surface AND by the per-action Agent classes
    // (Apex allows only ONE @InvocableMethod per class, so Agent wrappers live
    //  in separate TD_Agent_* classes that delegate here.)
    // =========================================================

    public static List<Test_Drive__c> queryBookingsShared(Id dealerAccountId, Integer daysBack, Integer daysAhead, Boolean completedOnly) {
        return queryBookings(dealerAccountId, daysBack, daysAhead, completedOnly);
    }

    public static Test_Drive__c applyStatusTransitionShared(Id bookingId, String newStatus) {
        return applyStatusTransition(bookingId, newStatus);
    }

    public static Test_Drive__c applyOutcomeShared(Id bookingId, String outcome, String notes, String nextAction, String competitor) {
        return applyOutcome(bookingId, outcome, notes, nextAction, competitor);
    }

    public static String formatBookingListShared(List<Test_Drive__c> bookings, String windowLabel) {
        return formatBookingList(bookings, windowLabel);
    }

    // =========================================================
    // Private helpers (shared between LWC and Agent surfaces)
    // =========================================================

    private static List<Test_Drive__c> queryBookings(Id dealerAccountId, Integer daysBack, Integer daysAhead, Boolean completedOnly) {
        DateTime startOfDay = DateTime.newInstance(Date.today().addDays(-daysBack), Time.newInstance(0, 0, 0, 0));
        DateTime endOfRange = DateTime.newInstance(Date.today().addDays(daysAhead), Time.newInstance(23, 59, 59, 0));

        String baseQuery =
            'SELECT Id, Name, Customer_Name__c, Email__c, Mobile_Number__c, ' +
            '       Model_Interested__c, Vehicle_Model__r.Name, ' +
            '       Test_Drive_Date_Time__c, Drive_Type__c, Status__c, ' +
            '       Booking_Channel__c, Zip_Code__c, ' +
            '       Checked_In_At__c, Drive_Started_At__c, Drive_Ended_At__c, ' +
            '       Drive_Duration_Minutes__c, Outcome__c, Outcome_Notes__c, ' +
            '       Next_Action__c, Competitor_Considered__c, Opportunity__c, ' +
            '       Sales_Rep__c, Lead__c, ' +
            '       Assigned_Dealership__r.Name, Assigned_Dealership__r.BillingStreet, ' +
            '       Assigned_Dealership__r.BillingCity, Assigned_Dealership__r.BillingState ' +
            'FROM Test_Drive__c ' +
            'WHERE Test_Drive_Date_Time__c >= :startOfDay ' +
            '  AND Test_Drive_Date_Time__c <= :endOfRange ';
        if (dealerAccountId != null) {
            baseQuery += '  AND Assigned_Dealership__c = :dealerAccountId ';
        }
        if (completedOnly) {
            baseQuery += '  AND Status__c IN (\'Completed\', \'No-Show\') ';
        }
        baseQuery += 'ORDER BY Test_Drive_Date_Time__c ASC LIMIT 200';

        return Database.query(baseQuery);
    }

    private static Test_Drive__c applyStatusTransition(Id bookingId, String newStatus) {
        Test_Drive__c t = [SELECT Id, Name, Status__c, Sales_Rep__c, Checked_In_At__c, Drive_Started_At__c, Drive_Ended_At__c
                           FROM Test_Drive__c WHERE Id = :bookingId LIMIT 1];
        t.Status__c = newStatus;
        DateTime now = DateTime.now();
        if (newStatus == 'Arrived' && t.Checked_In_At__c == null) {
            t.Checked_In_At__c = now;
        } else if (newStatus == 'In Progress' && t.Drive_Started_At__c == null) {
            t.Drive_Started_At__c = now;
        } else if (newStatus == 'Completed' && t.Drive_Ended_At__c == null) {
            t.Drive_Ended_At__c = now;
        }
        // Stamp the acting user as Sales_Rep__c on first human-touch event
        // (Arrived / In Progress / Completed). Idempotent — only set if null.
        if (t.Sales_Rep__c == null &&
            (newStatus == 'Arrived' || newStatus == 'In Progress' || newStatus == 'Completed')) {
            t.Sales_Rep__c = UserInfo.getUserId();
        }
        update t;
        return t;
    }

    private static Test_Drive__c applyOutcome(Id bookingId, String outcome, String notes, String nextAction, String competitor) {
        Test_Drive__c t = new Test_Drive__c(Id = bookingId);
        t.Outcome__c = outcome;
        if (String.isNotBlank(notes)) t.Outcome_Notes__c = notes;
        if (String.isNotBlank(nextAction)) t.Next_Action__c = nextAction;
        if (String.isNotBlank(competitor)) t.Competitor_Considered__c = competitor;
        if (t.Status__c == null) t.Status__c = 'Completed';
        update t;
        return [SELECT Id, Name, Status__c, Outcome__c, Outcome_Notes__c, Next_Action__c, Competitor_Considered__c, Opportunity__c
                FROM Test_Drive__c WHERE Id = :bookingId LIMIT 1];
    }

    private static String formatBookingList(List<Test_Drive__c> bookings, String windowLabel) {
        if (bookings.isEmpty()) {
            return 'No bookings ' + windowLabel + '.';
        }
        String out = 'Bookings ' + windowLabel + ' (' + bookings.size() + '):\n';
        for (Test_Drive__c t : bookings) {
            String timeStr = t.Test_Drive_Date_Time__c != null
                ? t.Test_Drive_Date_Time__c.format('EEE h:mm a')
                : 'TBD';
            out += '- [bookingId=' + t.Id + '] ' + t.Name + ' | ' + timeStr + ' | ' +
                   safe(t.Customer_Name__c) + ' | ' + safe(t.Model_Interested__c) + ' | ' +
                   safe(t.Drive_Type__c) + ' | status: ' + safe(t.Status__c) + '\n';
        }
        return out.removeEnd('\n');
    }

    private static String safe(String val) {
        return val == null ? 'N/A' : val;
    }
}
