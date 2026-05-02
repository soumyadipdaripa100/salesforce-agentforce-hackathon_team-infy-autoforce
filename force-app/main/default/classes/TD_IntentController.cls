/**
 * Receives engagement events from electraIntentTracker LWC and persists them
 * to Web_Engagement_Event__c so the Data Cloud pipeline (stream → CI → segments)
 * sees real visitor activity in addition to the D-007 simulated dataset.
 *
 * `without sharing` + AccessLevel.SYSTEM_MODE keeps this safe to call from the
 * Site Guest User on the Experience Cloud site without granting per-field FLS
 * on every Web_Engagement_Event__c column.
 */
public without sharing class TD_IntentController {

    @AuraEnabled
    public static String logEngagement(
        String visitorId,
        String pageUrl,
        String vehicleModel,
        Decimal timeOnPageSeconds,
        Decimal scrollDepthPercent,
        String eventType,
        String deviceType,
        String sessionId,
        String referralSource
    ) {
        if (String.isBlank(visitorId) || String.isBlank(eventType)) {
            throw new AuraHandledException('visitorId and eventType are required.');
        }

        Web_Engagement_Event__c evt = new Web_Engagement_Event__c(
            Visitor_Id__c            = visitorId,
            Page_URL__c              = pageUrl,
            Vehicle_Model_Viewed__c  = vehicleModel,
            Time_On_Page_Seconds__c  = timeOnPageSeconds,
            Scroll_Depth_Percent__c  = scrollDepthPercent,
            Event_Type__c            = eventType,
            Event_Timestamp__c       = DateTime.now(),
            Device_Type__c           = deviceType,
            Session_Id__c            = sessionId,
            Referral_Source__c       = referralSource
        );

        try {
            Database.SaveResult sr = Database.insert(evt, AccessLevel.SYSTEM_MODE);
            if (!sr.isSuccess()) {
                throw new AuraHandledException(
                    'Insert failed: ' + sr.getErrors()[0].getMessage()
                );
            }
            return sr.getId();
        } catch (DmlException e) {
            throw new AuraHandledException('DML error: ' + e.getMessage());
        }
    }
}