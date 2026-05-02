import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { loadStyle } from 'lightning/platformResourceLoader';
import getMyDealerContext from '@salesforce/apex/TD_DealerConsoleController.getMyDealerContext';
import getMyCustomerBase from '@salesforce/apex/TD_DealerConsoleController.getMyCustomerBase';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const STATUS_FILTERS = [
    { id: 'all',         label: 'All' },
    { id: 'scheduled',   label: 'Scheduled',   match: ['Scheduled'] },
    { id: 'confirmed',   label: 'Confirmed',   match: ['Confirmed'] },
    { id: 'in-progress', label: 'In progress', match: ['Arrived', 'In Progress', 'Inprogress'] },
    { id: 'completed',   label: 'Completed',   match: ['Completed'] },
    { id: 'lost',        label: 'Lost',        match: ['Cancelled', 'No-Show'] }
];

function normalizeStatus(raw) {
    if (!raw) return 'Scheduled';
    if (raw === 'Inprogress') return 'In Progress';
    return raw;
}

function statusPillClass(status) {
    if (!status) return 'pill pill--scheduled';
    const s = status.toLowerCase();
    if (s.includes('cancel')) return 'pill pill--cancelled';
    if (s.includes('no-show') || s.includes('noshow')) return 'pill pill--noshow';
    if (s.includes('completed')) return 'pill pill--completed';
    if (s.includes('progress')) return 'pill pill--active';
    if (s.includes('arrived')) return 'pill pill--active';
    if (s.includes('confirmed')) return 'pill pill--confirmed';
    return 'pill pill--scheduled';
}

function avatarTone(seed) {
    const tones = ['t1', 't2', 't3', 't4', 't5'];
    if (!seed) return tones[0];
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
    return tones[h % tones.length];
}

function initials(name) {
    if (!name) return 'GU';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'GU';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch (e) { return ''; }
}

function formatTime(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    } catch (e) { return ''; }
}

function extractError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.body && err.body.message) return err.body.message;
    if (err.message) return err.message;
    return JSON.stringify(err);
}

export default class ElectraCustomerBase extends LightningElement {
    @api pageTitle = 'Customer Base';

    @track context;
    @track contextError;
    @track records = [];
    @track loadError;

    @track searchTerm = '';
    @track activeFilter = 'all';

    contextResult;
    recordsResult;
    _fontsLoaded = false;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
    }

    @wire(getMyDealerContext)
    wiredContext(result) {
        this.contextResult = result;
        if (result.data) {
            this.context = result.data;
            this.contextError = undefined;
        } else if (result.error) {
            this.context = undefined;
            this.contextError = extractError(result.error);
        }
    }

    @wire(getMyCustomerBase)
    wiredRecords(result) {
        this.recordsResult = result;
        if (result.data) {
            this.records = result.data;
            this.loadError = undefined;
        } else if (result.error) {
            this.loadError = extractError(result.error);
        }
    }

    // ---------- State getters ----------

    get hasContext() { return !!(this.context && this.context.dealerAccountId); }
    get noDealerLink() { return !!this.contextError; }
    get dealerName() { return this.context ? this.context.dealerName : 'Electra Dealer'; }
    get dealerCity() { return this.context && this.context.dealerCity ? this.context.dealerCity : ''; }

    // ---------- Filter chips ----------

    get filterChips() {
        return STATUS_FILTERS.map((f) => ({
            ...f,
            className: f.id === this.activeFilter ? 'chip chip--active' : 'chip'
        }));
    }

    handleFilterClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id) this.activeFilter = id;
    }

    handleSearch(event) {
        this.searchTerm = (event.target.value || '').trim().toLowerCase();
    }

    handleClearSearch() {
        this.searchTerm = '';
        const input = this.template.querySelector('input.search__input');
        if (input) input.value = '';
    }

    // ---------- Filtered + decorated rows ----------

    get rows() {
        const search = this.searchTerm;
        const filter = STATUS_FILTERS.find((f) => f.id === this.activeFilter);
        const matchSet = filter && filter.match ? new Set(filter.match) : null;

        return (this.records || [])
            .filter((b) => {
                if (matchSet) {
                    const s = b.Status__c || 'Scheduled';
                    if (!matchSet.has(s)) return false;
                }
                if (search) {
                    const hay = [
                        b.Customer_Name__c, b.Email__c, b.Mobile_Number__c,
                        b.Model_Interested__c,
                        b.Vehicle_Model__r ? b.Vehicle_Model__r.Name : '',
                        b.Name
                    ].filter(Boolean).join(' ').toLowerCase();
                    if (!hay.includes(search)) return false;
                }
                return true;
            })
            .map((b) => {
                const name = b.Customer_Name__c || 'Guest';
                const status = normalizeStatus(b.Status__c);
                const vehicle = (b.Vehicle_Model__r && b.Vehicle_Model__r.Name)
                    || b.Model_Interested__c
                    || 'Electra';
                return {
                    id: b.Id,
                    bookingRef: b.Name,
                    name,
                    initials: initials(name),
                    avatarClass: 'avatar avatar--' + avatarTone(b.Email__c || b.Mobile_Number__c || name),
                    email: b.Email__c || '',
                    emailHref: b.Email__c ? `mailto:${b.Email__c}` : null,
                    phone: b.Mobile_Number__c || '',
                    phoneHref: b.Mobile_Number__c ? `tel:${b.Mobile_Number__c}` : null,
                    vehicle,
                    driveType: b.Drive_Type__c || 'Standard',
                    dateLabel: formatDate(b.Test_Drive_Date_Time__c),
                    timeLabel: formatTime(b.Test_Drive_Date_Time__c),
                    status,
                    statusClass: statusPillClass(status),
                    channel: b.Booking_Channel__c || ''
                };
            });
    }

    get totalRecords() { return (this.records || []).length; }
    get visibleCount() { return this.rows.length; }
    get hasRows() { return this.rows.length > 0; }
    get hasAnyRecords() { return (this.records || []).length > 0; }

    get summaryLabel() {
        const total = this.totalRecords;
        const visible = this.visibleCount;
        if (total === 0) return 'No customers yet';
        if (visible === total) return `${total} customers`;
        return `${visible} of ${total} customers`;
    }

    // ---------- Refresh ----------

    handleRefresh() {
        if (this.contextResult) refreshApex(this.contextResult);
        if (this.recordsResult) refreshApex(this.recordsResult);
    }
}