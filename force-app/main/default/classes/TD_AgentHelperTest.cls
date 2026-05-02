@isTest
public class TD_AgentHelperTest {

    @testSetup
    static void setupData() {
        Account dealer1 = new Account(
            Name = 'Test Dealer SF',
            BillingCity = 'San Francisco',
            BillingState = 'CA',
            BillingPostalCode = '94105',
            Industry = 'Automotive'
        );
        Account dealer2 = new Account(
            Name = 'Test Dealer Oakland',
            BillingCity = 'Oakland',
            BillingState = 'CA',
            BillingPostalCode = '94607',
            Industry = 'Automotive'
        );
        insert new List<Account>{ dealer1, dealer2 };

        Dealership_Location__c loc1 = new Dealership_Location__c(
            Name = 'Test Downtown SF',
            Dealer_Account__c = dealer1.Id,
            Zip_Code__c = '94105',
            Zip_Codes_Served__c = '94101,94102,94103,94104,94105,94107,94108',
            City__c = 'San Francisco',
            State__c = 'CA',
            Address__c = '123 Market St, San Francisco, CA 94105',
            Phone__c = '(415) 555-0001',
            Is_Active__c = true
        );
        Dealership_Location__c loc2 = new Dealership_Location__c(
            Name = 'Test East Bay',
            Dealer_Account__c = dealer2.Id,
            Zip_Code__c = '94607',
            Zip_Codes_Served__c = '94601,94602,94603,94605,94606,94607,94608',
            City__c = 'Oakland',
            State__c = 'CA',
            Address__c = '500 Broadway, Oakland, CA 94607',
            Phone__c = '(510) 555-0002',
            Is_Active__c = true
        );
        insert new List<Dealership_Location__c>{ loc1, loc2 };
    }

    @isTest
    static void testExactZipMatch() {
        List<TD_AgentHelper.DealerResult> results =
            TD_AgentHelper.findDealership(new List<String>{ '94105' });

        System.assertEquals(1, results.size(), 'Should return one result');
        System.assertEquals(true, results[0].found, 'Should find dealership for exact zip');
        System.assertEquals('Test Downtown SF', results[0].dealershipName);
        System.assertNotEquals(null, results[0].address, 'Address should be populated');
        System.assertNotEquals(null, results[0].phone, 'Phone should be populated');
    }

    @isTest
    static void testZipInServedRange() {
        List<TD_AgentHelper.DealerResult> results =
            TD_AgentHelper.findDealership(new List<String>{ '94107' });

        System.assertEquals(true, results[0].found, 'Should find dealership for zip in served range');
        System.assertEquals('Test Downtown SF', results[0].dealershipName);
    }

    @isTest
    static void testDifferentDealership() {
        List<TD_AgentHelper.DealerResult> results =
            TD_AgentHelper.findDealership(new List<String>{ '94607' });

        System.assertEquals(true, results[0].found, 'Should find Oakland dealership');
        System.assertEquals('Test East Bay', results[0].dealershipName);
        System.assertEquals('Oakland', results[0].city);
    }

    @isTest
    static void testPartialZipFallback() {
        // 94199 isn't in any served range, but 941xx prefix matches SF dealer
        List<TD_AgentHelper.DealerResult> results =
            TD_AgentHelper.findDealership(new List<String>{ '94199' });

        System.assertEquals(true, results[0].found, 'Should find via partial zip fallback');
    }

    @isTest
    static void testNoMatch() {
        List<TD_AgentHelper.DealerResult> results =
            TD_AgentHelper.findDealership(new List<String>{ '99999' });

        System.assertEquals(false, results[0].found, 'Should not find dealership for unknown zip');
        System.assert(results[0].dealershipName.contains('No dealership found'),
            'Should return not-found message');
    }

    @isTest
    static void testMultipleZipCodes() {
        List<TD_AgentHelper.DealerResult> results =
            TD_AgentHelper.findDealership(new List<String>{ '94105', '94607', '99999' });

        System.assertEquals(3, results.size(), 'Should return result for each zip');
        System.assertEquals(true, results[0].found);
        System.assertEquals(true, results[1].found);
        System.assertEquals(false, results[2].found);
    }
}
