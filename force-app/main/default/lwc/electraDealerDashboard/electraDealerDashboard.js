import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { loadStyle } from 'lightning/platformResourceLoader';
import getMyDealerContext from '@salesforce/apex/TD_DealerConsoleController.getMyDealerContext';
import getMyTodayBookings from '@salesforce/apex/TD_DealerConsoleController.getMyTodayBookings';
import getMyUpcomingBookings from '@salesforce/apex/TD_DealerConsoleController.getMyUpcomingBookings';
import getMyCompletedTodayBookings from '@salesforce/apex/TD_DealerConsoleController.getMyCompletedTodayBookings';
import getMyAllFutureBookings from '@salesforce/apex/TD_DealerConsoleController.getMyAllFutureBookings';
import getMyAllPastBookings from '@salesforce/apex/TD_DealerConsoleController.getMyAllPastBookings';
import updateBookingStatus from '@salesforce/apex/TD_DealerConsoleController.updateBookingStatus';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const PATH = [
    { value: 'Scheduled',   label: 'Scheduled'   },
    { value: 'Confirmed',   label: 'Confirmed'   },
    { value: 'Arrived',     label: 'Arrived'     },
    { value: 'In Progress', label: 'In Progress' },
    { value: 'Completed',   label: 'Completed'   }
];
const OFF_PATH = ['Cancelled', 'No-Show'];

const TABS = [
    { id: 'today',     label: 'Today'        },
    { id: 'upcoming',  label: 'Next 7 days'  },
    { id: 'completed', label: 'Completed'    },
    { id: 'allFuture', label: 'All bookings' },
    { id: 'allPast',   label: 'Past bookings'}
];

const ACTIONS = {
    'Scheduled':   [
        { next: 'Confirmed',   label: 'Confirm',      variant: 'primary' },
        { next: 'Cancelled',   label: 'Cancel',       variant: 'danger'  }
    ],
    'Confirmed':   [
        { next: 'Arrived',     label: 'Mark Arrived', variant: 'primary' },
        { next: 'Cancelled',   label: 'Cancel',       variant: 'danger'  }
    ],
    'Arrived':     [
        { next: 'In Progress', label: 'Start Drive',  variant: 'primary' },
        { next: 'No-Show',     label: 'No-Show',      variant: 'danger'  }
    ],
    'In Progress': [
        { next: 'Completed',   label: 'Complete',     variant: 'primary' }
    ],
    'Inprogress':  [
        { next: 'Completed',   label: 'Complete',     variant: 'primary' }
    ],
    'Completed':   [],
    'Cancelled':   [],
    'No-Show':     []
};

function formatDateTime(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    } catch (e) {
        return String(iso);
    }
}

function normalizeStatus(raw) {
    if (!raw) return 'Scheduled';
    if (raw === 'Inprogress') return 'In Progress';
    return raw;
}

function extractError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.body && err.body.message) return err.body.message;
    if (err.message) return err.message;
    return JSON.stringify(err);
}

export default class ElectraDealerDashboard extends LightningElement {
    @api pageTitle = 'Dealer Dashboard';
    @api upcomingDays = 7;
    @api dealerAccountId;

    @track activeTab = 'today';
    @track busyRecordId;
    @track lastError;

    @track context;
    @track contextError;

    todayResult;
    upcomingResult;
    completedResult;
    allFutureResult;
    allPastResult;
    @track todayList = [];
    @track upcomingList = [];
    @track completedList = [];
    @track allFutureList = [];
    @track allPastList = [];

