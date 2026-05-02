import { LightningElement, wire, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import getActiveDealers from '@salesforce/apex/TD_DealerLocatorController.getActiveDealers';
import { openBooking } from 'c/electraBookingBridge';
import FONTS from '@salesforce/resourceUrl/electraFonts';
import EV_IMAGES from '@salesforce/resourceUrl/electraEvImages';

const SHOWROOM_PROFILES = {
    'Electra Downtown SF': {
        tagline: 'Our flagship on the Embarcadero.',
        blurb: 'Walk-in test drives, a barista bar, and the West Coast\u2019s largest indoor EV delivery lounge.',
        images: ['sf1.jpg', 'sf2.jpg'],
        features: [
            { icon: '\u26A1', value: '8 DC bays' },
            { icon: '\u2615', value: 'Barista bar' },
            { icon: '\uD83C\uDFAF', value: 'White-glove' },
            { icon: '\u2605', value: 'Concierge' }
        ]
    },
    'Electra Bay Area South': {
        tagline: 'Where Silicon Valley takes the wheel.',
        blurb: 'Tech wall, OTA demos, and a closed-track Experience Drive with performance coaches.',
        images: ['sj1.jpg', 'sj2.jpg'],
        features: [
            { icon: '\u26A1', value: '6 DC bays' },
            { icon: '\uD83C\uDFC1', value: 'Closed track' },
            { icon: '\uD83D\uDCBB', value: 'OTA demos' },
            { icon: '\u2605', value: 'By appt.' }
        ]
    },
    'Electra East Bay': {
        tagline: 'The home of hands-on Electra.',
        blurb: 'Service pros on the floor, charging coaches on call, and the Bay\u2019s friendliest family lounge.',
        images: ['oak1.jpg', 'oak2.jpg'],
        features: [
            { icon: '\u26A1', value: '4 DC bays' },
            { icon: '\uD83D\uDD27', value: 'Same-day' },
            { icon: '\uD83E\uDDF8', value: 'Family lounge' },
            { icon: '\u2605', value: 'Concierge' }
        ]
    },
    'Electra Peninsula': {
        tagline: 'A boutique experience on University Ave.',
        blurb: 'Curated demos, a design studio for configuring your Electra, and a weekend wine & charge bar.',
        images: ['pa1.jpg', 'pa2.jpg'],
        features: [
            { icon: '\u26A1', value: '6 DC bays' },
            { icon: '\uD83C\uDFA8', value: 'Design studio' },
            { icon: '\uD83C\uDF77', value: 'Wine bar' },
            { icon: '\u2605', value: 'By appt.' }
        ]
    }
};

const DEFAULT_PROFILE = {
    tagline: 'Experience Electra in person.',
    blurb: 'Hands-on demos, charging coaches, and a no-pressure test drive whenever you\u2019re ready.',
    images: ['sf1.jpg', 'sf2.jpg'],
    features: [
        { icon: '\u26A1', value: 'Charging' },
        { icon: '\u23F1', value: '30-min drive' },
        { icon: '\u2605', value: 'Concierge' },
        { icon: '\uD83D\uDCCD', value: 'Bay Area' }
    ]
};

const HOURS = [
    { key: 'weekday', label: 'Mon \u2013 Fri', value: '10:00 AM \u2013 7:00 PM' },
    { key: 'saturday', label: 'Saturday', value: '10:00 AM \u2013 7:00 PM' },
    { key: 'sunday', label: 'Sunday', value: '11:00 AM \u2013 5:00 PM' }
];

function countZipsServed(zipsServed) {
    if (!zipsServed) return null;
    return zipsServed.split(/[,\n;]+/).map((z) => z.trim()).filter(Boolean).length;
}

function fullAddress(d) {
    const street = d.address || '';
    const cityState = [d.city, d.state].filter(Boolean).join(', ');
    const zip = d.zipCode || '';
    return [street, [cityState, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
}

function directionsUrl(d) {
    const parts = [d.address, d.city, d.state, d.zipCode].filter(Boolean).join(', ');
    if (!parts && d.latitude && d.longitude) {
        return `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts)}`;
}

function telHref(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    return digits ? `tel:${digits}` : null;
}

export default class ElectraShowrooms extends LightningElement {
    @track rawDealers = [];
    @track loadError;
    @track activeImages = {};

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    @wire(getActiveDealers)
    wired({ data, error }) {
        if (data) {
            this.rawDealers = data;
            this.loadError = undefined;
        } else if (error) {
            this.loadError = error;
            this.rawDealers = [];
        }
    }

    get hasDealers() {
        return this.rawDealers && this.rawDealers.length > 0;
    }

    get showEmptyState() {
        return !this.loadError && this.rawDealers && this.rawDealers.length === 0;
    }

    get subtitle() {
        const n = this.rawDealers ? this.rawDealers.length : 0;
        if (!n) return 'New showrooms opening soon.';
        const word = n === 1 ? 'showroom' : 'showrooms';
        return `${n} Bay Area ${word}. Walk in, plug in, take the wheel.`;
    }

    get processedShowrooms() {
        return (this.rawDealers || []).map((d, i) => {
            const profile = SHOWROOM_PROFILES[d.name] || DEFAULT_PROFILE;
            const zipCount = countZipsServed(d.zipsServed);
            const features = profile.features.map((f, j) => ({ ...f, key: `${d.id}-f-${j}` }));
            const activeIdx = this.activeImages[d.id] || 0;
            const images = (profile.images || []).map((file, j) => ({
                key: `${d.id}-img-${j}`,
                src: `${EV_IMAGES}/showrooms/${file}`,
                alt: `${d.name} \u2013 photo ${j + 1}`,
                className: j === activeIdx ? 'shot shot--active' : 'shot'
            }));
            const dots = (profile.images || []).map((_, j) => ({
                key: `${d.id}-dot-${j}`,
                dealerId: d.id,
                index: String(j),
                className: j === activeIdx ? 'gdot gdot--active' : 'gdot',
                label: `Show photo ${j + 1}`
            }));
            return {
                id: d.id,
                name: d.name,
                city: d.city,
                state: d.state,
                cityState: [d.city, d.state].filter(Boolean).join(', '),
                address: fullAddress(d),
                phone: d.phone,
                telHref: telHref(d.phone),
                zipCode: d.zipCode,
                zipCountLabel: zipCount ? `${zipCount} ZIPs` : null,
                tagline: profile.tagline,
                blurb: profile.blurb,
                features,
                images,
                dots,
                hours: HOURS.map((h) => ({ ...h, key: `${d.id}-h-${h.key}` })),
                indexLabel: String(i + 1).padStart(2, '0'),
                directionsHref: directionsUrl(d)
            };
        });
    }

    handleBook(event) {
        const id = event.currentTarget.dataset.id;
        const dealer = this.rawDealers.find((d) => d.id === id);
        if (dealer) {
            openBooking({
                source: 'showrooms',
                dealerId: dealer.accountId || dealer.id,
                dealerName: dealer.name,
                dealerCity: dealer.city
            });
        } else {
            openBooking({ source: 'showrooms' });
        }
    }

    handleDirectionsClick(event) {
        event.stopPropagation();
    }

    handleImageDot(event) {
        event.stopPropagation();
        const dealerId = event.currentTarget.dataset.card;
        const index = Number(event.currentTarget.dataset.index);
        if (!dealerId || Number.isNaN(index)) return;
        this.activeImages = { ...this.activeImages, [dealerId]: index };
    }
}