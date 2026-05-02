/**
 * TD_AgentHelper - Invocable methods for Agentforce Test Drive actions
 * Handles dealership routing logic with zip code matching and fallback
 */
public with sharing class TD_AgentHelper {

    @InvocableMethod(label='Find Nearest Dealership'
                     description='Finds the nearest active dealership for a given zip code. Returns dealership details or a not-found message.')
    public static List<DealerResult> findDealership(List<String> zipCodes) {
        // Query all active locations once (Long Text Area can't be filtered in SOQL)
        List<Dealership_Location__c> allLocations = [
            SELECT Id, Name, Dealer_Account__c, Address__c, Phone__c, City__c, State__c,
                   Zip_Code__c, Zip_Codes_Served__c
            FROM Dealership_Location__c
            WHERE Is_Active__c = true
        ];

        List<DealerResult> results = new List<DealerResult>();

        for (String zip : zipCodes) {
            DealerResult result = new DealerResult();
            Boolean matched = false;

            // Try exact zip match in Zip_Codes_Served__c (comma-separated list)
            for (Dealership_Location__c loc : allLocations) {
                if (loc.Zip_Codes_Served__c != null && loc.Zip_Codes_Served__c.contains(zip)) {
                    populateResult(result, loc);
                    matched = true;
                    break;
                }
            }

            // Fallback: try first 3 digits of zip (broader area match)
            if (!matched) {
                String zipPrefix = zip.length() >= 3 ? zip.substring(0, 3) : zip;
                for (Dealership_Location__c loc : allLocations) {
                    if (loc.Zip_Code__c != null && loc.Zip_Code__c.startsWith(zipPrefix)) {
                        populateResult(result, loc);
                        matched = true;
                        break;
                    }
                }
            }

            // Fallback: if no match, return first active dealer as default fulfilling center (critical for Experience Drive out-of-area)
            if (!matched && !allLocations.isEmpty()) {
                populateResult(result, allLocations[0]);
                result.found = false; // signal "no local dealer" but still provide a fulfilling one
                result.dealershipName = allLocations[0].Name + ' (no local dealer for ' + zip + ' — defaulting to nearest Bay Area dealer for Experience Drive fulfillment)';
            }

            if (!matched && allLocations.isEmpty()) {
                result.found = false;
                result.dealershipName = 'No active dealerships configured.';
            }

            results.add(result);
        }

        return results;
    }

    private static void populateResult(DealerResult result, Dealership_Location__c loc) {
        result.dealershipId = loc.Dealer_Account__c;
        result.dealershipName = loc.Name;
        result.address = loc.Address__c;
        result.phone = loc.Phone__c;
        result.city = loc.City__c;
        result.state = loc.State__c;
        result.found = true;
    }

    public class DealerResult {
        @InvocableVariable(label='Dealership Account Id' description='Account Id of the matched dealership')
        public String dealershipId;

        @InvocableVariable(label='Dealership Name' description='Name of the matched dealership')
        public String dealershipName;

        @InvocableVariable(label='Address' description='Full street address of the dealership')
        public String address;

        @InvocableVariable(label='Phone' description='Phone number of the dealership')
        public String phone;

        @InvocableVariable(label='City' description='City where the dealership is located')
        public String city;

        @InvocableVariable(label='State' description='State where the dealership is located')
        public String state;

        @InvocableVariable(label='Found' description='Whether a dealership was found for the given zip code')
        public Boolean found;
    }
}
