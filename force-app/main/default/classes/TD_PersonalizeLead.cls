/**
 * Phase B helper invoked by TD_Personalize_Lead Flow after Lead creation.
 * Looks up the most likely Visitor_Id (either passed explicitly OR inferred
 * from the most-recent click_cta event matching this Lead's phone/email window),
 * scores them via TD_IntentScorer, and returns the intent fields for the
 * Flow to write back onto the Lead record.
 */
public without sharing class TD_PersonalizeLead {

    public class PersonalizeRequest {
        @InvocableVariable(required=true)
        public String leadId;
        @InvocableVariable
        public String visitorId;       // optional — passed via chat/booking if available
    }

    public class PersonalizeResult {
        @InvocableVariable public String  resolvedVisitorId;
        @InvocableVariable public Integer intentScore;
        @InvocableVariable public String  intentTier;     // VIP / High / Medium / Low
        @InvocableVariable public String  preferredModel;
        @InvocableVariable public Boolean wasPersonalized;
    }

    @InvocableMethod(
        label='Personalize Lead from Visitor Intent'
        description='Resolves a Visitor_Id (explicit or inferred from recent click_cta), scores via TD_IntentScorer, and returns intent fields for Flow to write to the Lead.'
    )
    public static List<PersonalizeResult> personalize(List<PersonalizeRequest> reqs) {
        List<PersonalizeResult> out = new List<PersonalizeResult>();
        for (PersonalizeRequest r : reqs) {
            out.add(personalizeOne(r));
        }
        return out;
    }

    private static PersonalizeResult personalizeOne(PersonalizeRequest r) {
        PersonalizeResult res = new PersonalizeResult();
        res.intentScore     = 0;
        res.intentTier      = 'Low';
        res.preferredModel  = '';
        res.wasPersonalized = false;

        String visitorId = r.visitorId;
        if (String.isBlank(visitorId)) {
            // Heuristic: most recent click_cta in last 10 min is likely this booker
            DateTime windowStart = DateTime.now().addMinutes(-10);
            List<Web_Engagement_Event__c> recent = [
                SELECT Visitor_Id__c
                FROM Web_Engagement_Event__c
                WHERE Event_Type__c = 'click_cta'
                  AND Event_Timestamp__c >= :windowStart
                ORDER BY Event_Timestamp__c DESC
                LIMIT 1
            ];
            if (!recent.isEmpty()) {
                visitorId = recent[0].Visitor_Id__c;
            }
        }

        res.resolvedVisitorId = visitorId;
        if (String.isBlank(visitorId)) {
            return res;  // No way to score — leave defaults
        }

        TD_IntentScorer.ScorerInput scoreReq = new TD_IntentScorer.ScorerInput();
        scoreReq.visitorId = visitorId;
        List<TD_IntentScorer.ScorerResult> scores =
            TD_IntentScorer.scoreVisitors(new List<TD_IntentScorer.ScorerInput>{ scoreReq });

        if (scores.isEmpty()) return res;
        TD_IntentScorer.ScorerResult s = scores[0];

        res.intentScore     = s.intentScore;
        res.preferredModel  = s.preferredModel;
        res.wasPersonalized = (s.intentScore != null && s.intentScore > 0);
        res.intentTier      = tierFor(s.intentScore);

        return res;
    }

    private static String tierFor(Integer score) {
        if (score == null) return 'Low';
        if (score >= 80) return 'VIP';
        if (score >= 60) return 'High';
        if (score >= 40) return 'Medium';
        return 'Low';
    }
}