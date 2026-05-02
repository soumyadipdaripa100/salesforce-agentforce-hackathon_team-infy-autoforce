/**
 * TD_CreateBooking - Agent Action: Creates Lead + Test Drive booking + marks slot as booked
 * This is the CORE booking action invoked by Agentforce after customer confirms details.
 */
public with sharing class TD_CreateBooking {

    public class BookingRequest {
        @InvocableVariable(label='Customer Full Name' required=true
                          description='Full name of the customer (e.g. Priya Sharma)')
        public String customerName;

        @InvocableVariable(label='Email' required=true
                          description='Customer email address')
        public String email;

        @InvocableVariable(label='Phone'
                          description='Customer phone number (optional)')
        public String phone;

        @InvocableVariable(label='Vehicle Model Name' required=true
                          description='Name of the vehicle model (e.g. Electra GT)')
        public String vehicleModelName;

        @InvocableVariable(label='Preferred Date' required=true
                          description='Date for the test drive')
        public Date preferredDate;

        @InvocableVariable(label='Preferred Time' required=true
                          description='Time slot for the test drive (e.g. 2:00 PM)')
        public String preferredTime;

        @InvocableVariable(label='Zip Code' required=true
                          description='Customer zip code')
        public String zipCode;

        @InvocableVariable(label='Dealership Account Id' required=true
                          description='Account Id of the assigned dealership')
        public String dealershipId;

        @InvocableVariable(label='Booking Channel'
                          description='Channel used for booking: Web Chat, WhatsApp, SMS, Phone. Defaults to Web Chat.')
        public String channel;

        @InvocableVariable(label='Drive Type'
                          description='Type of test drive: Standard Drive or Experience Drive. Defaults to Standard Drive.')
        public String driveType;
    }

    public class BookingResult {
        @InvocableVariable(label='Booking Id'
                          description='Id of the created Test Drive booking record')
        public String bookingId;

        @InvocableVariable(label='Confirmation Message'
                          description='Formatted confirmation message to show the customer')
        public String confirmationMessage;

        @InvocableVariable(label='Lead Id'
                          description='Id of the created Lead record')
        public String leadId;

        @InvocableVariable(label='Success'
                          description='Whether the booking was created successfully')
        public Boolean success;
    }

    @InvocableMethod(label='Create Test Drive Booking'
                     description='Creates a Lead and Test Drive booking record, marks the time slot as booked. Use ONLY after customer explicitly confirms all details.')
    public static List<BookingResult> createBooking(List<BookingRequest> requests) {
        List<BookingResult> results = new List<BookingResult>();

        for (BookingRequest req : requests) {
            BookingResult result = new BookingResult();
            try {
                // 1. Find VehicleDefinition by name
                List<VehicleDefinition> vehicles = [
                    SELECT Id, Name FROM VehicleDefinition
                    WHERE Name = :req.vehicleModelName LIMIT 1
                ];
                Id vehicleId = vehicles.isEmpty() ? null : vehicles[0].Id;

                // 2. Parse first/last name
                String firstName;
                String lastName;
                if (req.customerName != null && req.customerName.contains(' ')) {
                    Integer spaceIdx = req.customerName.indexOf(' ');
                    firstName = req.customerName.substring(0, spaceIdx);
                    lastName = req.customerName.substring(spaceIdx + 1);
                } else {
                    firstName = req.customerName;
                    lastName = 'Unknown';
                }

                // 3. Create Lead
                Lead newLead = new Lead(
                    FirstName = firstName,
                    LastName = lastName,
                    Email = req.email,
                    Phone = req.phone,
                    Company = 'Individual',
                    LeadSource = 'Agentforce - Test Drive',
                    Status = 'Open',
                    PostalCode = req.zipCode
                );
                insert newLead;
                result.leadId = newLead.Id;

                // 4. Determine channel and drive type defaults
                String bookingChannel = String.isNotBlank(req.channel) ? req.channel : 'Web Chat';
                String driveType = String.isNotBlank(req.driveType) ? req.driveType : 'Standard Drive';

                // 5. Create Test_Drive__c (fail early if time is ambiguous)
                DateTime scheduledAt = buildDateTime(req.preferredDate, req.preferredTime);
                if (scheduledAt == null) {
                    result.confirmationMessage = 'I need a clearer time — please say "2 PM" or "14:00" rather than "2:00". Could you confirm the time?';
                    result.success = false;
                    results.add(result);
                    continue;
                }
                Test_Drive__c booking = new Test_Drive__c(
                    Customer_Name__c = req.customerName,
                    Email__c = req.email,
                    Mobile_Number__c = req.phone != null ? extractNumber(req.phone) : null,
                    Vehicle_Model__c = vehicleId,
                    Model_Interested__c = req.vehicleModelName,
                    Test_Drive_Date_Time__c = scheduledAt,
                    Zip_Code__c = req.zipCode,
                    Assigned_Dealership__c = req.dealershipId,
                    Status__c = 'Scheduled',
                    Booking_Channel__c = bookingChannel,
                    Drive_Type__c = driveType,
                    Lead__c = newLead.Id
                );
                insert booking;
                result.bookingId = booking.Id;

                // 6. Mark the slot as booked
                List<Available_Slot__c> slots = [
                    SELECT Id FROM Available_Slot__c
                    WHERE Dealership__c = :req.dealershipId
                    AND Slot_Date__c = :req.preferredDate
                    AND Slot_Time__c = :req.preferredTime
                    AND Is_Booked__c = false
                    LIMIT 1
                ];
                if (!slots.isEmpty()) {
                    slots[0].Is_Booked__c = true;
                    slots[0].Booking_Reference__c = booking.Id;
                    update slots[0];
                }

                // 7. Get dealership details for confirmation
                Account dealer = [SELECT Name, BillingStreet, BillingCity, BillingState
                                  FROM Account WHERE Id = :req.dealershipId LIMIT 1];
                String address = '';
                if (dealer.BillingStreet != null) address += dealer.BillingStreet + ', ';
                if (dealer.BillingCity != null) address += dealer.BillingCity;
                if (dealer.BillingState != null) address += ', ' + dealer.BillingState;

                // 8. Chain Send Confirmation and Dealer Task flows (fire-and-forget, server-side so agent doesn't need to orchestrate)
                try {
                    Flow.Interview.createInterview('TD_Send_Confirmation', new Map<String, Object>{
                        'inputBookingId' => booking.Id,
                        'inputChannel' => bookingChannel
                    }).start();
                } catch (Exception e) {
                    System.debug('TD_Send_Confirmation interview error: ' + e.getMessage());
                }
                try {
                    Flow.Interview.createInterview('TD_Create_Dealer_Task', new Map<String, Object>{
                        'inputBookingId' => booking.Id
                    }).start();
                } catch (Exception e) {
                    System.debug('TD_Create_Dealer_Task interview error: ' + e.getMessage());
                }

                // 9. Build confirmation
                result.confirmationMessage =
                    'Your test drive is confirmed! Here are the details:\n' +
                    'Vehicle: ' + req.vehicleModelName + '\n' +
                    'Date: ' + req.preferredDate.format() + '\n' +
                    'Time: ' + req.preferredTime + '\n' +
                    'Drive Type: ' + driveType + '\n' +
                    'Dealership: ' + dealer.Name + '\n' +
                    'Address: ' + address + '\n' +
                    'Booking Reference: ' + booking.Name + '\n' +
                    'A confirmation email is on its way to ' + req.email + '.';
                result.success = true;

            } catch (Exception e) {
                result.confirmationMessage = 'I apologize, there was an issue creating your booking. ' +
                    'Let me try again or connect you with our team. Error: ' + e.getMessage();
                result.success = false;
            }

            results.add(result);
        }

        return results;
    }

    private static Decimal extractNumber(String phoneStr) {
        if (phoneStr == null) return null;
        String digits = phoneStr.replaceAll('[^0-9]', '');
        if (String.isBlank(digits)) return null;
        try {
            return Decimal.valueOf(digits);
        } catch (Exception e) {
            return null;
        }
    }

    private static DateTime buildDateTime(Date d, String timeStr) {
        if (d == null || String.isBlank(timeStr)) return null;
        timeStr = timeStr.trim().toUpperCase();

        Boolean hasAmPm = timeStr.contains('AM') || timeStr.contains('PM');
        Boolean looksLikeTime = Pattern.matches('\\d{1,2}:\\d{2}', timeStr);
        if (!hasAmPm && !looksLikeTime) return null;

        try {
            String timePart = timeStr.replaceAll('[^0-9:]', '').trim();
            List<String> parts = timePart.split(':');
            Integer hour = Integer.valueOf(parts[0]);
            Integer minute = parts.size() > 1 ? Integer.valueOf(parts[1]) : 0;

            if (hasAmPm) {
                Boolean isPM = timeStr.contains('PM');
                if (isPM && hour != 12) hour += 12;
                if (!isPM && hour == 12) hour = 0;
            } else {
                // No AM/PM marker — only unambiguous if 24-hour with hour > 12.
                // "2:00" could mean 2 AM or 2 PM; reject and let caller re-ask.
                if (hour <= 12) return null;
            }

            if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
            return DateTime.newInstance(d, Time.newInstance(hour, minute, 0, 0));
        } catch (Exception e) {
            return null;
        }
    }
}
