/**
 * Phase C — Abandon Recovery.
 *
 * Invoked by the daily TD_Abandon_Recovery scheduled Flow. Identifies
 * high-intent web visitors in the last 24 hours who never completed a
 * booking (no Lead with matching Visitor_Id__c) and creates follow-up
 * Tasks owned by the running user for the sales team to action.
 *
 * Returns a single RecoveryResult so the Flow has a count to log.
 */
public without sharing class TD_AbandonRecovery {

    private static final Integer SCAN_HOURS              = 24;
    private static final Integer MIN_INTENT_FOR_RECOVERY = 60;

    public class RecoveryRequest {
        @InvocableVariable
        public String unused;  // placeholder so Flow can invoke without inputs
    }

    public class RecoveryResult {
        @InvocableVariable public Integer visitorsRecovered;
        @InvocableVariable public Integer tasksCreated;
    }

    public class AbandonedVisitor {
        public String   visitorId;
        public Integer  intentScore;
        public String   preferredModel;
        public Integer  eventCount;
        public DateTime lastEventAt;
        public String   taskSubject;
        public String   taskDescription;
    }

    @InvocableMethod(
        label='Process Abandon Recovery'
        description='Daily scan for high-intent visitors with no booking; creates follow-up Tasks for the sales team.'
    )
    public static List<RecoveryResult> processRecovery(List<RecoveryRequest> reqs) {
        List<AbandonedVisitor> visitors = findAbandonedVisitors();

        Integer tasksMade = 0;
        if (!visitors.isEmpty()) {
            List<Task> toInsert = new List<Task>();
            for (AbandonedVisitor v : visitors) {
                toInsert.add(new Task(
                    Subject      = v.taskSubject,
                    Description  = v.taskDescription,
                    ActivityDate = Date.today().addDays(1),
                    Priority     = v.intentScore >= 80 ? 'High' : 'Normal',
                    Status       = 'Not Started',
                    OwnerId      = UserInfo.getUserId()
                ));
            }
            insert toInsert;
            tasksMade = toInsert.size();
        }

        RecoveryResult r = new RecoveryResult();
        r.visitorsRecovered = visitors.size();
        r.tasksCreated      = tasksMade;
        return new List<RecoveryResult>{ r };
    }

    /**
     * Pure read — exposed for unit testing. No DML.
     */
    public static List<AbandonedVisitor> findAbandonedVisitors() {
        List<AbandonedVisitor> result = new List<AbandonedVisitor>();
        DateTime windowStart = DateTime.now().addHours(-SCAN_HOURS);

        AggregateResult[] visitors = [
            SELECT Visitor_Id__c vId, COUNT(Id) cnt, MAX(Event_Timestamp__c) lastAt
            FROM Web_Engagement_Event__c
            WHERE Event_Timestamp__c >= :windowStart
              AND Visitor_Id__c != null
              AND Visitor_Id__c != ''
            GROUP BY Visitor_Id__c
        ];

        if (visitors.isEmpty()) return result;

        Set<String> idsInWindow = new Set<String>();
        for (AggregateResult ar : visitors) idsInWindow.add((String) ar.get('vId'));

        Set<String> bookedIds = new Set<String>();
        for (Lead l : [
            SELECT Visitor_Id__c FROM Lead
            WHERE Visitor_Id__c IN :idsInWindow
              AND CreatedDate >= :windowStart
        ]) {
            if (l.Visitor_Id__c != null) bookedIds.add(l.Visitor_Id__c);
        }

        for (AggregateResult ar : visitors) {
            String vId = (String) ar.get('vId');
            if (bookedIds.contains(vId)) continue;

            Integer score = computeScore(vId, windowStart);
            if (score < MIN_INTENT_FOR_RECOVERY) continue;

            AbandonedVisitor av = new AbandonedVisitor();
            av.visitorId       = vId;
            av.eventCount      = (Integer) ar.get('cnt');
            av.lastEventAt     = (DateTime) ar.get('lastAt');
            av.intentScore     = score;
            av.preferredModel  = preferredModelFor(vId, windowStart);
            av.taskSubject     = 'High-Intent Web Visitor — Recovery Outreach';
            av.taskDescription = buildDescription(av);
            result.add(av);
        }

        return result;
    }

    private static Integer computeScore(String visitorId, DateTime windowStart) {
        Set<String> models = new Set<String>();
        Decimal maxTime = 0, maxScroll = 0;
        Boolean configurator = false;
        Integer returns = 0;
        Boolean mobile = false;

        for (Web_Engagement_Event__c e : [
            SELECT Vehicle_Model_Viewed__c, Time_On_Page_Seconds__c, Scroll_Depth_Percent__c,
                   Event_Type__c, Device_Type__c, Page_URL__c
            FROM Web_Engagement_Event__c
            WHERE Visitor_Id__c = :visitorId
              AND Event_Timestamp__c >= :windowStart
        ]) {
            if (String.isNotBlank(e.Vehicle_Model_Viewed__c)) models.add(e.Page_URL__c);
            if (e.Time_On_Page_Seconds__c != null && e.Time_On_Page_Seconds__c > maxTime) maxTime = e.Time_On_Page_Seconds__c;
            if (e.Scroll_Depth_Percent__c != null && e.Scroll_Depth_Percent__c > maxScroll) maxScroll = e.Scroll_Depth_Percent__c;
            if (e.Event_Type__c == 'config_interaction') configurator = true;
            if (e.Event_Type__c == 'return_visit') returns++;
            if (e.Device_Type__c == 'Mobile') mobile = true;
        }

        Integer score = models.size() * 10;
        if (maxTime > 300) score += 25;
        else if (maxTime > 120) score += 15;
        if (configurator) score += 20;
        score += Math.min(returns, 3) * 15;
        if (maxScroll > 80) score += 10;
        if (mobile) score += 5;
        return score;
    }

    private static String preferredModelFor(String visitorId, DateTime windowStart) {
        Map<String,Integer> counts = new Map<String,Integer>();
        for (AggregateResult ar : [
            SELECT Vehicle_Model_Viewed__c m, COUNT(Id) cnt
            FROM Web_Engagement_Event__c
            WHERE Visitor_Id__c = :visitorId
              AND Event_Timestamp__c >= :windowStart
              AND Vehicle_Model_Viewed__c != null
              AND Vehicle_Model_Viewed__c != ''
            GROUP BY Vehicle_Model_Viewed__c
        ]) {
            counts.put((String) ar.get('m'), (Integer) ar.get('cnt'));
        }
        String top = '';
        Integer topCount = 0;
        for (String m : counts.keySet()) {
            if (counts.get(m) > topCount) { topCount = counts.get(m); top = m; }
        }
        return top;
    }

    private static String buildDescription(AbandonedVisitor av) {
        return 'Visitor ' + av.visitorId
             + ' showed high intent (score ' + av.intentScore + ')'
             + (String.isNotBlank(av.preferredModel) ? ' on ' + av.preferredModel : '')
             + ' across ' + av.eventCount + ' events,'
             + ' last active ' + av.lastEventAt.format()
             + '. They left without booking — recommend follow-up if email was captured during chat.';
    }
}