import { LightningElement, wire } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import FONTS from '@salesforce/resourceUrl/electraFonts';
import IMAGES from '@salesforce/resourceUrl/electraEvImages';
import getAllModels from '@salesforce/apex/TD_VehicleCatalogueController.getAllModels';
import { openChat } from 'c/electraChatBridge';

// Curated marketing copy + image + price per model name. Merged with VehicleDefinition data from the org.
const COPY = {
    'Electra GT': {
        num: '01',
        badge: 'GRAND TOURER',
        tagline: 'Born on the track. Built for the road.',
        description: 'The GT is the pinnacle of what an electric drivetrain can deliver. Twin permanent-magnet motors, track-tuned suspension, and aerodynamics shaped in a full-scale wind tunnel. Zero emissions. No compromises.',
        image: 'GT.jpg',
        fontStyle: 'speed',
        price: '$52,000',
        highlight: 'Flagship Performance',
        order: 1
    },
    'Electra SUV': {
        num: '02',
        badge: 'ALL-ELECTRIC SUV',
        tagline: 'Adventure meets sustainability.',
        description: 'Seven-seat capability, 350-mile range, and off-road DNA. The Electra SUV carries your family further than any combustion SUV ever could, with none of the emissions and twice the silence.',
        image: 'SUV.jpg',
        fontStyle: 'dirt',
        price: '$48,000',
        highlight: 'Best-in-Class Range',
        order: 2
    },
    'Electra Sedan': {
        num: '03',
        badge: 'LUXURY SEDAN',
        tagline: 'Luxury redefined. Whisper-quiet performance.',
        description: 'Hand-stitched leather, an electrochromic glass roof, and the longest range of any Electra. The Sedan is an executive suite on four wheels — and the quickest way from here to your next idea.',
        image: 'Sedan.jpg',
        fontStyle: 'speed',
        price: '$45,000',
        highlight: 'Longest Range',
        order: 3
    },
    'Electra Crossover': {
        num: '04',
        badge: 'URBAN CROSSOVER',
        tagline: 'The perfect entry into electric.',
        description: 'Compact. Nimble. Unmistakably Electra. The Crossover brings our design language and drivetrain to the everyday. Charge overnight, drive all week, and arrive everywhere without a drop of gasoline.',
        image: 'Crossover.jpg',
        fontStyle: 'dirt',
        price: '$38,000',
        highlight: 'Most Affordable',
        order: 4
    }
};

function shortId(name) {
    // Stable short id derived from model name: "Electra GT" -> "gt"
    return (name || '').replace(/^Electra\s+/i, '').toLowerCase().replace(/\s+/g, '-');
}

function tight(value) {
    if (!value && value !== 0) return '';
    return String(value)
        .replace(/\bseconds?\b.*$/i, 's')
        .replace(/\bmiles\b/i, 'mi')
        .replace(/\s+/g, ' ')
        .trim();
}

export default class ElectraProductCatalogue extends LightningElement {
    activeId;
    fontsLoaded = false;
    raw = [];
    loadError;

    @wire(getAllModels)
    wired({ data, error }) {
        if (data) {
            this.raw = [...data].sort((a, b) => {
                const ao = (COPY[a.name] && COPY[a.name].order) || 99;
                const bo = (COPY[b.name] && COPY[b.name].order) || 99;
                return ao - bo;
            });
            if (!this.activeId && this.raw.length > 0) {
                this.activeId = shortId(this.raw[0].name);
            }
            this.loadError = undefined;
        } else if (error) {
            this.loadError = error;
            this.raw = [];
        }
    }

    connectedCallback() {
        if (!this.fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this.fontsLoaded = true;
        }
    }

    get models() {
        return this.raw.map((v) => {
            const copy = COPY[v.name] || {};
            return {
                ...v,
                id: shortId(v.name),
                num: copy.num || '',
                badge: copy.badge || (v.vehicleClass || '').toUpperCase(),
                tagline: copy.tagline || v.variantName || '',
                description: copy.description || '',
                fontStyle: copy.fontStyle || 'speed',
                price: copy.price || '',
                highlight: copy.highlight || v.vehicleClass || '',
                image: copy.image,
                imageUrl: copy.image ? `${IMAGES}/${copy.image}` : null
            };
        });
    }

    get tabs() {
        return this.models.map((m) => ({
            id: m.id,
            num: m.num,
            name: m.name,
            shortName: m.name.replace('Electra ', ''),
            className: m.id === this.activeId ? 'tab tab--active' : 'tab'
        }));
    }

    get activeModel() {
        const m = this.models.find((x) => x.id === this.activeId) || this.models[0];
        if (!m) return null;
        return {
            ...m,
            titleClass: `title title--${m.fontStyle}`
        };
    }

    get hasModels() {
        return this.models.length > 0 && !!this.activeModel;
    }

    get specRows() {
        const m = this.activeModel;
        if (!m) return [];
        const raw = [
            { key: 'range',    label: 'Range',         value: tight(m.maximumBatteryRange),   accent: true },
            { key: 'accel',    label: '0–60 mph',      value: tight(m.accelerationTime),      accent: true },
            { key: 'top',      label: 'Top Speed',     value: tight(m.topSpeed),              accent: false },
            { key: 'power',    label: 'Power',         value: tight(m.totalPower),            accent: false },
            { key: 'torque',   label: 'Torque',        value: tight(m.maximumTorque),         accent: false },
            { key: 'battery',  label: 'Battery',       value: tight(m.batteryCapacity),       accent: false },
            { key: 'drive',    label: 'Drivetrain',    value: m.drivetrainType,               accent: false },
            { key: 'mpge',     label: 'Efficiency',    value: m.combinedFuelEconomy,          accent: false }
        ];
        return raw
            .filter((s) => s.value)
            .slice(0, 6)
            .map((s) => ({
                ...s,
                valueClass: s.accent ? 'spec__value spec__value--accent' : 'spec__value'
            }));
    }

    get compareRows() {
        const rows = [
            { key: 'maximumBatteryRange', label: 'Range' },
            { key: 'accelerationTime',    label: '0–60 mph' },
            { key: 'topSpeed',            label: 'Top Speed' },
            { key: 'totalPower',          label: 'Power' },
            { key: 'maximumTorque',       label: 'Torque' },
            { key: 'batteryCapacity',     label: 'Battery' },
            { key: 'drivetrainType',      label: 'Drivetrain' },
            { key: 'doorCount',           label: 'Doors' }
        ];
        const models = this.models;
        return rows.map((r) => ({
            key: r.key,
            label: r.label,
            values: models.map((m) => ({
                modelId: m.id,
                value: m[r.key] !== null && m[r.key] !== undefined ? tight(String(m[r.key])) : '—'
            }))
        }));
    }

    get compareHeaders() {
        return this.models.map((m) => ({
            id: m.id,
            shortName: m.name.replace('Electra ', ''),
            price: m.price,
            className: m.id === this.activeId ? 'th th--active' : 'th'
        }));
    }

    handleTabClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id && id !== this.activeId) {
            this.activeId = id;
        }
    }

    handleBook() {
        const m = this.activeModel;
        if (m) openChat({ model: m.name, source: 'catalogue' });
    }

    handleConfigure() {
        const m = this.activeModel;
        if (m) openChat({ model: m.name, source: 'catalogue-configure', intent: 'configure' });
    }

    handleCompareColumnClick(event) {
        const id = event.currentTarget.dataset.id;
        if (id) this.activeId = id;
    }
}