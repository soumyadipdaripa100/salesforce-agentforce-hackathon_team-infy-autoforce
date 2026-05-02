/**
 * TD_Convert_Lead - Safely converts a Lead to Contact + Opportunity.
 * Called by TD_Auto_Create_Opportunity Flow when a Test_Drive__c outcome is Interested/Very Interested.
 * Uses Database.convertLead instead of Flow's LeadConvert action to avoid governor-limit edge cases.
 */
public with sharing class TD_Convert_Lead {

    public class ConvertRequest {
        @InvocableVariable(label='Lead Id' required=true
                           description='Id of the Lead record to convert')
        public Id leadId;

        @InvocableVariable(label='Opportunity Name'
                           description='Name for the created Opportunity. Defaults to Lead name + " Opportunity".')
        public String opportunityName;

        @InvocableVariable(label='Opportunity Amount'
                           description='Starting price for the Opportunity. If null, resolved from modelName.')
        public Decimal opportunityAmount;

        @InvocableVariable(label='Model Name'
                           description='Vehicle model name (Electra GT / SUV / Sedan / Crossover). Used to resolve a realistic Opportunity amount when opportunityAmount is null.')
        public String modelName;

        @InvocableVariable(label='Opportunity Owner Id'
                           description='User Id to own the created Opportunity. Defaults to the Lead owner.')
        public Id opportunityOwnerId;
    }

    // Model → starting price lookup. Lives in Apex (not CMDT) to keep the hackathon scope tight.
    // Keys are matched case-insensitively against Test_Drive__c.Model_Interested__c.
    private static final Map<String, Decimal> MODEL_PRICE = new Map<String, Decimal>{
        'electra gt'        => 85000,
        'electra suv'       => 72000,
        'electra sedan'     => 58000,
        'electra crossover' => 48000
    };
    private static final Decimal DEFAULT_MODEL_PRICE = 65000;

    @TestVisible
    private static Decimal resolveModelPrice(String modelName) {
        if (String.isBlank(modelName)) return DEFAULT_MODEL_PRICE;
        Decimal price = MODEL_PRICE.get(modelName.trim().toLowerCase());
        return price != null ? price : DEFAULT_MODEL_PRICE;
    }

    public class ConvertResult {
        @InvocableVariable(label='Success' description='True if conversion succeeded.')
        public Boolean success;

        @InvocableVariable(label='Contact Id' description='Id of the resulting Contact.')
        public String contactId;

        @InvocableVariable(label='Account Id' description='Id of the resulting Account.')
        public String accountId;

        @InvocableVariable(label='Opportunity Id' description='Id of the resulting Opportunity.')
        public String opportunityId;

        @InvocableVariable(label='Error Message' description='Populated when success = false.')
        public String errorMessage;
    }

    @InvocableMethod(label='Convert Test Drive Lead to Opportunity'
                     description='Converts a Lead to Contact + Opportunity. If the Lead is already converted, returns the existing Contact/Account/Opp references.')
    public static List<ConvertResult> convertLeads(List<ConvertRequest> requests) {
        List<ConvertResult> results = new List<ConvertResult>();

        // Need the 'Closed - Converted' master status
        String convertedStatus = 'Closed - Converted';
        List<LeadStatus> statuses = [SELECT MasterLabel FROM LeadStatus WHERE IsConverted = true LIMIT 1];
        if (!statuses.isEmpty()) convertedStatus = statuses[0].MasterLabel;

        for (ConvertRequest req : requests) {
            ConvertResult r = new ConvertResult();
            try {
                Lead l = [SELECT Id, IsConverted, ConvertedContactId, ConvertedAccountId, ConvertedOpportunityId, Name, OwnerId
                          FROM Lead WHERE Id = :req.leadId LIMIT 1];

                if (l.IsConverted) {
                    r.success = true;
                    r.contactId = l.ConvertedContactId;
                    r.accountId = l.ConvertedAccountId;
                    r.opportunityId = l.ConvertedOpportunityId;
                    results.add(r);
                    continue;
                }

                Database.LeadConvert lc = new Database.LeadConvert();
                lc.setLeadId(l.Id);
                lc.setConvertedStatus(convertedStatus);
                lc.setDoNotCreateOpportunity(false);
                String oppName = String.isNotBlank(req.opportunityName) ? req.opportunityName : (l.Name + ' Opportunity');
                lc.setOpportunityName(oppName);
                if (req.opportunityOwnerId != null) lc.setOwnerId(req.opportunityOwnerId);

                Database.LeadConvertResult lcr = Database.convertLead(lc);
                if (lcr.isSuccess()) {
                    r.success = true;
                    r.contactId = lcr.getContactId();
                    r.accountId = lcr.getAccountId();
                    r.opportunityId = lcr.getOpportunityId();
                    Decimal amt = req.opportunityAmount != null
                        ? req.opportunityAmount
                        : resolveModelPrice(req.modelName);
                    if (r.opportunityId != null) {
                        update new Opportunity(Id = r.opportunityId, Amount = amt);
                    }
                } else {
                    r.success = false;
                    r.errorMessage = String.join((List<String>)lcr.getErrors().get(0).getMessage().split('\\|'), '; ');
                }
            } catch (Exception e) {
                r.success = false;
                r.errorMessage = e.getMessage();
            }
            results.add(r);
        }

        return results;
    }
}
