@isTest
public class TD_CheckAvailableSlotsTest {

    @testSetup
    static void setupData() {
        Account dealer = new Account(Name='Test Dealer', Industry='Automotive', BillingCity='SF', BillingState='CA');
        insert dealer;

        List<Available_Slot__c> slots = new List<Available_Slot__c>();
        Date tomorrow = Date.today().addDays(1);
        slots.add(new Available_Slot__c(Dealership__c=dealer.Id, Slot_Date__c=tomorrow, Slot_Time__c='10:00 AM', Is_Booked__c=false));
        slots.add(new Available_Slot__c(Dealership__c=dealer.Id, Slot_Date__c=tomorrow, Slot_Time__c='2:00 PM', Is_Booked__c=false));
        slots.add(new Available_Slot__c(Dealership__c=dealer.Id, Slot_Date__c=tomorrow, Slot_Time__c='4:00 PM', Is_Booked__c=true));
        insert slots;
    }

    @isTest
    static void testSlotsAvailable() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer' LIMIT 1];
        TD_CheckAvailableSlots.SlotRequest req = new TD_CheckAvailableSlots.SlotRequest();
        req.dealershipId = dealer.Id;
        req.preferredDate = Date.today().addDays(1);

        List<TD_CheckAvailableSlots.SlotResult> results = TD_CheckAvailableSlots.checkSlots(new List<TD_CheckAvailableSlots.SlotRequest>{req});
        System.assertEquals(true, results[0].slotsAvailable);
        System.assert(results[0].slotList.contains('10:00 AM'), 'Should include 10 AM');
        System.assert(results[0].slotList.contains('2:00 PM'), 'Should include 2 PM');
        System.assert(!results[0].slotList.contains('4:00 PM'), 'Should NOT include booked slot');
    }

    @isTest
    static void testNoSlotsAvailable() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer' LIMIT 1];
        TD_CheckAvailableSlots.SlotRequest req = new TD_CheckAvailableSlots.SlotRequest();
        req.dealershipId = dealer.Id;
        req.preferredDate = Date.today().addDays(30); // no slots this far out

        List<TD_CheckAvailableSlots.SlotResult> results = TD_CheckAvailableSlots.checkSlots(new List<TD_CheckAvailableSlots.SlotRequest>{req});
        System.assertEquals(false, results[0].slotsAvailable);
    }
}
