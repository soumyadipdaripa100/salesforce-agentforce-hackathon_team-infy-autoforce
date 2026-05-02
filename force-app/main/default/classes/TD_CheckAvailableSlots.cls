/**
 * TD_CheckAvailableSlots - Agent Action: Returns available time slots for a dealership on a date
 */
public with sharing class TD_CheckAvailableSlots {

    public class SlotRequest {
        @InvocableVariable(label='Dealership Account Id' required=true
                          description='The Account Id of the dealership to check slots for')
        public String dealershipId;

        @InvocableVariable(label='Preferred Date' required=true
                          description='The date to check for available slots (YYYY-MM-DD format)')
        public Date preferredDate;
    }

    public class SlotResult {
        @InvocableVariable(label='Available Slot List'
                          description='Comma-separated list of available time slots, or a message if none available')
        public String slotList;

        @InvocableVariable(label='Slots Available'
                          description='True if at least one slot is available on the requested date')
        public Boolean slotsAvailable;
    }

    @InvocableMethod(label='Check Available Slots'
                     description='Returns available time slots for a given dealership and date. Use after dealership is identified and customer indicates a preferred date.')
    public static List<SlotResult> checkSlots(List<SlotRequest> requests) {
        List<SlotResult> results = new List<SlotResult>();

        for (SlotRequest req : requests) {
            SlotResult result = new SlotResult();

            List<Available_Slot__c> openSlots = [
                SELECT Slot_Time__c
                FROM Available_Slot__c
                WHERE Dealership__c = :req.dealershipId
                AND Slot_Date__c = :req.preferredDate
                AND Is_Booked__c = false
                ORDER BY Slot_Time__c ASC
            ];

            if (!openSlots.isEmpty()) {
                List<String> times = new List<String>();
                for (Available_Slot__c slot : openSlots) {
                    times.add(slot.Slot_Time__c);
                }
                result.slotList = String.join(times, ', ');
                result.slotsAvailable = true;
            } else {
                // Check if any slots exist for this date (all booked vs no slots at all)
                Integer totalSlots = [
                    SELECT COUNT()
                    FROM Available_Slot__c
                    WHERE Dealership__c = :req.dealershipId
                    AND Slot_Date__c = :req.preferredDate
                ];
                if (totalSlots > 0) {
                    result.slotList = 'All slots on this date are fully booked. Would you like to try a different date?';
                } else {
                    result.slotList = 'No slots are scheduled for this date. Would you like to try another date?';
                }
                result.slotsAvailable = false;
            }

            results.add(result);
        }

        return results;
    }
}
