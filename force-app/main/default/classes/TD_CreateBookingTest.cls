@isTest
public class TD_CreateBookingTest {

    @testSetup
    static void setupData() {
        Product2 p = new Product2(Name='Test EV', IsActive=true, Family='Electric Vehicle');
        insert p;
        VehicleDefinition v = new VehicleDefinition(Name='Electra GT', ProductId=p.Id, BodyType='Sports', FuelSource='Electric');
        insert v;

        Account dealer = new Account(Name='Test Dealer SF', Industry='Automotive',
            BillingStreet='200 Market St', BillingCity='San Francisco', BillingState='CA');
        insert dealer;

        Date tomorrow = Date.today().addDays(1);
        Available_Slot__c slot = new Available_Slot__c(
            Dealership__c=dealer.Id, Slot_Date__c=tomorrow, Slot_Time__c='2:00 PM', Is_Booked__c=false
        );
        insert slot;
    }

    @isTest
    static void testCreateBookingHappyPath() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];

        TD_CreateBooking.BookingRequest req = new TD_CreateBooking.BookingRequest();
        req.customerName = 'Priya Sharma';
        req.email = 'priya@email.com';
        req.phone = '(555) 123-4567';
        req.vehicleModelName = 'Electra GT';
        req.preferredDate = Date.today().addDays(1);
        req.preferredTime = '2:00 PM';
        req.zipCode = '94105';
        req.dealershipId = dealer.Id;
        req.channel = 'Web Chat';
        req.driveType = 'Standard Drive';

        List<TD_CreateBooking.BookingResult> results = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );

        System.assertEquals(true, results[0].success, 'Booking should succeed');
        System.assertNotEquals(null, results[0].bookingId, 'Should have booking Id');
        System.assertNotEquals(null, results[0].leadId, 'Should have lead Id');
        System.assert(results[0].confirmationMessage.contains('Electra GT'), 'Confirmation should mention model');

        // Verify Lead created
        Lead l = [SELECT FirstName, LastName, LeadSource, Company FROM Lead WHERE Id = :results[0].leadId];
        System.assertEquals('Priya', l.FirstName);
        System.assertEquals('Sharma', l.LastName);
        System.assertEquals('Agentforce - Test Drive', l.LeadSource);

        // Verify slot marked booked
        Available_Slot__c slot = [SELECT Is_Booked__c FROM Available_Slot__c
            WHERE Dealership__c = :dealer.Id AND Slot_Date__c = :Date.today().addDays(1) AND Slot_Time__c = '2:00 PM'];
        System.assertEquals(true, slot.Is_Booked__c, 'Slot should be marked booked');
    }

    @isTest
    static void testCreateBookingExperienceDrive() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];

        TD_CreateBooking.BookingRequest req = new TD_CreateBooking.BookingRequest();
        req.customerName = 'David Chen';
        req.email = 'david@email.com';
        req.vehicleModelName = 'Electra GT';
        req.preferredDate = Date.today().addDays(2);
        req.preferredTime = '10:00 AM';
        req.zipCode = '94105';
        req.dealershipId = dealer.Id;
        req.driveType = 'Experience Drive';

        List<TD_CreateBooking.BookingResult> results = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );

        System.assertEquals(true, results[0].success);
        Test_Drive__c booking = [SELECT Drive_Type__c FROM Test_Drive__c WHERE Id = :results[0].bookingId];
        System.assertEquals('Experience Drive', booking.Drive_Type__c);
    }

    @isTest
    static void testCreateBookingSingleName() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];

        TD_CreateBooking.BookingRequest req = new TD_CreateBooking.BookingRequest();
        req.customerName = 'Madonna';
        req.email = 'madonna@email.com';
        req.vehicleModelName = 'Electra GT';
        req.preferredDate = Date.today().addDays(3);
        req.preferredTime = '10:00 AM';
        req.zipCode = '94105';
        req.dealershipId = dealer.Id;

        List<TD_CreateBooking.BookingResult> results = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );

        System.assertEquals(true, results[0].success);
        Lead l = [SELECT FirstName, LastName FROM Lead WHERE Id = :results[0].leadId];
        System.assertEquals('Madonna', l.FirstName);
        System.assertEquals('Unknown', l.LastName);
    }

    // ---- buildDateTime edge-case coverage (T-1 from judge review) ----

    @isTest
    static void testBuildDateTime_NoonPM() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];
        Date d = Date.today().addDays(4);
        insertSlot(dealer.Id, d, '12:00 PM');

        TD_CreateBooking.BookingRequest req = makeRequest(dealer.Id, 'Noon Test', 'noon@email.com', d, '12:00 PM');
        List<TD_CreateBooking.BookingResult> r = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );
        System.assertEquals(true, r[0].success, '12:00 PM should succeed');
        Test_Drive__c booking = [SELECT Test_Drive_Date_Time__c FROM Test_Drive__c WHERE Id = :r[0].bookingId];
        System.assertEquals(12, booking.Test_Drive_Date_Time__c.hour(), '12:00 PM must be noon (hour=12)');
    }

    @isTest
    static void testBuildDateTime_MidnightAM() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];
        Date d = Date.today().addDays(5);
        insertSlot(dealer.Id, d, '12:00 AM');

        TD_CreateBooking.BookingRequest req = makeRequest(dealer.Id, 'Midnight Test', 'midnight@email.com', d, '12:00 AM');
        List<TD_CreateBooking.BookingResult> r = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );
        System.assertEquals(true, r[0].success, '12:00 AM should succeed');
        Test_Drive__c booking = [SELECT Test_Drive_Date_Time__c FROM Test_Drive__c WHERE Id = :r[0].bookingId];
        System.assertEquals(0, booking.Test_Drive_Date_Time__c.hour(), '12:00 AM must be midnight (hour=0)');
    }

    @isTest
    static void testBuildDateTime_AmbiguousFailsSafely() {
        // Bug scenario: agent passes "2:00" with no AM/PM. Previously booked at 2:00 AM silently.
        // New contract: ambiguous times fail fast so the agent can re-ask.
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];
        Date d = Date.today().addDays(6);

        TD_CreateBooking.BookingRequest req = makeRequest(dealer.Id, 'Ambiguous Test', 'ambig@email.com', d, '2:00');
        List<TD_CreateBooking.BookingResult> r = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );
        System.assertEquals(false, r[0].success, 'Ambiguous time (no AM/PM) must not silently default to 2:00 AM');
        System.assert(r[0].confirmationMessage != null && r[0].confirmationMessage.toLowerCase().contains('time'),
            'Failure message should prompt the user to clarify the time');
    }

    @isTest
    static void testBuildDateTime_TwentyFourHour() {
        Account dealer = [SELECT Id FROM Account WHERE Name='Test Dealer SF' LIMIT 1];
        Date d = Date.today().addDays(7);
        insertSlot(dealer.Id, d, '14:00');

        TD_CreateBooking.BookingRequest req = makeRequest(dealer.Id, '24h Test', '24h@email.com', d, '14:00');
        List<TD_CreateBooking.BookingResult> r = TD_CreateBooking.createBooking(
            new List<TD_CreateBooking.BookingRequest>{req}
        );
        System.assertEquals(true, r[0].success, '24-hour format should succeed');
        Test_Drive__c booking = [SELECT Test_Drive_Date_Time__c FROM Test_Drive__c WHERE Id = :r[0].bookingId];
        System.assertEquals(14, booking.Test_Drive_Date_Time__c.hour(), '14:00 must map to 2 PM (hour=14)');
    }

    // ---- Helpers ----

    private static void insertSlot(Id dealerId, Date d, String timeStr) {
        insert new Available_Slot__c(
            Dealership__c = dealerId,
            Slot_Date__c = d,
            Slot_Time__c = timeStr,
            Is_Booked__c = false
        );
    }

    private static TD_CreateBooking.BookingRequest makeRequest(Id dealerId, String name, String email, Date d, String timeStr) {
        TD_CreateBooking.BookingRequest req = new TD_CreateBooking.BookingRequest();
        req.customerName = name;
        req.email = email;
        req.vehicleModelName = 'Electra GT';
        req.preferredDate = d;
        req.preferredTime = timeStr;
        req.zipCode = '94105';
        req.dealershipId = dealerId;
        return req;
    }
}
