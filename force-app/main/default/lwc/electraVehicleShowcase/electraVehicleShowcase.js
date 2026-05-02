import { LightningElement, wire, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import { openBooking } from 'c/electraBookingBridge';
import getAllModels from '@salesforce/apex/TD_VehicleCatalogueController.getAllModels';
import EV_IMAGES from '@salesforce/resourceUrl/electraEvImages';
import FONTS from '@salesforce/resourceUrl/electraFonts';

// Starting-price + image-filename live outside VehicleDefinition (no price field
// on the standard object; images live in the electraEvImages static resource).
// Everything else — name, body type, range, 0-60, power — comes from the org.
const PRICING = {
    'Electra GT': '$52,000',
    'Electra SUV': '$48,000',
    'Electra Sedan': '$45,000',
    'Electra Crossover': '$38,000'
};

const IMAGE_FILES = {
    'Electra GT': 'GT.jpg',
    'Electra SUV': 'SUV.jpg',
    'Electra Sedan': 'Sedan.jpg',
    'Electra Crossover': 'Crossover.jpg'
};

const ORDER = ['Electra GT', 'Electra SUV', 'Electra Sedan', 'Electra Crossover'];

// Normalize "3.2 seconds (0-60 mph)" -> "3.2s" for compact display
function tightSeconds(value) {
    if (!value && value !== 0) return value;
    return String(value).replace(/\bseconds?\b.*$/i, 's').replace(/\s+/g, ' ').trim();
}

export default class ElectraVehicleShowcase extends LightningElement {
    @track rawModels = [];
    @track loadError;
    @track exploreOpen = false;
    @track activeExploreId;

    @wire(getAllModels)
    wiredModels({ data, error }) {
        if (data) {
            this.rawModels = data;
            this.loadError = undefined;
        } else if (error) {
            this.loadError = error;
            this.rawModels = [];
        }
    }

    get vehicles() {
        const byName = new Map((this.rawModels || []).map((m) => [m.name, m]));
        return ORDER
            .filter((n) => byName.has(n))
            .map((n) => {
                const m = byName.get(n);
                return {
                    Id: m.id,
                    Name: m.name,
                    BodyType: m.bodyType || '',
                    MaximumBatteryRange: m.maximumBatteryRange || '',
                    AccelerationTime: tightSeconds(m.accelerationTime) || '',
                    TotalPower: m.totalPower || '',
                    MaximumTorque: m.maximumTorque || '',
                    TopSpeed: m.topSpeed || '',
                    BatteryCapacity: m.batteryCapacity || '',
                    DoorCount: m.doorCount != null ? String(m.doorCount) : '',
                    startingPrice: PRICING[n] || '',
                    imageUrl: IMAGE_FILES[n] ? `${EV_IMAGES}/${IMAGE_FILES[n]}` : null
                };
            });
    }

    get hasVehicles() {
        return this.vehicles.length > 0;
    }

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    handleExplore(event) {
        const recordId = event.currentTarget.dataset.id;
        this.activeExploreId = recordId;
        this.exploreOpen = true;
    }

    handleCloseExplore() {
        this.exploreOpen = false;
        this.activeExploreId = undefined;
    }

    handleScrimClick(event) {
        if (event.target === event.currentTarget) this.handleCloseExplore();
    }

    handleExploreKeydown(event) {
        if (event.key === 'Escape') this.handleCloseExplore();
    }

    handleBookFromExplore() {
        const m = this.activeExploreModel;
        if (m) openBooking({ model: m.Name, source: 'showcase-explore' });
        this.handleCloseExplore();
    }

    get activeExploreModel() {
        if (!this.activeExploreId) return null;
        return this.vehicles.find((v) => v.Id === this.activeExploreId) || null;
    }

    get exploreSpecs() {
        const m = this.activeExploreModel;
        if (!m) return [];
        return [
            { key: 'range',   label: 'Range',     value: m.MaximumBatteryRange, accent: true },
            { key: 'accel',   label: '0–60 mph',  value: m.AccelerationTime,    accent: true },
            { key: 'top',     label: 'Top Speed', value: m.TopSpeed,            accent: false },
            { key: 'power',   label: 'Power',     value: m.TotalPower,          accent: true },
            { key: 'torque',  label: 'Torque',    value: m.MaximumTorque,       accent: false },
            { key: 'battery', label: 'Battery',   value: m.BatteryCapacity,     accent: false },
            { key: 'doors',   label: 'Doors',     value: m.DoorCount,           accent: false },
            { key: 'body',    label: 'Body Type', value: m.BodyType,            accent: false }
        ]
            .filter((s) => s.value)
            .map((s) => ({
                ...s,
                valueClass: s.accent ? 'espec__value espec__value--accent' : 'espec__value'
            }));
    }

    get exploreChart() {
        const m = this.activeExploreModel;
        if (!m) return null;
        // Deterministic "shape" per model — EVs have a characteristic curve:
        // torque = flat plateau then decline at top speed, power = smooth rise then plateau near peak.
        // We anchor the curves to each model's relative performance so the shapes feel distinct.
        const PROFILES = {
            'Electra GT':        { torque: 'M 40,70 C 140,70 240,70 280,72 Q 340,82 410,130',
                                   power:  'M 40,160 C 110,150 170,128 220,96 Q 310,52 410,48' },
            'Electra SUV':       { torque: 'M 40,80 C 140,80 230,80 270,82 Q 330,96 410,140',
                                   power:  'M 40,164 C 110,158 170,140 220,112 Q 310,74 410,66' },
            'Electra Sedan':    { torque: 'M 40,72 C 140,72 240,72 282,74 Q 340,86 410,126',
                                   power:  'M 40,158 C 110,148 170,126 220,92 Q 310,52 410,54' },
            'Electra Crossover': { torque: 'M 40,90 C 140,90 230,90 268,92 Q 330,108 410,150',
                                   power:  'M 40,170 C 110,164 170,148 220,122 Q 310,86 410,80' }
        };
        const profile = PROFILES[m.Name] || PROFILES['Electra GT'];
        return {
            torquePath: profile.torque,
            powerPath: profile.power,
            torqueFill: `${profile.torque} L 410,170 L 40,170 Z`,
            powerFill: `${profile.power} L 410,170 L 40,170 Z`,
            powerLabel: m.TotalPower || '',
            torqueLabel: m.MaximumTorque || ''
        };
    }

    handleBook(event) {
        const model = event.currentTarget.dataset.model;
        openBooking({ model, source: 'showcase' });
    }

    handlePrev() {
        this.scrollByStep(-1);
    }

    handleNext() {
        this.scrollByStep(1);
    }

    scrollByStep(direction) {
        const track = this.template.querySelector('.track');
        if (!track) return;
        const card = track.querySelector('.card');
        const gap = 32;
        const step = (card ? card.offsetWidth : track.offsetWidth * 0.78) + gap;
        track.scrollBy({ left: step * direction, behavior: 'smooth' });
    }

    handleTilt(event) {
        const card = event.currentTarget;
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        const rotY = x * 10;
        const rotX = -y * 7;
        card.style.transform = `perspective(1400px) rotateY(${rotY}deg) rotateX(${rotX}deg) translateY(-6px)`;
        const img = card.querySelector('.car-img');
        if (img) {
            img.style.transform = `translate3d(${x * 26}px, ${y * 14}px, 40px) scale(1.06)`;
        }
        const shine = card.querySelector('.shine');
        if (shine) {
            shine.style.background = `radial-gradient(circle at ${(x + 0.5) * 100}% ${(y + 0.5) * 100}%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 55%)`;
        }
    }

    handleTiltReset(event) {
        const card = event.currentTarget;
        card.style.transform = '';
        const img = card.querySelector('.car-img');
        if (img) img.style.transform = '';
        const shine = card.querySelector('.shine');
        if (shine) shine.style.background = '';
    }
}