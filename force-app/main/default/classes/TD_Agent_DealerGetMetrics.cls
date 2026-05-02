/**
 * Agentforce action — returns formatted KPIs for the dealership
 * (today's bookings, show-up rate, conversion rate, top model).
 */
public with sharing class TD_Agent_DealerGetMetrics {

    public class Request {
        @InvocableVariable(label='Dealer Account Id' required=true
                           description='Account Id of the dealership. Use the Id of the logged-in dealer\'s account.')
        public Id dealerAccountId;

        @InvocableVariable(label='Days Back'
                           description='Time window for rates. 0 = today only; 7 = this week. Default 0 (today).')
        public Integer daysBack;
    }

    @InvocableMethod(label='Dealer: Get Metrics'
                     description='Returns the dealership\'s KPIs: today\'s bookings, show-up rate, conversion rate, most-requested model. Use when the rep asks "what\'s my conversion rate", "how are we doing today", or "show me my metrics".')
    public static List<String> run(List<Request> requests) {
        List<String> results = new List<String>();
        for (Request req : requests) {
            Integer days = req.daysBack != null ? req.daysBack : 0;
            TD_DealerMetricsController.MetricsWrapper m = TD_DealerMetricsController.computeShared(req.dealerAccountId, days);
            results.add(TD_DealerMetricsController.formatShared(m, days));
        }
        return results;
    }
}
