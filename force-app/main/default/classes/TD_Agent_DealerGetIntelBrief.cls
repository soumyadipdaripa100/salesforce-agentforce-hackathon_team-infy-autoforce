/**
 * Agentforce action — returns the customer intelligence brief for a specific booking
 * (talking points, preparation checklist, vehicle insights).
 */
public with sharing class TD_Agent_DealerGetIntelBrief {

    public class Request {
        @InvocableVariable(label='Booking Id' required=true
                           description='Id of the Test_Drive__c record to generate the brief for.')
        public Id bookingId;
    }

    @InvocableMethod(label='Dealer: Get Intel Brief'
                     description='Returns the customer intelligence brief for a booking (talking points, prep checklist, vehicle insights). Use when the rep says "pull up {customer}\'s profile" or "what do I need to know about this drive".')
    public static List<String> run(List<Request> requests) {
        List<Id> ids = new List<Id>();
        for (Request req : requests) ids.add(req.bookingId);
        return TD_DealerIntelligenceGenerator.generateSummary(ids);
    }
}
