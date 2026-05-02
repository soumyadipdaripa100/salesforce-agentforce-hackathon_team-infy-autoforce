/**
 * Agentforce action — returns a formatted summary of the dealer's upcoming bookings.
 * Thin wrapper over TD_DealerConsoleController helpers.
 */
public with sharing class TD_Agent_DealerGetBookings {

    public class Request {
        @InvocableVariable(label='Dealer Account Id' required=true
                           description='Account Id of the dealership. Use the Id of the logged-in dealer\'s account.')
        public Id dealerAccountId;

        @InvocableVariable(label='Days Ahead'
                           description='How many days ahead to include. 0 = today only (default). 7 = today + next 7 days.')
        public Integer daysAhead;
    }

    @InvocableMethod(label='Dealer: Get Bookings'
                     description='Returns a formatted summary of the dealership\'s test drive bookings for today (or a configurable window ahead). Use when the sales rep asks "who\'s coming today", "what\'s on my schedule", or "show me upcoming drives".')
    public static List<String> run(List<Request> requests) {
        List<String> results = new List<String>();
        for (Request req : requests) {
            Integer days = req.daysAhead != null ? req.daysAhead : 0;
            List<Test_Drive__c> bookings = TD_DealerConsoleController.queryBookingsShared(req.dealerAccountId, 0, days, false);
            String label = (days == 0) ? 'today' : ('today and the next ' + days + ' days');
            results.add(TD_DealerConsoleController.formatBookingListShared(bookings, label));
        }
        return results;
    }
}
