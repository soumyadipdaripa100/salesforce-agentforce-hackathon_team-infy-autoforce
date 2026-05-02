import { LightningElement, api } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import captureOutcome from '@salesforce/apex/TD_DealerConsoleController.captureOutcome';

const OUTCOME_OPTIONS = [
    { label: 'Very Interested', value: 'Very Interested' },
    { label: 'Interested', value: 'Interested' },
    { label: 'Undecided', value: 'Undecided' },
    { label: 'Not Interested', value: 'Not Interested' }
];

const NEXT_ACTION_OPTIONS = [
    { label: 'Send Quote', value: 'Send Quote' },
    { label: 'Send Brochure', value: 'Send Brochure' },
    { label: 'Schedule Follow-up', value: 'Schedule Follow-up' },
    { label: 'Schedule Second Drive', value: 'Schedule Second Drive' },
    { label: 'None', value: 'None' }
];

export default class ElectraDealerOutcomeModal extends LightningElement {
    @api bookingId;
    @api customerName;
    @api vehicleModel;

    outcome = 'Interested';
    notes = '';
    nextAction = 'Send Quote';
    competitor = '';
    saving = false;

    outcomeOptions = OUTCOME_OPTIONS;
    nextActionOptions = NEXT_ACTION_OPTIONS;

    get showOpportunityBanner() {
        return this.outcome === 'Very Interested' || this.outcome === 'Interested';
    }

    get saveDisabled() {
        return this.saving || !this.outcome;
    }

    handleOutcome(e) { this.outcome = e.detail.value; }
    handleNotes(e) { this.notes = e.detail.value; }
    handleNextAction(e) { this.nextAction = e.detail.value; }
    handleCompetitor(e) { this.competitor = e.detail.value; }

    handleCancel() {
        this.dispatchEvent(new CustomEvent('cancel'));
    }

    async handleSave() {
        this.saving = true;
        try {
            await captureOutcome({
                bookingId: this.bookingId,
                outcome: this.outcome,
                notes: this.notes,
                nextAction: this.nextAction,
                competitor: this.competitor
            });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Outcome captured',
                message: this.showOpportunityBanner
                    ? 'Opportunity will be auto-created within a few seconds.'
                    : 'Outcome recorded.',
                variant: 'success'
            }));
            this.dispatchEvent(new CustomEvent('save', {
                detail: {
                    bookingId: this.bookingId,
                    outcome: this.outcome,
                    nextAction: this.nextAction
                }
            }));
        } catch (err) {
            const msg = err && err.body && err.body.message ? err.body.message : (err.message || 'Save failed');
            this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: msg, variant: 'error' }));
        } finally {
            this.saving = false;
        }
    }

    stopPropagation(e) { e.stopPropagation(); }
}