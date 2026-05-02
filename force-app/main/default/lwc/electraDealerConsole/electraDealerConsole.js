import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getTodayBookings from '@salesforce/apex/TD_DealerConsoleController.getTodayBookings';
import getUpcomingBookings from '@salesforce/apex/TD_DealerConsoleController.getUpcomingBookings';
import getCompletedTodayBookings from '@salesforce/apex/TD_DealerConsoleController.getCompletedTodayBookings';

export default class ElectraDealerConsole extends LightningElement {
    @api dealerAccountId;
    @api recordId;
    @api upcomingDaysAhead = 7;
    @api pollSeconds = 30;

    activeTab = 'today';
    todayResult;
    upcomingResult;
    completedResult;
    todayBookings = [];
    upcomingBookings = [];
    completedBookings = [];
    error;
    _timer;

    // Outcome modal state
    showOutcomeModal = false;
    modalBookingId;
    modalCustomerName;
    modalVehicleModel;

    get effectiveDealerId() {
        return this.dealerAccountId || this.recordId || null;
    }

    @wire(getTodayBookings, { dealerAccountId: '$effectiveDealerId' })
    wiredToday(result) {
        this.todayResult = result;
        if (result.data) { this.todayBookings = result.data; this.error = undefined; }
        else if (result.error) this.error = this.extractError(result.error);
    }

    @wire(getUpcomingBookings, { dealerAccountId: '$effectiveDealerId', daysAhead: '$upcomingDaysAhead' })
    wiredUpcoming(result) {
        this.upcomingResult = result;
        if (result.data) this.upcomingBookings = result.data;
        else if (result.error) this.error = this.extractError(result.error);
    }

    @wire(getCompletedTodayBookings, { dealerAccountId: '$effectiveDealerId' })
    wiredCompleted(result) {
        this.completedResult = result;
        if (result.data) this.completedBookings = result.data;
        else if (result.error) this.error = this.extractError(result.error);
    }

    connectedCallback() {
        const interval = Number(this.pollSeconds) || 0;
        if (interval > 0) {
            this._timer = setInterval(() => this.refreshAll(), interval * 1000);
        }
    }

    disconnectedCallback() {
        if (this._timer) clearInterval(this._timer);
    }

    handleTabChange(e) {
        this.activeTab = e.target.value;
    }

    handleManualRefresh() {
        this.refreshAll();
    }

    refreshAll() {
        if (this.todayResult) refreshApex(this.todayResult);
        if (this.upcomingResult) refreshApex(this.upcomingResult);
        if (this.completedResult) refreshApex(this.completedResult);
    }

    // Bubbled from booking card after a successful status transition
    handleStatusChange() {
        this.refreshAll();
    }

    // Bubbled from booking card when "Capture Outcome" clicked
    handleCaptureOutcome(e) {
        this.modalBookingId = e.detail.bookingId;
        this.modalCustomerName = e.detail.customerName;
        this.modalVehicleModel = e.detail.vehicleModel;
        this.showOutcomeModal = true;
    }

    handleModalCancel() {
        this.showOutcomeModal = false;
    }

    handleModalSave() {
        this.showOutcomeModal = false;
        this.refreshAll();
    }

    extractError(err) {
        if (Array.isArray(err.body)) return err.body.map(e => e.message).join(', ');
        if (err.body && err.body.message) return err.body.message;
        return err.message || 'Unknown error';
    }

    get todayLabel()     { return `Today (${this.todayBookings?.length || 0})`; }
    get upcomingLabel()  { return `Upcoming (${this.upcomingBookings?.length || 0})`; }
    get completedLabel() { return `Completed Today (${this.completedBookings?.length || 0})`; }

    get todayEmpty()     { return !this.todayBookings || this.todayBookings.length === 0; }
    get upcomingEmpty()  { return !this.upcomingBookings || this.upcomingBookings.length === 0; }
    get completedEmpty() { return !this.completedBookings || this.completedBookings.length === 0; }
}