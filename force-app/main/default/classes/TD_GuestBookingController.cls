/**
 * TD_GuestBookingController — LWC-facing thin wrapper for the Electra EV booking form
 * (electraTestDriveBooking) so it works for Experience Cloud Guest users.
 *
 * Why this class exists:
 *   lightning/uiRecordApi.createRecord() inserts AND reads back the record in one call.
 *   Guest users in modern orgs (Secure Guest User Record Access enforced) cannot read
 *   records they just inserted unless an explicit sharing rule/trigger grants access,
 *   which fails the readback with "The requested resource does not exist".
 *
 *   This class runs `without sharing` so the insert succeeds, then returns JUST the
 *   id + auto-number Name — no full record fetch in guest context.
 *
 * Mirrors the Saumyadeep-owned pattern of @AuraEnabled LWC-specific controllers
 * (e.g. TD_MyTestDrivesController).
 */
public without sharing class TD_GuestBookingController {

    @AuraEnabled
    public static BookingResult createBooking(Map<String, Object> input) {
        if (input == null) input = new Map<String, Object>();

        // ---------- 1. Build the Test_Drive__c shell from the input map ----------
        Test_Drive__c td = new Test_Drive__c();
        assignString(td, Test_Drive__c.Customer_Name__c, input.get('customerName'));
        assignString(td, Test_Drive__c.Email__c,           input.get('email'));
        assignNumber(td, Test_Drive__c.Mobile_Number__c,   input.get('mobileNumber'));
        assignString(td, Test_Drive__c.Zip_Code__c,        input.get('zipCode'));
        assignString(td, Test_Drive__c.Model_Interested__c, input.get('modelInterested'));
        assignString(td, Test_Drive__c.Drive_Type__c,      input.get('driveType'));
        assignString(td, Test_Drive__c.Booking_Channel__c, input.get('bookingChannel'));
        assignString(td, Test_Drive__c.Status__c,          input.get('status'));
        assignString(td, Test_Drive__c.Notes__c,           input.get('notes'));
        assignLookup(td, Test_Drive__c.Assigned_Dealership__c, input.get('dealerId'));
        assignLookup(td, Test_Drive__c.Vehicle_Model__c,       input.get('vehicleId'));
        assignDateTime(td, Test_Drive__c.Test_Drive_Date_Time__c, input.get('dateTime'));

        // ---------- 2. Create a Lead (parity with TD_CreateBooking) ----------
        Id leadId = createLeadIfPossible(input);
        if (leadId != null) td.Lead__c = leadId;

        insert td;

        // ---------- 3. Mark the matching Available_Slot__c as booked ----------
        markSlotBooked(
            (String) input.get('dealerId'),
            (String) input.get('slotDate'),
            (String) input.get('timeSlot'),
            td.Id
        );

        // ---------- 4. Fire the two downstream Flows (fire-and-forget) ----------
        String channel = stringOrDefault((String) input.get('bookingChannel'), 'Web Chat');
        try {
            Flow.Interview.createInterview('TD_Send_Confirmation', new Map<String, Object>{
                'inputBookingId' => td.Id,
                'inputChannel'   => channel
            }).start();
        } catch (Exception ignore) {
            System.debug('TD_Send_Confirmation flow error: ' + ignore.getMessage());
        }
        try {
            Flow.Interview.createInterview('TD_Create_Dealer_Task', new Map<String, Object>{
                'inputBookingId' => td.Id
            }).start();
        } catch (Exception ignore) {
            System.debug('TD_Create_Dealer_Task flow error: ' + ignore.getMessage());
        }

        // ---------- 5. Return id + auto-number Name (no full-record readback) ----------
        Test_Drive__c saved = [
            SELECT Id, Name
            FROM Test_Drive__c
            WHERE Id = :td.Id
            LIMIT 1
        ];

        BookingResult r = new BookingResult();
        r.id = saved.Id;
        r.name = saved.Name;
        r.leadId = leadId;
        return r;
    }

    // =========================================================
    // Available Slots — LWC counterpart to TD_CheckAvailableSlots
    // (returns structured rows instead of a comma-separated string)
    // =========================================================

    @AuraEnabled(cacheable=true)
    public static List<SlotView> getAvailableSlots(String dealerAccountId, Date slotDate) {
        List<SlotView> out = new List<SlotView>();
        if (String.isBlank(dealerAccountId) || slotDate == null) return out;

        for (Available_Slot__c s : [
            SELECT Id, Slot_Time__c
            FROM Available_Slot__c
            WHERE Dealership__c = :dealerAccountId
              AND Slot_Date__c = :slotDate
              AND Is_Booked__c = false
            ORDER BY Slot_Time__c ASC
            LIMIT 50
        ]) {
            SlotView v = new SlotView();
            v.id = s.Id;
            v.slotTime = s.Slot_Time__c;
            out.add(v);
        }
        return out;
    }

    // =========================================================
    // Helpers — Lead creation + slot booking
    // =========================================================

    private static Id createLeadIfPossible(Map<String, Object> input) {
        String fullName = (String) input.get('customerName');
        String email    = (String) input.get('email');
        if (String.isBlank(fullName) || String.isBlank(email)) return null;

        // Split first/last out of the full name
        String firstName;
        String lastName;
        if (fullName.contains(' ')) {
            Integer sp = fullName.indexOf(' ');
            firstName = fullName.substring(0, sp);
            lastName  = fullName.substring(sp + 1);
        } else {
            firstName = fullName;
            lastName  = 'Unknown';
        }

        Decimal mobileNum = parseDecimal((String) input.get('mobileNumber'));
        String phone = mobileNum != null ? String.valueOf(mobileNum.longValue()) : null;

        Lead l = new Lead(
            FirstName  = firstName,
            LastName   = lastName,
            Email      = email,
            Phone      = phone,
            Company    = 'Individual',
            LeadSource = 'Web - Test Drive',
            Status     = 'Open - Not Contacted',
            PostalCode = (String) input.get('zipCode')
        );
        try {
            insert l;
            return l.Id;
        } catch (Exception e) {
            System.debug('Lead create failed (booking still proceeds): ' + e.getMessage());
            return null;
        }
    }

    private static void markSlotBooked(String dealerId, String slotDateStr, String slotTime, Id bookingId) {
        if (String.isBlank(dealerId) || String.isBlank(slotDateStr) || String.isBlank(slotTime)) return;
        Date d;
        try {
            d = Date.valueOf(slotDateStr);
        } catch (Exception e) {
            return;
        }
        List<Available_Slot__c> matches = [
            SELECT Id, Is_Booked__c, Booking_Reference__c
            FROM Available_Slot__c
            WHERE Dealership__c = :dealerId
              AND Slot_Date__c = :d
              AND Slot_Time__c = :slotTime
              AND Is_Booked__c = false
            LIMIT 1
        ];
        if (matches.isEmpty()) return;
        try {
            matches[0].Is_Booked__c = true;
            matches[0].Booking_Reference__c = bookingId;
            update matches[0];
        } catch (Exception e) {
            System.debug('Slot mark-booked failed: ' + e.getMessage());
        }
    }

    private static String stringOrDefault(String v, String fallback) {
        return String.isNotBlank(v) ? v : fallback;
    }

    public class SlotView {
        @AuraEnabled public String id;
        @AuraEnabled public String slotTime;
    }

    // ---------- helpers ----------

    private static void assignString(Test_Drive__c td, Schema.SObjectField f, Object v) {
        if (v == null) return;
        String s = String.valueOf(v);
        if (String.isBlank(s)) return;
        td.put(f, s);
    }

    private static void assignNumber(Test_Drive__c td, Schema.SObjectField f, Object v) {
        if (v == null) return;
        try {
            if (v instanceof Decimal) { td.put(f, (Decimal) v); return; }
            if (v instanceof Integer) { td.put(f, Decimal.valueOf((Integer) v)); return; }
            if (v instanceof Long)    { td.put(f, Decimal.valueOf((Long) v)); return; }
            String s = String.valueOf(v).trim();
            if (String.isNotBlank(s)) td.put(f, Decimal.valueOf(s));
        } catch (Exception ignore) {
            // leave null on parse failure
        }
    }

    private static void assignLookup(Test_Drive__c td, Schema.SObjectField f, Object v) {
        if (v == null) return;
        String s = String.valueOf(v);
        if (String.isBlank(s) || (s.length() != 15 && s.length() != 18)) return;
        td.put(f, (Id) s);
    }

    private static void assignDateTime(Test_Drive__c td, Schema.SObjectField f, Object v) {
        if (v == null) return;
        String s = String.valueOf(v).trim();
        if (String.isBlank(s)) return;
        try {
            // Accept ISO 8601 (e.g. "2026-04-25T14:00:00.000Z") — common from lightning-input type=datetime
            td.put(f, (DateTime) JSON.deserialize('"' + s + '"', DateTime.class));
        } catch (Exception ignore) {
            try {
                // Fallback: epoch millis
                td.put(f, DateTime.newInstance(Long.valueOf(s)));
            } catch (Exception ignore2) {}
        }
    }

    public class BookingResult {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String leadId;
    }

    // =========================================================
    // My Bookings — lookup & lightweight self-service mutations
    // (email + mobile pair acts as the guest auth proof)
    // =========================================================

    @AuraEnabled(cacheable=false)
    public static List<BookingView> getBookingsByContact(String email, String mobile) {
        if (String.isBlank(email)) return new List<BookingView>();
        String emailClean = email.trim().toLowerCase();
        Decimal mobileNum = parseDecimal(mobile);

        List<BookingView> out = new List<BookingView>();
        for (Test_Drive__c t : [
            SELECT Id, Name, Customer_Name__c, Email__c, Mobile_Number__c,
                   Model_Interested__c, Vehicle_Model__r.Name,
                   Test_Drive_Date_Time__c, Drive_Type__c, Status__c,
                   Booking_Channel__c, Zip_Code__c,
                   Assigned_Dealership__r.Name, Assigned_Dealership__r.BillingCity
            FROM Test_Drive__c
            WHERE Email__c != null
            ORDER BY Test_Drive_Date_Time__c DESC
            LIMIT 200
        ]) {
            // Soft-match email case-insensitively (SOQL = is case-insensitive for text,
            // but we do it in Apex to be safe across envs).
            if (t.Email__c == null || t.Email__c.trim().toLowerCase() != emailClean) continue;
            // If a mobile was supplied, require it to match too (stricter guest auth).
            if (mobileNum != null && t.Mobile_Number__c != null && t.Mobile_Number__c != mobileNum) continue;

            BookingView v = new BookingView();
            v.id = t.Id;
            v.name = t.Name;
            v.customerName = t.Customer_Name__c;
            v.email = t.Email__c;
            v.mobile = t.Mobile_Number__c != null ? String.valueOf(t.Mobile_Number__c.longValue()) : null;
            v.vehicle = t.Vehicle_Model__r != null && t.Vehicle_Model__r.Name != null
                ? t.Vehicle_Model__r.Name
                : t.Model_Interested__c;
            v.scheduledAt = t.Test_Drive_Date_Time__c;
            v.driveType = t.Drive_Type__c;
            v.status = t.Status__c;
            v.channel = t.Booking_Channel__c;
            v.dealerName = t.Assigned_Dealership__r != null ? t.Assigned_Dealership__r.Name : null;
            v.dealerCity = t.Assigned_Dealership__r != null ? t.Assigned_Dealership__r.BillingCity : null;
            out.add(v);
        }
        return out;
    }

    @AuraEnabled
    public static BookingResult cancelBooking(String bookingId, String email) {
        Test_Drive__c t = verifyOwnedBooking(bookingId, email);
        if (t.Status__c == 'Cancelled' || t.Status__c == 'Completed' || t.Status__c == 'No-Show') {
            throw new AuraHandledException('This booking can no longer be cancelled.');
        }
        t.Status__c = 'Cancelled';
        update t;
        return toResult(t);
    }

    @AuraEnabled
    public static BookingResult rescheduleBooking(String bookingId, String email, String newDateTime) {
        if (String.isBlank(newDateTime)) {
            throw new AuraHandledException('New date & time is required.');
        }
        Test_Drive__c t = verifyOwnedBooking(bookingId, email);
        if (t.Status__c == 'Completed' || t.Status__c == 'No-Show') {
            throw new AuraHandledException('This booking can no longer be rescheduled.');
        }
        DateTime dt;
        try {
            dt = (DateTime) JSON.deserialize('"' + newDateTime + '"', DateTime.class);
        } catch (Exception e) {
            throw new AuraHandledException('Invalid date & time format.');
        }
        if (dt < DateTime.now()) {
            throw new AuraHandledException('Please pick a future date & time.');
        }
        t.Test_Drive_Date_Time__c = dt;
        // If the booking was cancelled, rescheduling re-opens it as Scheduled.
        if (t.Status__c == 'Cancelled') t.Status__c = 'Scheduled';
        update t;
        return toResult(t);
    }

    // ---------- helpers for my bookings ----------

    private static Test_Drive__c verifyOwnedBooking(String bookingId, String email) {
        if (String.isBlank(bookingId) || String.isBlank(email)) {
            throw new AuraHandledException('Booking reference and email are required.');
        }
        List<Test_Drive__c> rows = [
            SELECT Id, Name, Email__c, Status__c, Test_Drive_Date_Time__c
            FROM Test_Drive__c WHERE Id = :bookingId LIMIT 1
        ];
        if (rows.isEmpty()) throw new AuraHandledException('Booking not found.');
        if (rows[0].Email__c == null
            || rows[0].Email__c.trim().toLowerCase() != email.trim().toLowerCase()) {
            throw new AuraHandledException('Email does not match this booking.');
        }
        return rows[0];
    }

    private static BookingResult toResult(Test_Drive__c t) {
        BookingResult r = new BookingResult();
        r.id = t.Id;
        r.name = t.Name;
        return r;
    }

    private static Decimal parseDecimal(String v) {
        if (String.isBlank(v)) return null;
        String digits = v.replaceAll('\\D', '');
        if (String.isBlank(digits)) return null;
        try { return Decimal.valueOf(digits); } catch (Exception e) { return null; }
    }

    public class BookingView {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String customerName;
        @AuraEnabled public String email;
        @AuraEnabled public String mobile;
        @AuraEnabled public String vehicle;
        @AuraEnabled public DateTime scheduledAt;
        @AuraEnabled public String driveType;
        @AuraEnabled public String status;
        @AuraEnabled public String channel;
        @AuraEnabled public String dealerName;
        @AuraEnabled public String dealerCity;
    }
}