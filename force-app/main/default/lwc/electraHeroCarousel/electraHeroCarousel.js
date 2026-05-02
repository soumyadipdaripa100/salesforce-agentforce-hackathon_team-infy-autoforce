import { LightningElement, api, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import getAllModels from '@salesforce/apex/TD_VehicleCatalogueController.getAllModels';
import FONTS from '@salesforce/resourceUrl/electraFonts';
import EV_IMAGES from '@salesforce/resourceUrl/electraEvImages';
import { openChat } from 'c/electraChatBridge';
import { openBooking, openMyBookings } from 'c/electraBookingBridge';

function tight(value) {
    if (!value && value !== 0) return '';
    return String(value)
        .replace(/\bseconds?\b.*$/i, 's')
        .replace(/\bmiles\b/i, 'mi')
        .replace(/\s+/g, ' ')
        .trim();
}

function composeBrandLine(title, specs, fallback) {
    if (!specs) return fallback;
    const range = tight(specs.maximumBatteryRange);
    const accel = tight(specs.accelerationTime);
    const power = tight(specs.totalPower);
    switch (title) {
        case 'Electra GT':
            return (power && accel)
                ? `Grand Tourer · ${power} · 0–60 in ${accel}`
                : fallback;
        case 'Electra SUV':
            return range
                ? `All-Electric SUV · ${range} range · 7 seats ready`
                : fallback;
        case 'Electra Sedan':
            return range
                ? `Luxury Sedan · ${range} range · Whisper-quiet`
                : fallback;
        case 'Electra Crossover':
            return range
                ? `Urban Crossover · ${range} range · From $38k`
                : fallback;
        default:
            return fallback;
    }
}

const PRIMARY_TABS = [
    { id: 'home',    label: 'Home',              target: { type: 'comm__namedPage', attributes: { name: 'Home' } } },
    { id: 'dealer',  label: 'Dealer Locator',    target: { type: 'comm__namedPage', attributes: { name: 'showrooms__c' } } },
    { id: 'book',    label: 'Book Test Drive',   action: 'book' },
    { id: 'catalog', label: 'Catalogue',         target: { type: 'comm__namedPage', attributes: { name: 'collections__c' } } },
    { id: 'mybookings', label: 'My Bookings',    action: 'mybookings' }
];

const AUTH_TAB = {
    id: 'dealerLogin',
    label: 'Dealer Login',
    target: { type: 'comm__namedPage', attributes: { name: 'dealer-login__c' } }
};

const FONT_STYLE = {
    'Electra GT': 'speed',
    'Electra Sedan': 'speed',
    'Electra SUV': 'dirt',
    'Electra Crossover': 'dirt'
};

const SLIDES = [
    {
        src: EV_IMAGES + '/hero/gt.jpg',
        eyebrow: 'Grand Tourer',
        brandLine: 'Grand Tourer \u00B7 670 HP \u00B7 0\u201360 in 3.2s',
        title: 'Electra GT',
        tagline: 'Born on the track. Built for the road.',
        model: 'Electra GT'
    },
    {
        src: EV_IMAGES + '/hero/suv.jpg',
        eyebrow: 'All-Electric SUV',
        brandLine: 'All-Electric SUV \u00B7 350-mile range \u00B7 7 seats ready',
        title: 'Electra SUV',
        tagline: 'Adventure meets sustainability.',
        model: 'Electra SUV'
    },
    {
        src: EV_IMAGES + '/hero/sedan.jpg',
        eyebrow: 'Luxury Sedan',
        brandLine: 'Luxury Sedan \u00B7 400-mile range \u00B7 Whisper-quiet',
        title: 'Electra Sedan',
        tagline: 'Luxury redefined. Whisper-quiet performance.',
        model: 'Electra Sedan'
    },
    {
        src: EV_IMAGES + '/hero/crossover.jpg',
        eyebrow: 'Urban Crossover',
        brandLine: 'Urban Crossover \u00B7 300-mile range \u00B7 From $38k',
        title: 'Electra Crossover',
        tagline: 'The perfect entry into electric.',
        model: 'Electra Crossover'
    }
];

export default class ElectraHeroCarousel extends NavigationMixin(LightningElement) {
    @api autoPlayInterval = 5000;
    @api hideCaptions = false;

    currentIndex = 0;
    timerHandle;
    paused = false;
    activeTabId = 'home';

    @track rawModels = [];

    @wire(getAllModels)
    wiredModels({ data }) {
        if (data) this.rawModels = data;
    }

    get specsByName() {
        const map = new Map();
        (this.rawModels || []).forEach((m) => map.set(m.name, m));
        return map;
    }

    get showCaptions() {
        return !this.hideCaptions;
    }

    get tabs() {
        return PRIMARY_TABS.map((t) => ({
            ...t,
            className: t.id === this.activeTabId ? 'tab tab--active' : 'tab'
        }));
    }

    get authTab() {
        return {
            ...AUTH_TAB,
            className: AUTH_TAB.id === this.activeTabId ? 'auth-tab auth-tab--active' : 'auth-tab'
        };
    }

    handleTabClick(event) {
        event.preventDefault();
        const id = event.currentTarget.dataset.id;
        const tab = id === AUTH_TAB.id
            ? AUTH_TAB
            : PRIMARY_TABS.find((t) => t.id === id);
        if (!tab) return;
        this.activeTabId = id;
        if (tab.action === 'book') {
            openBooking({ source: 'hero-nav' });
            return;
        }
        if (tab.action === 'mybookings') {
            openMyBookings({ source: 'hero-nav' });
            return;
        }
        if (tab.target) {
            try {
                this[NavigationMixin.Navigate](tab.target);
            } catch (e) {
                // ignore — navigation target may not resolve outside Experience Cloud
            }
        }
    }

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
        this.startAutoPlay();
    }

    disconnectedCallback() {
        this.stopAutoPlay();
    }

    get slides() {
        const total = SLIDES.length;
        const specsByName = this.specsByName;
        return SLIDES.map((s, i) => {
            const style = FONT_STYLE[s.title] || 'speed';
            const liveSpecs = specsByName.get(s.title);
            return {
                ...s,
                brandLine: composeBrandLine(s.title, liveSpecs, s.brandLine),
                key: `slide-${i}`,
                className: i === this.currentIndex ? 'slide slide--active' : 'slide',
                counter: `${String(i + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`,
                titleClass: `title title--${style}`,
                brandLineClass: `brand-line brand-line--${style}`
            };
        });
    }

    get dots() {
        return SLIDES.map((_, i) => ({
            key: `dot-${i}`,
            index: String(i),
            className: i === this.currentIndex ? 'dot dot--active' : 'dot',
            label: `Go to slide ${i + 1}`
        }));
    }

    get activeSlide() {
        return SLIDES[this.currentIndex] || SLIDES[0];
    }

    startAutoPlay() {
        this.stopAutoPlay();
        const interval = Math.max(2000, Number(this.autoPlayInterval) || 5000);
        this.timerHandle = setInterval(() => {
            if (!this.paused) {
                this.advance(1);
            }
        }, interval);
    }

    stopAutoPlay() {
        if (this.timerHandle) {
            clearInterval(this.timerHandle);
            this.timerHandle = undefined;
        }
    }

    advance(step) {
        const len = SLIDES.length;
        this.currentIndex = (this.currentIndex + step + len) % len;
    }

    handleNext() {
        this.advance(1);
        this.restartTimer();
    }

    handlePrev() {
        this.advance(-1);
        this.restartTimer();
    }

    handleDot(event) {
        const i = Number(event.currentTarget.dataset.index);
        if (!Number.isNaN(i)) {
            this.currentIndex = i;
            this.restartTimer();
        }
    }

    handleMouseEnter() {
        this.paused = true;
    }

    handleMouseLeave() {
        this.paused = false;
    }

    handleBook() {
        openChat({ model: this.activeSlide.model, source: 'hero-carousel' });
    }

    handleKeyDown(event) {
        if (event.key === 'ArrowRight') {
            this.handleNext();
        } else if (event.key === 'ArrowLeft') {
            this.handlePrev();
        }
    }

    restartTimer() {
        this.startAutoPlay();
    }
}