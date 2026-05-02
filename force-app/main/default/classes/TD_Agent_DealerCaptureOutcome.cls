/**
 * Agentforce action — records the post-drive outcome on a Test_Drive__c.
 * Triggers Opportunity auto-creation (via TD_Auto_Create_Opportunity Flow) when
 * outcome is Interested or Very Interested.
 */
public with sharing class TD_Agent_DealerCaptureOutcome {

    public class Request {
        @InvocableVariable(label='Booking Id' required=true
                           description='Id of the Test_Drive__c record.')
        public Id bookingId;

        @InvocableVariable(label='Outcome' required=true
                           description='Customer interest level. Valid values: Very Interested, Interested, Undecided, Not Interested.')
        public String outcome;

        @InvocableVariable(label='Notes'
                           description='Free-form sales rep notes about the drive and customer reactions.')
        public String notes;

        @InvocableVariable(label='Next Action'
                           description='Recommended follow-up. Valid values: Send Quote, Send Brochure, Schedule Follow-up, Schedule Second Drive, None.')
        public String nextAction;

        @InvocableVariable(label='Competitor'
                           description='Competing brand(s) the customer mentioned (e.g. Tesla Model S, BMW i7).')
        public String competitor;
    }

    @InvocableMethod(label='Dealer: Capture Outcome'
                     description='Records the post-drive outcome and triggers Opportunity creation when interested. Use when the rep says "log outcome for {customer}" or "save the drive result".')
    public static List<String> run(List<Request> requests) {
        List<String> results = new List<String>();
        for (Request req : requests) {
            try {
                Test_Drive__c t = TD_DealerConsoleController.applyOutcomeShared(
                    req.bookingId, req.outcome, req.notes, req.nextAction, req.competitor
                );
                String msg = 'Outcome captured for ' + t.Name + ': ' + req.outcome + '.';
                if (req.outcome == 'Very Interested' || req.outcome == 'Interested') {
                    msg += ' Opportunity auto-creation in progress.';
                }
                if (String.isNotBlank(req.nextAction) && req.nextAction != 'None') {
                    msg += ' Customer will receive a ' + req.nextAction + ' follow-up.';
                }
                results.add(msg);
            } catch (Exception e) {
                results.add('Could not capture outcome: ' + e.getMessage());
            }
        }
        return results;
    }
}
