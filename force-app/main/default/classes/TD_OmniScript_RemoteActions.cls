/**
 * TD_OmniScript_RemoteActions - Visualforce RemoteAction entry points used by the
 * OS_CapturePostDriveOutcome OmniScript's Remote Action element.
 *
 * These methods delegate to TD_DealerConsoleController so the LWC modal, the
 * Agent captureOutcome invocable, and the OmniScript all share one business
 * logic path. Apex triggers (TD_Auto_Create_Opportunity, TD_Notify_Post_Drive)
 * fire on the resulting Test_Drive__c update exactly as they do today.
 */
global with sharing class TD_OmniScript_RemoteActions {

    @RemoteAction
    global static Map<String, Object> captureOutcome(
        String bookingId,
        String outcome,
        String notes,
        String nextAction,
        String competitor
    ) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            Test_Drive__c t = TD_DealerConsoleController.captureOutcome(
                (Id) bookingId, outcome, notes, nextAction, competitor
            );
            result.put('success', true);
            result.put('bookingId', String.valueOf(t.Id));
            result.put('outcome', t.Outcome__c);
            result.put('nextAction', t.Next_Action__c);
            result.put('opportunityId', t.Opportunity__c == null ? null : String.valueOf(t.Opportunity__c));
            result.put('message', 'Outcome captured successfully.');
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }
        return result;
    }

    @RemoteAction
    global static Map<String, Object> getBookingHeader(String bookingId) {
        Map<String, Object> result = new Map<String, Object>();
        try {
            Test_Drive__c t = [
                SELECT Id, Name, Customer_Name__c, Email__c, Model_Interested__c,
                       Vehicle_Model__r.Name, Test_Drive_Date_Time__c, Drive_Type__c,
                       Status__c, Outcome__c, Next_Action__c,
                       Assigned_Dealership__r.Name
                FROM Test_Drive__c
                WHERE Id = :(Id) bookingId
                LIMIT 1
            ];
            result.put('success', true);
            result.put('customerName', t.Customer_Name__c);
            result.put('vehicle', t.Vehicle_Model__r != null ? t.Vehicle_Model__r.Name : t.Model_Interested__c);
            result.put('driveDateTime', t.Test_Drive_Date_Time__c);
            result.put('driveType', t.Drive_Type__c);
            result.put('currentStatus', t.Status__c);
            result.put('currentOutcome', t.Outcome__c);
            result.put('dealerName', t.Assigned_Dealership__r != null ? t.Assigned_Dealership__r.Name : null);
        } catch (Exception e) {
            result.put('success', false);
            result.put('error', e.getMessage());
        }
        return result;
    }
}
