/**
 * Server-side intent scoring used by TD_Proactive_Nudge_Evaluator Flow.
 * Aggregates a visitor's recent Web_Engagement_Event__c records and decides
 * whether the proactive-nudge platform event should fire.
 */
public without sharing class TD_IntentScorer {

    private static final Integer NUDGE_THRESHOLD       = 60;
    private static final Integer LOOKBACK_HOURS        = 1;
    private static final Integer NUDGE_COOLDOWN_HOURS  = 1;

    public class ScorerInput {
        @InvocableVariable(required=true)
        public String visitorId;
    }

    public class ScorerResult {
        @InvocableVariable public Boolean shouldNudge;
        @InvocableVariable public Integer intentScore;
        @InvocableVariable public String  preferredModel;
        @InvocableVariable public String  triggerReason;
    }

    @InvocableMethod(
        label='Score Visitor Intent'
        description='Aggregates the visitor\'s recent engagement events and computes a 0-100 intent score. Returns shouldNudge=true when threshold crossed and not in cooldown.'
    )
    public static List<ScorerResult> scoreVisitors(List<ScorerInput> inputs) {
        List<ScorerResult> out = new List<ScorerResult>();
        for (ScorerInput req : inputs) {
            out.add(scoreOne(req.visitorId));
        }
        return out;
    }

    private static ScorerResult scoreOne(String visitorId) {
        ScorerResult r = new ScorerResult();
        r.shouldNudge    = false;
        r.intentScore    = 0;
        r.preferredModel = '';

        if (String.isBlank(visitorId)) {
            r.triggerReason = 'NoVisitorId';
            return r;
        }

        DateTime windowStart   = DateTime.now().addHours(-LOOKBACK_HOURS);
        DateTime cooldownStart = DateTime.now().addHours(-NUDGE_COOLDOWN_HOURS);

        // Cooldown — has a click_cta event already fired for this visitor recently?
        Integer recentNudges = [
            SELECT COUNT()
            FROM Web_Engagement_Event__c
            WHERE Visitor_Id__c = :visitorId
              AND Event_Type__c = 'click_cta'
              AND Event_Timestamp__c >= :cooldownStart
        ];
        if (recentNudges > 0) {
            r.triggerReason = 'CooldownActive';
            return r;
        }

        // Aggregate visitor's events in the lookback window
        List<Web_Engagement_Event__c> events = [
            SELECT Vehicle_Model_Viewed__c, Time_On_Page_Seconds__c, Scroll_Depth_Percent__c,
                   Event_Type__c, Device_Type__c, Page_URL__c
            FROM Web_Engagement_Event__c
            WHERE Visitor_Id__c = :visitorId
              AND Event_Timestamp__c >= :windowStart
        ];

        if (events.isEmpty()) {
            r.triggerReason = 'NoEvents';
            return r;
        }

        Set<String> distinctModelPages = new Set<String>();
        Decimal maxTime               = 0;
        Decimal maxScroll             = 0;
        Boolean hasConfigurator       = false;
        Integer returnVisitCount      = 0;
        Boolean isMobile              = false;
        Map<String,Integer> modelCnt  = new Map<String,Integer>();

        for (Web_Engagement_Event__c e : events) {
            if (String.isNotBlank(e.Vehicle_Model_Viewed__c)) {
                distinctModelPages.add(e.Page_URL__c);
                Integer c = modelCnt.containsKey(e.Vehicle_Model_Viewed__c)
                                ? modelCnt.get(e.Vehicle_Model_Viewed__c) : 0;
                modelCnt.put(e.Vehicle_Model_Viewed__c, c + 1);
            }
            if (e.Time_On_Page_Seconds__c != null && e.Time_On_Page_Seconds__c > maxTime) {
                maxTime = e.Time_On_Page_Seconds__c;
            }
            if (e.Scroll_Depth_Percent__c != null && e.Scroll_Depth_Percent__c > maxScroll) {
                maxScroll = e.Scroll_Depth_Percent__c;
            }
            if (e.Event_Type__c == 'config_interaction') hasConfigurator = true;
            if (e.Event_Type__c == 'return_visit') returnVisitCount++;
            if (e.Device_Type__c == 'Mobile') isMobile = true;
        }

        Integer score = 0;
        score += distinctModelPages.size() * 10;
        if (maxTime > 300) {
            score += 25;
        } else if (maxTime > 120) {
            score += 15;
        }
        if (hasConfigurator) score += 20;
        score += Math.min(returnVisitCount, 3) * 15;
        if (maxScroll > 80) score += 10;
        if (isMobile) score += 5;

        r.intentScore = score;

        // Most-viewed model wins as preferred
        Integer topCount = 0;
        for (String m : modelCnt.keySet()) {
            if (modelCnt.get(m) > topCount) {
                topCount = modelCnt.get(m);
                r.preferredModel = m;
            }
        }

        if (score >= NUDGE_THRESHOLD) {
            r.shouldNudge   = true;
            r.triggerReason = score >= 80 ? 'VeryHighIntent' : 'HighIntent';
        } else {
            r.triggerReason = 'BelowThreshold';
        }
        return r;
    }
}