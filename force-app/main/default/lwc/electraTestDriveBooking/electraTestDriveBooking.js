import { LightningElement, wire, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import getAllModels from '@salesforce/apex/TD_VehicleCatalogueController.getAllModels';
import getActiveDealers from '@salesforce/apex/TD_DealerLocatorController.getActiveDealers';
import getAvailableSlots from '@salesforce/apex/TD_GuestBookingController.getAvailableSlots';
import createBooking from '@salesforce/apex/TD_GuestBookingController.createBooking';
import FONTS from '@salesforce/resourceUrl/electraFonts';
import EV_IMAGES from '@salesforce/resourceUrl/electraEvImages';
import { BOOKING_EVENT_NAME } from 'c/electraBookingBridge';

const MODEL_PRICING = {
    'Electra GT': '$52,000',
    'Electra SUV': '$48,000',
    'Electra Sedan': '$45,000',
    'Electra Crossover': '$38,000'
};

const MODEL_IMAGES = {
    'Electra GT': 'GT.jpg',
    'Electra SUV': 'SUV.jpg',
    'Electra Sedan': 'Sedan.jpg',
    'Electra Crossover': 'Crossover.jpg'
};

// Per-dealer hero image — reuses the showrooms folder uploaded earlier.
const DEALER_IMAGE_BY_NAME = {
    'Electra Downtown SF':    'showrooms/sf1.jpg',
    'Electra Bay Area South': 'showrooms/sj1.jpg',
    'Electra East Bay':       'showrooms/oak1.jpg',
    'Electra Peninsula':      'showrooms/pa1.jpg'
};

const DRIVE_TYPES = [
    { value: 'Standard Drive',   title: 'Standard Drive',   desc: '20 min on the dealer’s test route.' },
    { value: 'Experience Drive', title: 'Experience Drive', desc: '30 min. We bring the car to you.' },
    { value: 'Virtual Preview',  title: 'Virtual Preview',  desc: '15 min guided video walkaround.' }
];

// Convert a slot string like "2:00 PM" or "14:00" into a 24-hour HH:mm string
// for ISO datetime composition.
function slotTo24h(slot) {
    if (!slot) return null;
    const s = String(slot).trim().toUpperCase();
    const ampm = s.includes('PM') ? 'PM' : (s.includes('AM') ? 'AM' : null);
    const cleaned = s.replace(/[^0-9:]/g, '');
    if (!cleaned) return null;
    const [hStr, mStr = '00'] = cleaned.split(':');
    let h = Number(hStr);
    const m = Number(mStr);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    if (ampm === 'PM' && h !== 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}:${mm}`;
}

function buildIsoDateTime(dateStr, slotStr) {
    if (!dateStr || !slotStr) return null;
    const t24 = slotTo24h(slotStr);
    if (!t24) return null;
    return `${dateStr}T${t24}:00.000Z`;
}

function cleanDigits(value, max = 15) {
    if (!value && value !== 0) return '';
    return String(value).replace(/\D/g, '').slice(0, max);
}

// Normalize "3.2 seconds (0-60 mph)" -> "3.2s" for compact display
function tightSeconds(value) {
    if (!value && value !== 0) return value;
    return String(value).replace(/\bseconds?\b.*$/i, 's').replace(/\s+/g, ' ').trim();
}

function validEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default class ElectraTestDriveBooking extends LightningElement {
    @track isOpen = false;
    @track step = 1;
    @track submitting = false;
    @track submitError;
    @track successRecord;

    // user input
    @track selectedModelName;
    @track driveType = 'Standard Drive';
    @track slotDate;
    @track selectedSlot;
    @track customerName = '';
    @track email = '';
    @track mobile = '';
    @track notes = '';

    // dealer state — preselected (from caller context) or chosen in dealer step
    @track preselectedDealerId;
    @track preselectedDealerName;
    @track preselectedDealerCity;
    @track chosenDealerId;
    @track chosenDealerName;
    @track chosenDealerCity;

    @track source;
    @track rawModels = [];
    @track rawDealers = [];
    @track rawSlots = [];
    @track slotsLoading = false;
    @track slotsError;

    _fontsLoaded = false;
    _boundOpenHandler;
    _lastRenderedStep;

    // ---------- Wires ----------

    @wire(getAllModels)
    wiredModels({ data }) {
        if (data) this.rawModels = data;
    }

    @wire(getActiveDealers)
    wiredDealers({ data }) {
        if (data) this.rawDealers = data;
    }

    @wire(getAvailableSlots, { dealerAccountId: '$effectiveDealerId', slotDate: '$slotDate' })
    wiredSlots({ data, error }) {
        this.slotsLoading = false;
        if (data) {
            this.rawSlots = data;
            this.slotsError = undefined;
            // If the previously selected slot is no longer available, clear it
            if (this.selectedSlot && !data.find((s) => s.slotTime === this.selectedSlot)) {
                this.selectedSlot = undefined;
            }
        } else if (error) {
            this.rawSlots = [];
            this.slotsError = (error.body && error.body.message) || 'Could not load slots.';
        }
    }

    // ---------- Lifecycle ----------

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
        this._boundOpenHandler = (event) => this.handleExternalOpen(event);
        window.addEventListener(BOOKING_EVENT_NAME, this._boundOpenHandler);
    }

    disconnectedCallback() {
        if (this._boundOpenHandler) {
            window.removeEventListener(BOOKING_EVENT_NAME, this._boundOpenHandler);
        }
    }

    renderedCallback() {
        if (this.isOpen && this._lastRenderedStep !== this.step) {
            this._lastRenderedStep = this.step;
            const body = this.template.querySelector('.body');
            if (body) body.scrollTop = 0;
        }
        if (!this.isOpen) {
            this._lastRenderedStep = undefined;
        }
    }

    // ---------- External trigger ----------

    handleExternalOpen(event) {
        const ctx = (event && event.detail) || {};
        this.resetState();
        this.source = ctx.source || 'unknown';

        if (ctx.dealerId) {
            this.preselectedDealerId = ctx.dealerId;
            this.preselectedDealerName = ctx.dealerName || '';
            this.preselectedDealerCity = ctx.dealerCity || '';
        }
        if (ctx.model) {
            this.selectedModelName = ctx.model;
        }

        this.step = 1;
        this.isOpen = true;
    }

    resetState() {
        this.step = 1;
        this.submitting = false;
        this.submitError = undefined;
        this.successRecord = undefined;
        this.selectedModelName = undefined;
        this.driveType = 'Standard Drive';
        this.slotDate = undefined;
        this.selectedSlot = undefined;
        this.customerName = '';
        this.email = '';
        this.mobile = '';
        this.notes = '';
        this.preselectedDealerId = undefined;
        this.preselectedDealerName = undefined;
        this.preselectedDealerCity = undefined;
        this.chosenDealerId = undefined;
        this.chosenDealerName = undefined;
        this.chosenDealerCity = undefined;
        this.rawSlots = [];
    }

    handleClose() { this.isOpen = false; }

    handleScrimClick(event) {
        if (event.target === event.currentTarget) this.handleClose();
    }

    handleDialogKeydown(event) {
        if (event.key === 'Escape') this.handleClose();
    }

    // ---------- Step machine ----------

    get dynamicSteps() {
        const arr = [];
        if (!this.preselectedDealerId) arr.push({ id: 'dealer',  label: 'Showroom' });
        if (!this.selectedModelName)  arr.push({ id: 'vehicle', label: 'Vehicle' });
        arr.push({ id: 'when',    label: 'When' });
        arr.push({ id: 'contact', label: 'Details' });
        return arr;
    }

    get currentStepId() {
        const steps = this.dynamicSteps;
        const idx = this.step - 1;
        if (idx < 0 || idx >= steps.length) return null;
        return steps[idx].id;
    }

    get isDealerStep()  { return this.isOpen && !this.successRecord && this.currentStepId === 'dealer'; }
    get isVehicleStep() { return this.isOpen && !this.successRecord && this.currentStepId === 'vehicle'; }
    get isWhenStep()    { return this.isOpen && !this.successRecord && this.currentStepId === 'when'; }
    get isContactStep() { return this.isOpen && !this.successRecord && this.currentStepId === 'contact'; }
    get isSuccess()     { return this.isOpen && !!this.successRecord; }

    get steppers() {
        const current = this.step;
        return this.dynamicSteps.map((s, i) => {
            const idx = i + 1;
            let cls = 'stp';
            if (idx === current) cls = 'stp stp--active';
            else if (idx < current) cls = 'stp stp--done';
            return {
                key: s.id,
                label: s.label,
                number: String(idx),
                className: cls
            };
        });
    }

    get isLastStep() { return this.step >= this.dynamicSteps.length; }

    get stepTitle() {
        if (this.successRecord) return 'You’re booked.';
        const id = this.currentStepId;
        if (id === 'dealer')  return 'Where would you like to test drive?';
        if (id === 'vehicle') return 'Choose your Electra';
        if (id === 'when')    return 'Pick a date & time';
        if (id === 'contact') return 'Your details';
        return 'Book a Test Drive';
    }

    get nextLabel() {
        if (this.isLastStep) return this.submitting ? 'Booking…' : 'Confirm booking';
        return 'Next';
    }

    get showBack() { return this.step > 1 && !this.successRecord; }
    get disableBack() { return this.step <= 1 || this.submitting; }
    get disableNext() { return !this.canAdvance || this.submitting; }

    get canAdvance() {
        const id = this.currentStepId;
        if (id === 'dealer')  return !!this.chosenDealerId;
        if (id === 'vehicle') return !!this.selectedModelName;
        if (id === 'when')    return !!this.driveType && !!this.slotDate && !!this.selectedSlot;
        if (id === 'contact') {
            return this.customerName.trim().length >= 2
                && validEmail(this.email)
                && cleanDigits(this.mobile).length >= 10;
        }
        return false;
    }

    // ---------- Effective dealer (preselected or chosen) ----------

    get effectiveDealerId()   { return this.preselectedDealerId || this.chosenDealerId || null; }
    get effectiveDealerName() { return this.preselectedDealerName || this.chosenDealerName || ''; }
    get effectiveDealerCity() { return this.preselectedDealerCity || this.chosenDealerCity || ''; }

    get hasEffectiveDealer() { return !!this.effectiveDealerId; }

    get effectiveDealerLabel() {
        const name = this.effectiveDealerName;
        const city = this.effectiveDealerCity;
        if (!name) return '';
        return city ? `${name} · ${city}` : name;
    }

    // ---------- Dealer step ----------

    get dealerOptions() {
        return (this.rawDealers || []).map((d) => {
            const accountId = d.accountId || d.id;
            const isSelected = this.chosenDealerId === accountId;
            const imageFile = DEALER_IMAGE_BY_NAME[d.name];
            return {
                id: accountId,
                name: d.name,
                city: d.city || '',
                state: d.state || '',
                address: d.address || '',
                imageUrl: imageFile ? `${EV_IMAGES}/${imageFile}` : null,
                className: isSelected ? 'dealer-card dealer-card--active' : 'dealer-card',
                isSelected
            };
        });
    }

    handleDealerPick(event) {
        const id = event.currentTarget.dataset.id;
        const picked = this.dealerOptions.find((d) => d.id === id);
        if (picked) {
            this.chosenDealerId = picked.id;
            this.chosenDealerName = picked.name;
            this.chosenDealerCity = picked.city;
            // Switching dealer invalidates any previously fetched slots
            this.selectedSlot = undefined;
            this.rawSlots = [];
        }
    }

    // ---------- Vehicle step ----------

    get modelOptions() {
        const byName = new Map((this.rawModels || []).map((m) => [m.name, m]));
        const ordered = ['Electra GT', 'Electra SUV', 'Electra Sedan', 'Electra Crossover'];
        return ordered
            .filter((n) => byName.has(n))
            .map((n) => {
                const m = byName.get(n);
                const isSelected = this.selectedModelName === n;
                return {
                    id: m.id,
                    name: n,
                    bodyType: m.bodyType || '',
                    range: m.maximumBatteryRange || '',
                    accel: tightSeconds(m.accelerationTime) || '',
                    price: MODEL_PRICING[n] || '',
                    imageUrl: MODEL_IMAGES[n] ? `${EV_IMAGES}/${MODEL_IMAGES[n]}` : null,
                    className: isSelected ? 'model-card model-card--active' : 'model-card',
                    isSelected
                };
            });
    }

    get selectedModel() {
        return this.modelOptions.find((m) => m.isSelected) || null;
    }

    handleModelPick(event) {
        const id = event.currentTarget.dataset.id;
        const picked = this.modelOptions.find((m) => m.id === id);
        if (picked) this.selectedModelName = picked.name;
    }

    // ---------- When step ----------

    get driveTypeOptions() {
        return DRIVE_TYPES.map((d) => ({
            ...d,
            className: this.driveType === d.value ? 'dt-card dt-card--active' : 'dt-card',
            id: d.value.toLowerCase().replace(/\s+/g, '-')
        }));
    }

    get slotChips() {
        return (this.rawSlots || []).map((s) => ({
            key: s.id || s.slotTime,
            time: s.slotTime,
            className: this.selectedSlot === s.slotTime ? 'slot-chip slot-chip--active' : 'slot-chip'
        }));
    }

    get hasSlotsToShow()    { return !this.slotsLoading && this.rawSlots && this.rawSlots.length > 0; }
    get hasNoSlots()        { return !this.slotsLoading && this.slotDate && (!this.rawSlots || this.rawSlots.length === 0); }
    get awaitingDateInput() { return !this.slotDate; }

    handleDriveTypePick(event) {
        const value = event.currentTarget.dataset.value;
        if (value) this.driveType = value;
    }

    handleSlotDateChange(event) {
        this.slotDate = event.target.value || undefined;
        this.selectedSlot = undefined;
        if (this.slotDate) this.slotsLoading = true;
    }

    handleSlotPick(event) {
        const t = event.currentTarget.dataset.time;
        if (t) this.selectedSlot = t;
    }

    // ---------- Contact step ----------

    handleNameInput(event)   { this.customerName = event.target.value; }
    handleEmailInput(event)  { this.email = event.target.value.trim(); }
    handleMobileInput(event) { this.mobile = cleanDigits(event.target.value, 12); }
    handleNotesInput(event)  { this.notes = event.target.value; }

    // ---------- Nav ----------

    handleBack() {
        if (this.step > 1) this.step = this.step - 1;
    }

    handleNext() {
        if (this.submitting || !this.canAdvance) return;
        if (!this.isLastStep) {
            this.step = this.step + 1;
        } else {
            this.submit();
        }
    }

    // ---------- Submit ----------

    async submit() {
        this.submitting = true;
        this.submitError = undefined;

        const picked = this.selectedModel;
        const dealerId = this.effectiveDealerId;
        const dateTimeIso = buildIsoDateTime(this.slotDate, this.selectedSlot);

        const input = {
            customerName: this.customerName.trim(),
            email: this.email.trim(),
            mobileNumber: cleanDigits(this.mobile, 12) || null,
            dateTime: dateTimeIso,
            slotDate: this.slotDate,
            timeSlot: this.selectedSlot,
            driveType: this.driveType,
            bookingChannel: 'Web Chat',
            status: 'Scheduled',
            modelInterested: picked ? picked.name : this.selectedModelName,
            vehicleId: picked && picked.id ? picked.id : null,
            dealerId: dealerId || null,
            notes: this.notes ? this.notes.trim() : null
        };

        try {
            const result = await createBooking({ input });
            this.successRecord = {
                id: result && result.id ? result.id : '',
                name: result && result.name ? result.name : ''
            };
        } catch (err) {
            const msg = (err && err.body && err.body.message)
                || (err && err.message)
                || 'Something went wrong. Please try again.';
            this.submitError = msg;
        } finally {
            this.submitting = false;
        }
    }

    handleDone() {
        this.isOpen = false;
    }
}