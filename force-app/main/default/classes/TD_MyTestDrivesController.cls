/**
 * TD_MyTestDrivesController - Apex controller for Subhranil's electraMyTestDrives LWC
 * Returns test drive bookings for the logged-in customer (matched by email)
 */
public with sharing class TD_MyTestDrivesController {

    @AuraEnabled(cacheable=true)
    public static List<Test_Drive__c> getMyTestDrives(String email) {
        if (String.isBlank(email)) {
            return new List<Test_Drive__c>();
        }
        return [
            SELECT Id, Name, Customer_Name__c, Email__c,
                   Vehicle_Model__r.Name, Vehicle_Model__r.BodyType,
                   Vehicle_Model__r.MaximumBatteryRange,
                   Test_Drive_Date_Time__c, Model_Interested__c,
                   Assigned_Dealership__r.Name,
                   Assigned_Dealership__r.BillingStreet,
                   Assigned_Dealership__r.BillingCity,
                   Assigned_Dealership__r.BillingState,
                   Status__c, Drive_Type__c, Booking_Channel__c
            FROM Test_Drive__c
            WHERE Email__c = :email
            WITH SECURITY_ENFORCED
            ORDER BY Test_Drive_Date_Time__c DESC
            LIMIT 50
        ];
    }
}
