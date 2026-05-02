/**
 * TD_DealerLocatorController - feeds the electraDealerLocator LWC.
 * Returns active Dealership_Location__c records with parent Account context.
 */
public without sharing class TD_DealerLocatorController {

    @AuraEnabled(cacheable=true)
    public static List<DealerResult> getActiveDealers() {
        List<DealerResult> out = new List<DealerResult>();
        for (Dealership_Location__c d : [
            SELECT Id, Name,
                   Dealer_Account__c, Dealer_Account__r.Name,
                   Dealer_Account__r.BillingStreet, Dealer_Account__r.BillingCity,
                   Dealer_Account__r.BillingState, Dealer_Account__r.BillingPostalCode,
                   Address__c, City__c, State__c, Zip_Code__c,
                   Zip_Codes_Served__c, Phone__c,
                   Latitude__c, Longitude__c, Is_Active__c
            FROM Dealership_Location__c
            WHERE Is_Active__c = true
            WITH SYSTEM_MODE
            ORDER BY Name ASC
            LIMIT 200
        ]) {
            DealerResult r = new DealerResult();
            r.id = d.Id;
            r.name = d.Name;
            r.accountId = d.Dealer_Account__c;
            r.accountName = d.Dealer_Account__r != null ? d.Dealer_Account__r.Name : null;
            r.address = String.isNotBlank(d.Address__c)
                ? d.Address__c
                : (d.Dealer_Account__r != null ? d.Dealer_Account__r.BillingStreet : null);
            r.city = String.isNotBlank(d.City__c)
                ? d.City__c
                : (d.Dealer_Account__r != null ? d.Dealer_Account__r.BillingCity : null);
            r.state = String.isNotBlank(d.State__c)
                ? d.State__c
                : (d.Dealer_Account__r != null ? d.Dealer_Account__r.BillingState : null);
            r.zipCode = d.Zip_Code__c;
            r.zipsServed = d.Zip_Codes_Served__c;
            r.phone = d.Phone__c;
            r.latitude = d.Latitude__c;
            r.longitude = d.Longitude__c;
            out.add(r);
        }
        return out;
    }

    public class DealerResult {
        @AuraEnabled public String id;
        @AuraEnabled public String name;
        @AuraEnabled public String accountId;
        @AuraEnabled public String accountName;
        @AuraEnabled public String address;
        @AuraEnabled public String city;
        @AuraEnabled public String state;
        @AuraEnabled public String zipCode;
        @AuraEnabled public String zipsServed;
        @AuraEnabled public String phone;
        @AuraEnabled public Decimal latitude;
        @AuraEnabled public Decimal longitude;
    }
}