    _fontsLoaded = false;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
    }

    // ---------- Auto-derived dealer context (from logged-in user) ----------

    @wire(getMyDealerContext)
    wiredContext({ data, error }) {
        if (data) {
            this.context = data;
            this.contextError = undefined;
        } else if (error) {
            this.context = undefined;
            this.contextError = extractError(error);
        }
    }

    get dealerBadgeName() { return this.context ? this.context.dealerName : 'Electra Dealer'; }
    get dealerBadgeCity() { return this.context && this.context.dealerCity ? this.context.dealerCity : ''; }
    get hasContext() { return !!(this.context && this.context.dealerAccountId); }
    get noDealerLink() { return !!this.contextError; }

    // ---------- Bookings (auto-scoped to logged-in user's dealer) ----------

    @wire(getMyTodayBookings)
    wiredToday(result) {
        this.todayResult = result;
        if (result.data) {
            this.todayList = result.data;
            this.lastError = undefined;
        } else if (result.error) {
            this.lastError = extractError(result.error);
        }
    }

    @wire(getMyUpcomingBookings, { daysAhead: '$upcomingDays' })
    wiredUpcoming(result) {
        this.upcomingResult = result;
        if (result.data) this.upcomingList = result.data;
        else if (result.error) this.lastError = extractError(result.error);
    }

    @wire(getMyCompletedTodayBookings)
    wiredCompleted(result) {
        this.completedResult = result;
        if (result.data) this.completedList = result.data;
        else if (result.error) this.lastError = extractError(result.error);
    }

    @wire(getMyAllFutureBookings)
    wiredAllFuture(result) {
        this.allFutureResult = result;
        if (result.data) this.allFutureList = result.data;
        else if (result.error) this.lastError = extractError(result.error);
    }

    @wire(getMyAllPastBookings)
    wiredAllPast(result) {
        this.allPastResult = result;
        if (result.data) this.allPastList = result.data;
        else if (result.error) this.lastError = extractError(result.error);
    }

    // ---------- Tabs ----------

    get tabs() {
        return TABS.map((t) => ({
            ...t,
            className: t.id === this.activeTab ? 'ttab ttab--active' : 'ttab',
            count: this.countFor(t.id)
        }));
    }

    countFor(tabId) {
        if (tabId === 'today') return (this.todayList || []).length;
        if (tabId === 'upcoming') return (this.upcomingList || []).length;
        if (tabId === 'completed') return (this.completedList || []).length;
        if (tabId === 'allFuture') return (this.allFutureList || []).length;
        if (tabId === 'allPast') return (this.allPastList || []).length;
        return 0;
    }

    handleTabClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id) this.activeTab = id;
    }

    get activeList() {
        if (this.activeTab === 'today') return this.todayList;
        if (this.activeTab === 'upcoming') return this.upcomingList;
        if (this.activeTab === 'completed') return this.completedList;
        if (this.activeTab === 'allFuture') return this.allFutureList;
        if (this.activeTab === 'allPast') return this.allPastList;
        return [];
    }

    get bookings() {
        return (this.activeList || []).map((b) => {
            const status = normalizeStatus(b.Status__c);
            const isOffPath = OFF_PATH.includes(status);
            const activeIdx = PATH.findIndex((p) => p.value === status);
            const pathSteps = PATH.map((p, i) => {
                let stepClass = 'pstep';
                if (isOffPath) {
                    stepClass = 'pstep pstep--muted';
                } else if (i < activeIdx) {
                    stepClass = 'pstep pstep--done';
                } else if (i === activeIdx) {
                    stepClass = 'pstep pstep--active';
                }
                return {
                    key: `${b.Id}-${p.value}`,
                    label: p.label,
                    number: String(i + 1),
                    className: stepClass
                };
            });

            const actions = (ACTIONS[status] || []).map((a) => ({
                key: `${b.Id}-${a.next}`,
                label: a.label,
                next: a.next,
                recordId: b.Id,
                className: a.variant === 'danger'
                    ? 'btn btn--danger'
                    : 'btn btn--primary'
            }));

            const vehicleName = (b.Vehicle_Model__r && b.Vehicle_Model__r.Name)
                || b.Model_Interested__c
                || 'Electra';

            return {
                id: b.Id,
                name: b.Name,
                customer: b.Customer_Name__c || 'Guest',
                email: b.Email__c,
                mobile: b.Mobile_Number__c,
                vehicle: vehicleName,
                driveType: b.Drive_Type__c || 'Standard Drive',
                channel: b.Booking_Channel__c,
                when: formatDateTime(b.Test_Drive_Date_Time__c),
                status,
                statusBadgeClass: isOffPath
                    ? (status === 'Cancelled' ? 'status-pill status-pill--cancelled' : 'status-pill status-pill--noshow')
                    : 'status-pill status-pill--active',
                isOffPath,
                pathSteps,
                actions,
                hasActions: actions.length > 0,
                isBusy: this.busyRecordId === b.Id
            };
        });
    }

    get hasBookings() {
        return this.bookings.length > 0;
    }

    get emptyMessage() {
        if (this.activeTab === 'today') return 'No bookings scheduled for today.';
        if (this.activeTab === 'upcoming') return `No bookings in the next ${this.upcomingDays} days.`;
        if (this.activeTab === 'allFuture') return 'No upcoming bookings.';
        if (this.activeTab === 'allPast') return 'No past bookings.';
        return 'No completed or no-show bookings today.';
    }

    // ---------- Actions ----------

    handleRefresh() {
        if (this.todayResult) refreshApex(this.todayResult);
        if (this.upcomingResult) refreshApex(this.upcomingResult);
        if (this.completedResult) refreshApex(this.completedResult);
        if (this.allFutureResult) refreshApex(this.allFutureResult);
        if (this.allPastResult) refreshApex(this.allPastResult);
    }

    async handleStatusAction(event) {
        const recordId = event.currentTarget.dataset.id;
        const next = event.currentTarget.dataset.next;
        if (!recordId || !next || this.busyRecordId) return;

        this.busyRecordId = recordId;
        this.lastError = undefined;
        try {
            await updateBookingStatus({ bookingId: recordId, newStatus: next });
            this.handleRefresh();
        } catch (err) {
            this.lastError = extractError(err);
        } finally {
            this.busyRecordId = undefined;
        }
    }
}