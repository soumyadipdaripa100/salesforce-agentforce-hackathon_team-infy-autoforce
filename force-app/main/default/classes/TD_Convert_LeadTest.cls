@isTest
public class TD_Convert_LeadTest {

    @testSetup
    static void setup() {
        Lead l = new Lead(
            FirstName = 'Convert',
            LastName = 'Test',
            Company = 'Individual',
            Email = 'convert.test@example.com',
            LeadSource = 'Agentforce - Test Drive',
            Status = 'Open'
        );
        insert l;
    }

    @isTest
    static void testConvertLeadSuccess() {
        Lead l = [SELECT Id FROM Lead LIMIT 1];

        TD_Convert_Lead.ConvertRequest req = new TD_Convert_Lead.ConvertRequest();
        req.leadId = l.Id;
        req.opportunityName = 'Convert Test - Electra GT';
        req.opportunityAmount = 52000;

        Test.startTest();
        List<TD_Convert_Lead.ConvertResult> results = TD_Convert_Lead.convertLeads(
            new List<TD_Convert_Lead.ConvertRequest>{req}
        );
        Test.stopTest();

        System.assertEquals(true, results[0].success, 'Lead should convert successfully');
        System.assertNotEquals(null, results[0].opportunityId, 'Opportunity should be created');
        System.assertNotEquals(null, results[0].contactId, 'Contact should be created');

        Opportunity opp = [SELECT Name, Amount, StageName FROM Opportunity WHERE Id = :results[0].opportunityId];
        System.assertEquals(52000, opp.Amount, 'Amount should be set');
        System.assert(opp.Name.contains('Electra GT'), 'Name should include model');

        Lead converted = [SELECT IsConverted FROM Lead WHERE Id = :l.Id];
        System.assertEquals(true, converted.IsConverted, 'Lead flag flipped');
    }

    @isTest
    static void testConvertAlreadyConvertedLead() {
        Lead l = [SELECT Id FROM Lead LIMIT 1];

        // First conversion
        TD_Convert_Lead.ConvertRequest req1 = new TD_Convert_Lead.ConvertRequest();
        req1.leadId = l.Id;
        TD_Convert_Lead.convertLeads(new List<TD_Convert_Lead.ConvertRequest>{req1});

        // Second call on same lead should return existing IDs without error
        Test.startTest();
        TD_Convert_Lead.ConvertRequest req2 = new TD_Convert_Lead.ConvertRequest();
        req2.leadId = l.Id;
        List<TD_Convert_Lead.ConvertResult> results = TD_Convert_Lead.convertLeads(
            new List<TD_Convert_Lead.ConvertRequest>{req2}
        );
        Test.stopTest();

        System.assertEquals(true, results[0].success, 'Idempotent re-conversion should succeed');
        System.assertNotEquals(null, results[0].opportunityId, 'Should return existing Opp Id');
    }

    @isTest
    static void testResolveModelPriceAllModels() {
        System.assertEquals(85000, TD_Convert_Lead.resolveModelPrice('Electra GT'));
        System.assertEquals(72000, TD_Convert_Lead.resolveModelPrice('Electra SUV'));
        System.assertEquals(58000, TD_Convert_Lead.resolveModelPrice('Electra Sedan'));
        System.assertEquals(48000, TD_Convert_Lead.resolveModelPrice('Electra Crossover'));
        // Case-insensitive + whitespace trimming
        System.assertEquals(85000, TD_Convert_Lead.resolveModelPrice('  electra gt  '));
        System.assertEquals(72000, TD_Convert_Lead.resolveModelPrice('ELECTRA SUV'));
        // Unknown model → default
        System.assertEquals(65000, TD_Convert_Lead.resolveModelPrice('Electra Hypercar'));
        // Null / blank → default
        System.assertEquals(65000, TD_Convert_Lead.resolveModelPrice(null));
        System.assertEquals(65000, TD_Convert_Lead.resolveModelPrice('   '));
    }

    @isTest
    static void testConvertUsesModelPrice() {
        Lead l = [SELECT Id FROM Lead LIMIT 1];

        TD_Convert_Lead.ConvertRequest req = new TD_Convert_Lead.ConvertRequest();
        req.leadId = l.Id;
        req.opportunityName = 'Convert Test - Electra GT';
        req.modelName = 'Electra GT';
        // opportunityAmount intentionally null — should fall back to model-based price

        Test.startTest();
        List<TD_Convert_Lead.ConvertResult> results = TD_Convert_Lead.convertLeads(
            new List<TD_Convert_Lead.ConvertRequest>{req}
        );
        Test.stopTest();

        System.assertEquals(true, results[0].success);
        Opportunity opp = [SELECT Amount FROM Opportunity WHERE Id = :results[0].opportunityId];
        System.assertEquals(85000, opp.Amount, 'Amount should resolve from Electra GT model');
    }

    @isTest
    static void testConvertExplicitAmountOverridesModel() {
        Lead l = [SELECT Id FROM Lead LIMIT 1];

        TD_Convert_Lead.ConvertRequest req = new TD_Convert_Lead.ConvertRequest();
        req.leadId = l.Id;
        req.opportunityName = 'Convert Test - Override';
        req.modelName = 'Electra GT';            // would resolve to 85000
        req.opportunityAmount = 99000;           // explicit override wins

        Test.startTest();
        List<TD_Convert_Lead.ConvertResult> results = TD_Convert_Lead.convertLeads(
            new List<TD_Convert_Lead.ConvertRequest>{req}
        );
        Test.stopTest();

        Opportunity opp = [SELECT Amount FROM Opportunity WHERE Id = :results[0].opportunityId];
        System.assertEquals(99000, opp.Amount, 'Explicit opportunityAmount should win over model lookup');
    }

    @isTest
    static void testConvertInvalidLeadId() {
        TD_Convert_Lead.ConvertRequest req = new TD_Convert_Lead.ConvertRequest();
        req.leadId = '00Q000000000000'; // fake Id

        Test.startTest();
        List<TD_Convert_Lead.ConvertResult> results = TD_Convert_Lead.convertLeads(
            new List<TD_Convert_Lead.ConvertRequest>{req}
        );
        Test.stopTest();

        System.assertEquals(false, results[0].success, 'Invalid Id should fail gracefully');
        System.assertNotEquals(null, results[0].errorMessage, 'Error should be populated');
    }
}
