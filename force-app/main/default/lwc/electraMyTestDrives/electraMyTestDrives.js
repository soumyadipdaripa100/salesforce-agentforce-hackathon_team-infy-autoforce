import { LightningElement, wire } from 'lwc';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { loadStyle } from 'lightning/platformResourceLoader';
import USER_ID from '@salesforce/user/Id';
import EMAIL_FIELD from '@salesforce/schema/User.Email';
import getMyTestDrives from '@salesforce/apex/TD_MyTestDrivesController.getMyTestDrives';
import { openChat } from 'c/electraChatBridge';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const STATUS_CLASS = {
    Scheduled: 'status status--confirmed',
    Confirmed: 'status status--confirmed',
    Inprogress: 'status status--inprogress',
    'In Progress': 'status status--inprogress',
    Completed: 'status status--completed',
    Cancelled: 'status status--cancelled',
    'No-Show': 'status status--noshow'
};

export default class ElectraMyTestDrives extends LightningElement {
    userEmail;
    drives;
    loadError;

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    @wire(getRecord, { recordId: USER_ID, fields: [EMAIL_FIELD] })
    wiredUser({ data }) {
        if (data) {
            this.userEmail = getFieldValue(data, EMAIL_FIELD);
        }
    }

    @wire(getMyTestDrives, { email: '$userEmail' })
    wiredDrives({ data, error }) {
        if (data) {
            this.drives = data.map((d) => this.decorate(d));
            this.loadError = undefined;
        } else if (error) {
            this.loadError = error;
            this.drives = [];
        }
    }

    decorate(record) {
        const status = record.Status__c || '';
        const dealership = record.Assigned_Dealership__r || {};
        const vehicle = record.Vehicle_Model__r || {};
        const modelName = vehicle.Name || record.Model_Interested__c || 'Electra';
        const addressLine = [dealership.BillingStreet, dealership.BillingCity, dealership.BillingState]
            .filter(Boolean)
            .join(', ');
        const isActionable = status === 'Scheduled' || status === 'Confirmed';
        return {
            ...record,
            modelName,
            bodyType: vehicle.BodyType || '',
            dealershipName: dealership.Name || '',
            addressLine,
            statusClass: STATUS_CLASS[status] || 'status',
            actionable: isActionable
        };
    }

    get hasDrives() {
        return Array.isArray(this.drives) && this.drives.length > 0;
    }

    get isEmpty() {
        return Array.isArray(this.drives) && this.drives.length === 0 && !this.loadError;
    }

    get isLoading() {
        return this.userEmail && this.drives === undefined && !this.loadError;
    }

    handleBookNew() {
        openChat({ source: 'portal-empty-state' });
    }

    handleReschedule(event) {
        const name = event.currentTarget.dataset.name;
        openChat({ source: 'portal-reschedule', bookingName: name, intent: 'reschedule' });
    }

    handleCancel(event) {
        const name = event.currentTarget.dataset.name;
        const ok = window.confirm(`Cancel test drive ${name}? An agent will confirm the cancellation.`);
        if (ok) {
            openChat({ source: 'portal-cancel', bookingName: name, intent: 'cancel' });
        }
    }
}