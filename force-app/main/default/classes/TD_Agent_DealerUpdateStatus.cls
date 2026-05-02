/**
 * Agentforce action — transitions a Test Drive booking's status and stamps the relevant timestamp.
 * Arrived → Checked_In_At__c; In Progress → Drive_Started_At__c; Completed → Drive_Ended_At__c.
 */
public with sharing class TD_Agent_DealerUpdateStatus {

    public class Request {
        @InvocableVariable(label='Booking Id' required=true
                           description='Id of the Test_Drive__c record to update.')
        public Id bookingId;

        @InvocableVariable(label='New Status' required=true
                           description='New status to set. Valid values: Confirmed, Arrived, In Progress, Completed, No-Show, Cancelled.')
        public String newStatus;
    }

    @InvocableMethod(label='Dealer: Update Booking Status'
                     description='Transitions a booking status. Use when the rep says "mark Priya as arrived", "start the drive", "end the drive", or "mark as no-show".')
    public static List<String> run(List<Request> requests) {
        List<String> results = new List<String>();
        for (Request req : requests) {
            try {
                Test_Drive__c t = TD_DealerConsoleController.applyStatusTransitionShared(req.bookingId, req.newStatus);
                results.add('Booking ' + t.Name + ' is now ' + t.Status__c + '.');
            } catch (Exception e) {
                results.add('Could not update booking: ' + e.getMessage());
            }
        }
        return results;
    }
}
