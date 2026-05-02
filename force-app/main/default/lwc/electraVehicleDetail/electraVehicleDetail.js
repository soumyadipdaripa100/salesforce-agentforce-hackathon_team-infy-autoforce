import { LightningElement, api, wire } from 'lwc';
import { CurrentPageReference, NavigationMixin } from 'lightning/navigation';
import { getRecord, getFieldValue } from 'lightning/uiRecordApi';
import { loadStyle } from 'lightning/platformResourceLoader';
import { openChat } from 'c/electraChatBridge';
import FONTS from '@salesforce/resourceUrl/electraFonts';

import NAME_FIELD from '@salesforce/schema/VehicleDefinition.Name';
import BODY_FIELD from '@salesforce/schema/VehicleDefinition.BodyType';
import FUEL_FIELD from '@salesforce/schema/VehicleDefinition.FuelSource';
import ACC_FIELD from '@salesforce/schema/VehicleDefinition.AccelerationTime';
import RANGE_FIELD from '@salesforce/schema/VehicleDefinition.MaximumBatteryRange';
import BATTERY_FIELD from '@salesforce/schema/VehicleDefinition.BatteryCapacity';
import TOPSPEED_FIELD from '@salesforce/schema/VehicleDefinition.TopSpeed';
import POWER_FIELD from '@salesforce/schema/VehicleDefinition.TotalPower';
import DOORS_FIELD from '@salesforce/schema/VehicleDefinition.DoorCount';

const FIELDS = [
    NAME_FIELD, BODY_FIELD, FUEL_FIELD, ACC_FIELD, RANGE_FIELD,
    BATTERY_FIELD, TOPSPEED_FIELD, POWER_FIELD, DOORS_FIELD
];

const DESCRIPTIONS = {
    'Electra GT': 'Born on the track, built for the road. The GT delivers breathtaking acceleration with zero emissions.',
    'Electra SUV': 'Adventure meets sustainability. Room for the whole family with best-in-class electric range.',
    'Electra Sedan': 'Luxury redefined. Whisper-quiet performance with the longest range in its class.',
    'Electra Crossover': 'The perfect entry into electric. Versatile, efficient, and unmistakably Electra.'
};

// Normalize spec strings from the org — e.g. "3.2 seconds (0-60 mph)" -> "3.2s"
function tightSeconds(value) {
    if (!value && value !== 0) return value;
    return String(value).replace(/\bseconds?\b.*$/i, 's').replace(/\s+/g, ' ').trim();
}

export default class ElectraVehicleDetail extends NavigationMixin(LightningElement) {
    @api recordId;
    urlRecordId;
    error;

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    @wire(CurrentPageReference)
    wiredPageRef(pageRef) {
        if (pageRef && pageRef.state && pageRef.state.recordId) {
            this.urlRecordId = pageRef.state.recordId;
        }
    }

    get effectiveRecordId() {
        return this.recordId || this.urlRecordId;
    }

    @wire(getRecord, { recordId: '$effectiveRecordId', fields: FIELDS })
    record;

    get loaded() {
        return this.record && this.record.data;
    }

    get loading() {
        return Boolean(this.effectiveRecordId) && !this.loaded && !this.record?.error;
    }

    get name() { return getFieldValue(this.record.data, NAME_FIELD); }
    get body() { return getFieldValue(this.record.data, BODY_FIELD); }
    get fuel() { return getFieldValue(this.record.data, FUEL_FIELD); }
    get acceleration() { return tightSeconds(getFieldValue(this.record.data, ACC_FIELD)); }
    get range() { return getFieldValue(this.record.data, RANGE_FIELD); }
    get battery() { return getFieldValue(this.record.data, BATTERY_FIELD); }
    get topSpeed() { return getFieldValue(this.record.data, TOPSPEED_FIELD); }
    get power() { return getFieldValue(this.record.data, POWER_FIELD); }
    get doors() { return getFieldValue(this.record.data, DOORS_FIELD); }

    get description() {
        return DESCRIPTIONS[this.name] || '';
    }

    handleBook() {
        openChat({ model: this.name, source: 'vehicle-detail' });
    }

    handleExperience() {
        this[NavigationMixin.Navigate]({
            type: 'comm__namedPage',
            attributes: { name: 'experience-drive__c' }
        });
    }
}