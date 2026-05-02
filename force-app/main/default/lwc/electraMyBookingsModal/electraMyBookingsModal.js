import { LightningElement, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import getBookingsByContact from '@salesforce/apex/TD_GuestBookingController.getBookingsByContact';
import cancelBooking from '@salesforce/apex/TD_GuestBookingController.cancelBooking';
import rescheduleBooking from '@salesforce/apex/TD_GuestBookingController.rescheduleBooking';
import FONTS from '@salesforce/resourceUrl/electraFonts';
import { MY_BOOKINGS_EVENT_NAME } from 'c/electraBookingBridge';

function cleanDigits(v, max = 15) {
    if (!v && v !== 0) return '';
    return String(v).replace(/\D/g, '').slice(0, max);
}

function validEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function fmtDateTime(iso) {
    if (!iso) return '';
    try {
        return new Date(iso).toLocaleString(undefined, {
            weekday: 'short', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit'
        });
    } catch (e) { return String(iso); }
}

const TERMINAL_STATUSES = new Set(['Completed', 'No-Show', 'Cancelled']);

export default class ElectraMyBookingsModal extends LightningElement {
    @track isOpen = false;
    @track step = 'lookup'; // 'lookup' | 'results'
    @track email = '';
    @track mobile = '';
    @track submitting = false;
    @track errorMessage;
    @track bookings = [];
    @track busyRecordId;
    @track rescheduleId;
    @track rescheduleDateTime;
    @track flashMessage;

    _fontsLoaded = false;
    _boundOpenHandler;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
        this._boundOpenHandler = () => this.handleExternalOpen();
        window.addEventListener(MY_BOOKINGS_EVENT_NAME, this._boundOpenHandler);
    }

    disconnectedCallback() {
        if (this._boundOpenHandler) {
            window.removeEventListener(MY_BOOKINGS_EVENT_NAME, this._boundOpenHandler);
        }
    }

    // ---------- External open ----------

    handleExternalOpen() {
        this.resetAll();
        this.isOpen = true;
    }

    resetAll() {
        this.step = 'lookup';
        this.email = '';
        this.mobile = '';
        this.submitting = false;
        this.errorMessage = undefined;
        this.bookings = [];
        this.busyRecordId = undefined;
        this.rescheduleId = undefined;
        this.rescheduleDateTime = undefined;
        this.flashMessage = undefined;
    }

    handleClose() { this.isOpen = false; }

    handleScrimClick(event) {
        if (event.target === event.currentTarget) this.handleClose();
    }

    handleDialogKeydown(event) {
        if (event.key === 'Escape') this.handleClose();
    }

    // ---------- Lookup step ----------

    get isLookupStep() { return this.step === 'lookup'; }
    get isResultsStep() { return this.step === 'results'; }

    handleEmailInput(event) { this.email = (event.target.value || '').trim(); }
    handleMobileInput(event) { this.mobile = cleanDigits(event.target.value, 12); }

    get canSearch() {
        return validEmail(this.email) && cleanDigits(this.mobile).length >= 10 && !this.submitting;
    }

    async handleSearch() {
        if (!this.canSearch) return;
        this.submitting = true;
        this.errorMessage = undefined;
        try {
            const rows = await getBookingsByContact({ email: this.email, mobile: this.mobile });
            this.bookings = rows || [];
            this.step = 'results';
        } catch (err) {
            this.errorMessage = this.extractError(err);
        } finally {
            this.submitting = false;
        }
    }

    // ---------- Results step ----------

    get displayBookings() {
        return (this.bookings || []).map((b) => {
            const isTerminal = TERMINAL_STATUSES.has(b.status);
            const isReschedulingThis = this.rescheduleId === b.id;
            const status = b.status || 'Scheduled';
            let pillClass = 'status-pill status-pill--active';
            if (status === 'Cancelled') pillClass = 'status-pill status-pill--cancelled';
            else if (status === 'No-Show') pillClass = 'status-pill status-pill--noshow';
            else if (status === 'Completed') pillClass = 'status-pill status-pill--done';
            return {
                ...b,
                whenLabel: fmtDateTime(b.scheduledAt),
                dealerLine: b.dealerName
                    ? (b.dealerCity ? `${b.dealerName} · ${b.dealerCity}` : b.dealerName)
                    : '',
                pillClass,
                canAct: !isTerminal,
                isBusy: this.busyRecordId === b.id,
                isRescheduling: isReschedulingThis
            };
        });
    }

    get hasBookings() { return (this.bookings || []).length > 0; }
    get hasNoBookings() { return !this.hasBookings; }

    handleBackToLookup() {
        this.step = 'lookup';
        this.errorMessage = undefined;
        this.flashMessage = undefined;
        this.rescheduleId = undefined;
    }

    async handleCancel(event) {
        const id = event.currentTarget.dataset.id;
        if (!id || this.busyRecordId) return;
        // eslint-disable-next-line no-alert
        if (!confirm('Cancel this booking?')) return;

        this.busyRecordId = id;
        this.errorMessage = undefined;
        this.flashMessage = undefined;
        try {
            await cancelBooking({ bookingId: id, email: this.email });
            this.flashMessage = 'Booking cancelled.';
            // Refresh the list
            const rows = await getBookingsByContact({ email: this.email, mobile: this.mobile });
            this.bookings = rows || [];
        } catch (err) {
            this.errorMessage = this.extractError(err);
        } finally {
            this.busyRecordId = undefined;
        }
    }

    handleOpenReschedule(event) {
        const id = event.currentTarget.dataset.id;
        const b = (this.bookings || []).find((x) => x.id === id);
        this.rescheduleId = id;
        this.rescheduleDateTime = b && b.scheduledAt ? b.scheduledAt : undefined;
        this.errorMessage = undefined;
        this.flashMessage = undefined;
    }

    handleRescheduleInput(event) {
        this.rescheduleDateTime = event.target.value;
    }

    async handleRescheduleSave(event) {
        const id = event.currentTarget.dataset.id;
        if (!id || this.busyRecordId) return;
        if (!this.rescheduleDateTime) {
            this.errorMessage = 'Please pick a new date & time.';
            return;
        }
        this.busyRecordId = id;
        this.errorMessage = undefined;
        this.flashMessage = undefined;
        try {
            await rescheduleBooking({
                bookingId: id,
                email: this.email,
                newDateTime: this.rescheduleDateTime
            });
            this.flashMessage = 'Booking rescheduled.';
            this.rescheduleId = undefined;
            const rows = await getBookingsByContact({ email: this.email, mobile: this.mobile });
            this.bookings = rows || [];
        } catch (err) {
            this.errorMessage = this.extractError(err);
        } finally {
            this.busyRecordId = undefined;
        }
    }

    handleRescheduleCancel() {
        this.rescheduleId = undefined;
        this.rescheduleDateTime = undefined;
    }

    extractError(err) {
        if (!err) return 'Something went wrong. Please try again.';
        if (err.body && err.body.message) return err.body.message;
        if (err.message) return err.message;
        return String(err);
    }
}