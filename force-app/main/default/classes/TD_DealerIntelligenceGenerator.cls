/**
 * TD_DealerIntelligenceGenerator - Generates customer intelligence summary for dealer prep
 * Called by TD_Create_Dealer_Task flow after booking creation
 */
public with sharing class TD_DealerIntelligenceGenerator {

    @InvocableMethod(label='Generate Dealer Intelligence Summary'
                     description='Generates a formatted customer intelligence brief for the dealership sales rep, including model-specific talking points and preparation checklist.')
    public static List<String> generateSummary(List<Id> bookingIds) {
        List<String> summaries = new List<String>();

        for (Id bookingId : bookingIds) {
            Test_Drive__c booking = [
                SELECT Customer_Name__c, Email__c, Mobile_Number__c,
                       Model_Interested__c, Test_Drive_Date_Time__c,
                       Drive_Type__c, Booking_Channel__c, Zip_Code__c,
                       Vehicle_Model__r.Name, Vehicle_Model__r.BodyType,
                       Vehicle_Model__r.AccelerationTime, Vehicle_Model__r.MaximumBatteryRange,
                       Vehicle_Model__r.TopSpeed, Vehicle_Model__r.TotalPower,
                       Vehicle_Model__r.BatteryCapacity, Vehicle_Model__r.DoorCount,
                       Assigned_Dealership__r.Name
                FROM Test_Drive__c
                WHERE Id = :bookingId
                LIMIT 1
            ];

            String model = booking.Model_Interested__c != null ? booking.Model_Interested__c : 'Unknown Model';
            String driveType = booking.Drive_Type__c != null ? booking.Drive_Type__c : 'Standard Drive';
            String channel = booking.Booking_Channel__c != null ? booking.Booking_Channel__c : 'Web Chat';

            String dateStr = booking.Test_Drive_Date_Time__c != null
                ? booking.Test_Drive_Date_Time__c.format('EEEE, MMMM d \'at\' h:mm a')
                : 'Date TBD';

            String phone = booking.Mobile_Number__c != null
                ? String.valueOf(booking.Mobile_Number__c.longValue())
                : 'Not provided';

            // Build the summary
            String summary = 'CUSTOMER INTELLIGENCE BRIEF\n';
            summary += '============================\n\n';
            summary += 'Customer: ' + booking.Customer_Name__c + ' (' + booking.Email__c + ' | ' + phone + ')\n';
            summary += 'Booking: ' + driveType + ' -- ' + model + '\n';
            summary += 'Date/Time: ' + dateStr + '\n';
            summary += 'Channel: ' + channel + '\n\n';

            // Vehicle insights
            summary += 'VEHICLE INSIGHTS:\n';
            summary += getVehicleInsights(model, booking.Vehicle_Model__r) + '\n\n';

            // Talking points
            summary += 'RECOMMENDED TALKING POINTS:\n';
            summary += getTalkingPoints(model) + '\n\n';

            // Preparation checklist
            summary += 'PREPARATION CHECKLIST:\n';
            summary += getChecklist(model, driveType);

            summaries.add(summary);
        }

        return summaries;
    }

    private static String getVehicleInsights(String model, VehicleDefinition vd) {
        if (vd == null || vd.Name == null) return '- Vehicle details pending';

        String insights = '';
        if (model.contains('GT')) {
            insights = '- High-performance electric sports car\n';
            insights += '- ' + safeStr(vd.AccelerationTime) + ', ' + safeStr(vd.TotalPower) + '\n';
            insights += '- ' + safeStr(vd.MaximumBatteryRange) + ' range, ' + safeStr(vd.BatteryCapacity) + ' battery\n';
            insights += '- 2-door sports configuration';
        } else if (model.contains('SUV')) {
            insights = '- Family-friendly electric SUV\n';
            insights += '- Seats 7, panoramic roof, advanced safety features\n';
            insights += '- ' + safeStr(vd.MaximumBatteryRange) + ' range, ' + safeStr(vd.TotalPower) + '\n';
            insights += '- Ideal for families and long road trips';
        } else if (model.contains('Sedan')) {
            insights = '- Luxury electric sedan\n';
            insights += '- Premium leather interior, Harman Kardon audio\n';
            insights += '- ' + safeStr(vd.MaximumBatteryRange) + ' range -- best in lineup\n';
            insights += '- ' + safeStr(vd.AccelerationTime) + ', ' + safeStr(vd.TotalPower);
        } else if (model.contains('Crossover')) {
            insights = '- Compact electric crossover -- best value in lineup\n';
            insights += '- ' + safeStr(vd.MaximumBatteryRange) + ' range, ' + safeStr(vd.TotalPower) + '\n';
            insights += '- Perfect city vehicle, easy to park\n';
            insights += '- Most affordable entry point to the Electra family';
        } else {
            insights = '- ' + safeStr(vd.BodyType) + ' | Range: ' + safeStr(vd.MaximumBatteryRange) + ' | Power: ' + safeStr(vd.TotalPower);
        }
        return insights;
    }

    private static String getTalkingPoints(String model) {
        if (model.contains('GT')) {
            return '- Demonstrate Track Mode and sport suspension\n' +
                   '- Highlight acceleration on highway on-ramp during test route\n' +
                   '- Compare favorably to Tesla Model S Plaid on range efficiency\n' +
                   '- Mention dual motor AWD performance in all weather conditions';
        } else if (model.contains('SUV')) {
            return '- Emphasize 7-seat configuration and cargo space\n' +
                   '- Demonstrate panoramic roof and family-friendly features\n' +
                   '- Highlight 350-mile range for road trips without range anxiety\n' +
                   '- Show advanced safety and driver assist features';
        } else if (model.contains('Sedan')) {
            return '- Showcase premium interior materials and craftsmanship\n' +
                   '- Demonstrate Harman Kardon audio system quality\n' +
                   '- Highlight 400-mile range -- longest in the Electra lineup\n' +
                   '- Emphasize quiet, refined driving experience';
        } else if (model.contains('Crossover')) {
            return '- Emphasize best value proposition in the EV market\n' +
                   '- Demonstrate easy maneuverability for city driving\n' +
                   '- Highlight 300-mile range for daily commute confidence\n' +
                   '- Show how compact size fits urban parking needs';
        }
        return '- Highlight key differentiators for this model\n- Discuss charging infrastructure and home charging options';
    }

    private static String getChecklist(String model, String driveType) {
        String checklist = '[ ] Vehicle charged to 100% and cleaned\n';
        if (driveType == 'Experience Drive') {
            checklist += '[ ] Delivery logistics confirmed with customer\n';
            checklist += '[ ] Delivery driver assigned and briefed\n';
            checklist += '[ ] Return pickup scheduled\n';
        } else {
            checklist += '[ ] Test drive route prepared\n';
        }
        checklist += '[ ] Customer file reviewed\n';
        checklist += '[ ] Financing/lease materials ready\n';
        checklist += '[ ] Follow-up appointment slot reserved';
        return checklist;
    }

    private static String safeStr(String val) {
        return val != null ? val : 'N/A';
    }
}
