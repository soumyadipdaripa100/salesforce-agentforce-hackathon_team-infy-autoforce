/**
 * TD_GetShowrooms - Agent Action: Returns the four fixed Electra showroom Accounts.
 *
 * Hardcoded to the canonical dealer Account Ids so the agent always gets a
 * deterministic, parseable list. The agent extracts the Account Id from each
 * line and passes it into Check Available Slots / Create Test Drive Booking.
 */
public with sharing class TD_GetShowrooms {

    private static final List<Id> SHOWROOM_IDS = new List<Id>{
        '001bm00001iMVjGAAW',
        '001bm00001iMVjFAAW',
        '001bm00001iMVjHAAW',
        '001bm00001iMVjIAAW'
    };

    public class ShowroomResult {
        @InvocableVariable(label='Showroom List'
                          description='Formatted multi-line list of showrooms. Each line includes the showroom name, account id, city/state, zip and phone.')
        public String showroomList;

        @InvocableVariable(label='Showroom Count'
                          description='Number of showrooms returned.')
        public Integer count;

        @InvocableVariable(label='Has Showrooms'
                          description='True if at least one showroom was found.')
        public Boolean hasResults;
    }

    @InvocableMethod(label='Get Showrooms'
                     description='Returns the four Electra showroom Accounts (name, account id, city, state, zip, phone). No filters.')
    public static List<ShowroomResult> getShowrooms(List<String> dummyInputs) {
        ShowroomResult result = new ShowroomResult();

        List<Account> accs = [
            SELECT Id, Name, BillingStreet, BillingCity, BillingState, BillingPostalCode, Phone
            FROM Account
            WHERE Id IN :SHOWROOM_IDS
            WITH SYSTEM_MODE
            ORDER BY Name ASC
        ];

        if (accs.isEmpty()) {
            result.showroomList = 'No showrooms found.';
            result.count = 0;
            result.hasResults = false;
        } else {
            List<String> lines = new List<String>();
            Integer idx = 1;
            for (Account a : accs) {
                String line = idx + '. ' + a.Name +
                    ' (Id: ' + a.Id + ')' +
                    ' — ' + safe(a.BillingCity) + ', ' + safe(a.BillingState) + ' ' + safe(a.BillingPostalCode) +
                    ' — Phone: ' + safe(a.Phone);
                lines.add(line);
                idx++;
            }
            result.showroomList = String.join(lines, '\n');
            result.count = accs.size();
            result.hasResults = true;
        }

        // @InvocableMethod returns one result per request element.
        Integer reqCount = (dummyInputs != null && !dummyInputs.isEmpty()) ? dummyInputs.size() : 1;
        List<ShowroomResult> out = new List<ShowroomResult>();
        for (Integer i = 0; i < reqCount; i++) out.add(result);
        return out;
    }

    private static String safe(String val) {
        return String.isNotBlank(val) ? val : 'N/A';
    }
}