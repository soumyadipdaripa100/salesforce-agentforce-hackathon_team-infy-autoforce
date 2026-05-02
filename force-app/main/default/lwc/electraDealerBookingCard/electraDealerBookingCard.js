import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import updateBookingStatus from '@salesforce/apex/TD_DealerConsoleController.updateBookingStatus';
import getIntelBrief from '@salesforce/apex/TD_DealerConsoleController.getIntelBrief';

const NEXT_STATUS = {
    'Scheduled':   { label: 'Mark Arrived', value: 'Arrived',     variant: 'brand' },
    'Confirmed':   { label: 'Mark Arrived', value: 'Arrived',     variant: 'brand' },
    'Arrived':     { label: 'Start Drive',  value: 'In Progress', variant: 'brand' },
    'In Progress': { label: 'End Drive',    value: 'Completed',   variant: 'destructive' }
};

const BADGE_THEME = {
    'Scheduled':   'slds-theme_inverse',
    'Confirmed':   'slds-theme_inverse',
    'Arrived':     'slds-theme_success',
    'In Progress': 'slds-theme_warning',
    'Completed':   'slds-theme_success',
    'No-Show':     'slds-theme_error',
    'Cancelled':   'slds-theme_offline'
};

export default class ElectraDealerBookingCard extends NavigationMixin(LightningElement) {
    @api booking;

    // Feature flag — when true, "Capture Outcome" launches the OmniStudio OmniScript
    // OS_CapturePostDriveOutcome instead of the inline LWC modal.
    // Flip to true in Lightning App Builder (or via the EC page property) once
    // Saumyadeep activates OS_CapturePostDriveOutcome in OmniStudio UI.
    @api useOmniScript = false;

    // The OmniScript identifier (Type/SubType/Lang triplet) — tweak only if Saumyadeep
    // named the OmniScript differently than the build spec.
    @api omniScriptType = 'Capture';
    @api omniScriptSubType = 'PostDriveOutcome';
    @api omniScriptLanguage = 'English';

    expanded = false;
    brief;
    briefLoading = false;
    busy = false;

    get status() { return this.booking?.Status__c || 'Unknown'; }
    get customerName() { return this.booking?.Customer_Name__c || 'Unknown Customer'; }
    get model() { return this.booking?.Model_Interested__c || this.booking?.Vehicle_Model__r?.Name || 'Vehicle TBD'; }
    get driveType() { return this.booking?.Drive_Type__c || 'Standard Drive'; }
    get timeLabel() {
        const dt = this.booking?.Test_Drive_Date_Time__c;
        if (!dt) return 'Time TBD';
        try {
            const d = new Date(dt);
            return d.toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
        } catch (e) { return dt; }
    }
    get contactLine() {
        const parts = [];
        if (this.booking?.Email__c) parts.push(this.booking.Email__c);
        if (this.booking?.Mobile_Number__c) parts.push(String(this.booking.Mobile_Number__c));
        return parts.join(' · ');
    }

    get badgeClass() {
        return `slds-badge ${BADGE_THEME[this.status] || 'slds-theme_offline'}`;
    }

    get hasPrimaryAction() {
        return !!NEXT_STATUS[this.status];
    }
    get primaryLabel() { return NEXT_STATUS[this.status]?.label; }
    get primaryVariant() { return NEXT_STATUS[this.status]?.variant || 'brand'; }

    get needsOutcome() {
        return this.status === 'Completed' && !this.booking?.Outcome__c;
    }

    get outcomeLine() {
        if (!this.booking?.Outcome__c) return null;
        let line = `Outcome: ${this.booking.Outcome__c}`;
        if (this.booking.Next_Action__c) line += ` · Next: ${this.booking.Next_Action__c}`;
        if (this.booking.Competitor_Considered__c) line += ` · vs ${this.booking.Competitor_Considered__c}`;
        return line;
    }

    get durationLine() {
        const mins = this.booking?.Drive_Duration_Minutes__c;
        return mins ? `Drive duration: ${Math.round(mins)} min` : null;
    }

    get expandToggleLabel() {
        return this.expanded ? 'Hide intel brief' : 'Show intel brief';
    }

    async toggleBrief() {
        this.expanded = !this.expanded;
        if (this.expanded && !this.brief && this.booking?.Id) {
            this.briefLoading = true;
            try {
                this.brief = await getIntelBrief({ bookingId: this.booking.Id });
            } catch (err) {
                this.brief = 'Intel brief unavailable.';
            } finally {
                this.briefLoading = false;
            }
        }
    }

    async handlePrimary() {
        const next = NEXT_STATUS[this.status];
        if (!next) return;
        this.busy = true;
        try {
            await updateBookingStatus({ bookingId: this.booking.Id, newStatus: next.value });
            this.dispatchEvent(new ShowToastEvent({
                title: 'Updated',
                message: `${this.customerName} → ${next.value}`,
                variant: 'success'
            }));
            this.dispatchEvent(new CustomEvent('statuschange', {
                detail: { bookingId: this.booking.Id, newStatus: next.value },
                bubbles: true, composed: true
            }));
        } catch (err) {
            const msg = err?.body?.message || err?.message || 'Status update failed';
            this.dispatchEvent(new ShowToastEvent({ title: 'Error', message: msg, variant: 'error' }));
        } finally {
            this.busy = false;
        }
    }

    handleCaptureOutcome() {
        if (this.useOmniScript) {
            this.launchOmniScript();
            return;
        }
        this.dispatchEvent(new CustomEvent('captureoutcome', {
            detail: {
                bookingId: this.booking.Id,
                customerName: this.customerName,
                vehicleModel: this.model
            },
            bubbles: true, composed: true
        }));
    }

    launchOmniScript() {
        // Launches the OmniStudio OmniScript via a standard webPage navigation.
        // URL format: /omnistudio/omniscriptbuilder/index.html?omniScriptId=<type/subtype/lang>&ContextId=<bookingId>
        // OmniStudio runtime reads ContextId from URL + populates the context variable `bookingId`.
        const key = `${this.omniScriptType}/${this.omniScriptSubType}/${this.omniScriptLanguage}`;
        const url = `/apex/omnistudio__OmniLwcDirectRuntime`
            + `?id=${encodeURIComponent(key)}`
            + `&bookingId=${encodeURIComponent(this.booking.Id)}`;
        this[NavigationMixin.Navigate]({
            type: 'standard__webPage',
            attributes: { url }
        });
    }
}