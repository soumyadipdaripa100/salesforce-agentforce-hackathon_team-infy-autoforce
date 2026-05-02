import { LightningElement, wire, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import getActiveDealers from '@salesforce/apex/TD_DealerLocatorController.getActiveDealers';
import { openBooking } from 'c/electraBookingBridge';
import FONTS from '@salesforce/resourceUrl/electraFonts';
import EV_IMAGES from '@salesforce/resourceUrl/electraEvImages';

const DEALER_IMAGES = {
    'Electra Downtown SF':     ['sf1.jpg', 'sf2.jpg'],
    'Electra Bay Area South':  ['sj1.jpg', 'sj2.jpg'],
    'Electra East Bay':        ['oak1.jpg', 'oak2.jpg'],
    'Electra Peninsula':       ['pa1.jpg', 'pa2.jpg']
};

const DEFAULT_IMAGES = ['sf1.jpg', 'sf2.jpg'];

const ZIP_CENTROIDS = {
    '94105': { lat: 37.7897, lng: -122.3972 },
    '94607': { lat: 37.8044, lng: -122.2712 },
    '95110': { lat: 37.3383, lng: -121.8863 },
    '94301': { lat: 37.4470, lng: -122.1591 },
    '94102': { lat: 37.7793, lng: -122.4193 },
    '94110': { lat: 37.7509, lng: -122.4153 },
    '94612': { lat: 37.8044, lng: -122.2712 },
    '95112': { lat: 37.3541, lng: -121.8896 },
    '94303': { lat: 37.4419, lng: -122.1430 }
};

const EARTH_MI = 3958.8;

function haversine(a, b) {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_MI * Math.asin(Math.sqrt(h));
}

export default class ElectraDealerLocator extends LightningElement {
    @track rawDealers = [];
    @track selectedId;
    @track zipInput = '';
    @track userPoint;
    @track loadError;
    @track mobileView = 'list';
    @track activeImageIndex = 0;

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    @wire(getActiveDealers)
    wired({ data, error }) {
        if (data) {
            this.rawDealers = data;
            this.loadError = undefined;
            if (!this.selectedId && data.length > 0) {
                this.selectedId = data[0].id;
            }
        } else if (error) {
            this.loadError = error;
            this.rawDealers = [];
        }
    }

    get processedDealers() {
        if (!this.rawDealers) return [];
        const origin = this.userPoint
            || (this.zipInput && ZIP_CENTROIDS[this.zipInput.trim()])
            || null;

        let list = this.rawDealers.map((d) => {
            const dealerPoint = (d.latitude && d.longitude)
                ? { lat: Number(d.latitude), lng: Number(d.longitude) }
                : null;
            const distance = origin && dealerPoint ? haversine(origin, dealerPoint) : null;
            return { ...d, dealerPoint, distance };
        });

        if (origin) {
            list = list
                .filter((d) => d.distance !== null)
                .sort((a, b) => a.distance - b.distance)
                .concat(list.filter((d) => d.distance === null));
        }

        return list.map((d, i) => {
            const idx = String(i + 1).padStart(2, '0');
            const isSelected = d.id === this.selectedId;
            return {
                ...d,
                idxLabel: idx,
                distanceLabel: d.distance !== null ? `${d.distance.toFixed(1)} mi` : '',
                hasDistance: d.distance !== null,
                cardClass: isSelected ? 'card card--selected' : 'card',
                isSelected,
                addressLine: [d.address, d.city, d.state].filter(Boolean).join(', '),
                directionsHref: this.buildDirectionsUrl(d)
            };
        });
    }

    get mapMarkers() {
        return this.processedDealers
            .filter((d) => d.dealerPoint)
            .map((d) => ({
                location: {
                    Latitude: d.dealerPoint.lat,
                    Longitude: d.dealerPoint.lng
                },
                value: d.id,
                title: d.name,
                description: [d.addressLine, d.phone].filter(Boolean).join(' · '),
                icon: 'custom:custom26'
            }));
    }

    get mapCenter() {
        const sel = this.processedDealers.find((d) => d.isSelected && d.dealerPoint);
        if (sel) {
            return { location: { Latitude: sel.dealerPoint.lat, Longitude: sel.dealerPoint.lng } };
        }
        const firstWithPoint = this.processedDealers.find((d) => d.dealerPoint);
        if (firstWithPoint) {
            return {
                location: {
                    Latitude: firstWithPoint.dealerPoint.lat,
                    Longitude: firstWithPoint.dealerPoint.lng
                }
            };
        }
        return { location: { Latitude: 37.7749, Longitude: -122.4194 } };
    }

    get mapZoom() {
        return this.userPoint || (this.zipInput && ZIP_CENTROIDS[this.zipInput.trim()])
            ? 11
            : 9;
    }

    get hasDealers() {
        return this.processedDealers.length > 0;
    }

    get selectedDealer() {
        return this.processedDealers.find((d) => d.isSelected) || null;
    }

    get selectedGallery() {
        const d = this.selectedDealer;
        if (!d) return null;
        const files = DEALER_IMAGES[d.name] || DEFAULT_IMAGES;
        const idx = this.activeImageIndex || 0;
        return {
            images: files.map((file, i) => ({
                key: `${d.id}-img-${i}`,
                src: `${EV_IMAGES}/showrooms/${file}`,
                alt: `${d.name} \u2013 photo ${i + 1}`,
                className: i === idx ? 'hero-img hero-img--active' : 'hero-img'
            })),
            dots: files.map((_, i) => ({
                key: `${d.id}-dot-${i}`,
                index: String(i),
                className: i === idx ? 'hdot hdot--active' : 'hdot',
                label: `Show photo ${i + 1}`
            }))
        };
    }

    get selectedHighlights() {
        const d = this.selectedDealer;
        if (!d) return [];
        const zipCount = d.zipsServed
            ? d.zipsServed.split(/[,\n;]+/).map((z) => z.trim()).filter(Boolean).length
            : null;
        return [
            {
                key: 'test',
                icon: '\u23F1',
                label: 'Test Drive',
                value: '30 min'
            },
            {
                key: 'charge',
                icon: '\u26A1',
                label: 'Charging',
                value: 'DC + L2'
            },
            {
                key: 'specialist',
                icon: '\u2605',
                label: 'Concierge',
                value: 'Certified'
            },
            {
                key: 'zips',
                icon: '\uD83D\uDCCD',
                label: 'Coverage',
                value: zipCount ? `${zipCount} ZIPs` : d.state || '—'
            }
        ];
    }

    get showEmptyState() {
        return !this.loadError && this.rawDealers && this.rawDealers.length === 0;
    }

    get subtitle() {
        const n = this.rawDealers ? this.rawDealers.length : 0;
        if (n === 0) return 'Opening soon';
        const word = n === 1 ? 'showroom' : 'showrooms';
        return `${n} Bay Area ${word}. Book a visit in under a minute.`;
    }

    get headerNote() {
        if (this.userPoint) return 'Ranked by distance from your location';
        if (this.zipInput && ZIP_CENTROIDS[this.zipInput.trim()]) {
            return `Nearest to ${this.zipInput.trim()}`;
        }
        if (this.zipInput && this.zipInput.length === 5) {
            return `We don't cover ${this.zipInput.trim()} yet — showing our closest showrooms`;
        }
        return '';
    }

    get listClass() {
        return this.mobileView === 'list' ? 'pane pane--list pane--active' : 'pane pane--list';
    }

    get mapClass() {
        return this.mobileView === 'map' ? 'pane pane--map pane--active' : 'pane pane--map';
    }

    get listToggleClass() {
        return this.mobileView === 'list' ? 'toggle toggle--active' : 'toggle';
    }

    get mapToggleClass() {
        return this.mobileView === 'map' ? 'toggle toggle--active' : 'toggle';
    }

    handleZipInput(event) {
        const raw = (event.target.value || '').replace(/\D/g, '').slice(0, 5);
        this.zipInput = raw;
        if (this.userPoint) this.userPoint = null;
    }

    handleUseMyLocation() {
        if (!navigator.geolocation) {
            this.loadError = { message: 'Geolocation not supported' };
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.userPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                this.zipInput = '';
                const nearest = this.processedDealers[0];
                if (nearest) this.selectDealer(nearest.id);
            },
            () => {
                this.loadError = { message: 'Location permission denied' };
            },
            { enableHighAccuracy: false, timeout: 5000 }
        );
    }

    handleCardClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id) {
            this.selectDealer(id);
            if (this.mobileView === 'list') this.mobileView = 'map';
        }
    }

    handleMarkerSelect(event) {
        const id = event.detail.selectedMarkerValue;
        if (id) this.selectDealer(id);
    }

    selectDealer(id) {
        if (id && id !== this.selectedId) {
            this.selectedId = id;
            this.activeImageIndex = 0;
        }
    }

    handleImageDot(event) {
        event.stopPropagation();
        const index = Number(event.currentTarget.dataset.index);
        if (!Number.isNaN(index)) {
            this.activeImageIndex = index;
        }
    }

    handleBook(event) {
        event.stopPropagation();
        const id = event.currentTarget.dataset.id;
        const dealer = this.rawDealers.find((d) => d.id === id);
        if (dealer) {
            openBooking({
                source: 'dealer-locator',
                dealerId: dealer.accountId || dealer.id,
                dealerName: dealer.name,
                dealerCity: dealer.city
            });
        }
    }

    handleShowList() {
        this.mobileView = 'list';
    }

    handleShowMap() {
        this.mobileView = 'map';
    }

    handleDirectionsClick(event) {
        event.stopPropagation();
    }

    buildDirectionsUrl(d) {
        const parts = [d.address, d.city, d.state, d.zipCode].filter(Boolean).join(', ');
        if (!parts && d.latitude && d.longitude) {
            return `https://www.google.com/maps/dir/?api=1&destination=${d.latitude},${d.longitude}`;
        }
        return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(parts)}`;
    }
}