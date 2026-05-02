import { LightningElement, wire, track } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import { openChat } from 'c/electraChatBridge';
import getAllModels from '@salesforce/apex/TD_VehicleCatalogueController.getAllModels';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const VEHICLE_ORDER = ['Electra GT', 'Electra SUV', 'Electra Sedan', 'Electra Crossover'];

// Vehicles column is assembled dynamically from the org (see columns getter).
const STATIC_COLUMNS = [
    {
        key: 'experience',
        title: 'Experience',
        items: [
            { key: 'book',      label: 'Book a Test Drive', action: 'chat' },
            { key: 'xp',        label: 'Experience Drive' },
            { key: 'showrooms', label: 'Showrooms' },
            { key: 'charging',  label: 'Charging Network' },
            { key: 'events',    label: 'Events & Launches' }
        ]
    },
    {
        key: 'owners',
        title: 'Owners',
        items: [
            { key: 'mytd',     label: 'My Test Drives' },
            { key: 'support',  label: 'Customer Support' },
            { key: 'service',  label: 'Service & Maintenance' },
            { key: 'roadside', label: 'Roadside Assistance' },
            { key: 'app',      label: 'Electra App' }
        ]
    },
    {
        key: 'company',
        title: 'Company',
        items: [
            { key: 'about',        label: 'About Electra' },
            { key: 'sustain',      label: 'Sustainability' },
            { key: 'news',         label: 'Newsroom' },
            { key: 'careers',      label: 'Careers' },
            { key: 'investors',    label: 'Investors' }
        ]
    }
];

const SOCIAL = [
    { key: 'ig', label: 'Instagram', path: 'M12 2.2c3.2 0 3.6 0 4.8.1 1.2 0 1.9.3 2.4.5.6.2 1 .5 1.5 1s.8.9 1 1.5c.2.5.4 1.2.5 2.4 0 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c0 1.2-.3 1.9-.5 2.4-.2.6-.5 1-1 1.5s-.9.8-1.5 1c-.5.2-1.2.4-2.4.5-1.2 0-1.6.1-4.8.1s-3.6 0-4.8-.1c-1.2 0-1.9-.3-2.4-.5-.6-.2-1-.5-1.5-1s-.8-.9-1-1.5c-.2-.5-.4-1.2-.5-2.4 0-1.2-.1-1.6-.1-4.8s0-3.6.1-4.8c0-1.2.3-1.9.5-2.4.2-.6.5-1 1-1.5s.9-.8 1.5-1c.5-.2 1.2-.4 2.4-.5 1.2 0 1.6-.1 4.8-.1M12 0C8.7 0 8.3 0 7.1.1 5.8.1 5 .3 4.1.7c-.8.4-1.5.8-2.2 1.5S.8 3.4.4 4.2C0 5 .1 5.9.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.1 1.2.3 2.1.7 2.9.4.8.8 1.5 1.5 2.2s1.4 1.2 2.2 1.5c.8.3 1.7.5 2.9.7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c1.2-.1 2.1-.3 2.9-.7.8-.4 1.5-.8 2.2-1.5s1.2-1.4 1.5-2.2c.3-.8.5-1.7.7-2.9.1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9c-.1-1.2-.3-2.1-.7-2.9-.4-.8-.8-1.5-1.5-2.2s-1.4-1.2-2.2-1.5C19 .3 18.1.1 16.9 0 15.7 0 15.3 0 12 0z M12 5.8a6.2 6.2 0 100 12.4 6.2 6.2 0 000-12.4zm0 10.2a4 4 0 110-8 4 4 0 010 8zM19.8 5.6a1.4 1.4 0 11-2.9 0 1.4 1.4 0 012.9 0z' },
    { key: 'tw', label: 'Twitter',   path: 'M22.5 5.3c-.8.4-1.6.6-2.5.7.9-.5 1.6-1.4 1.9-2.4-.8.5-1.8.9-2.7 1.1-.8-.9-2-1.4-3.2-1.4-2.4 0-4.4 2-4.4 4.4 0 .3 0 .7.1 1-3.7-.2-6.9-2-9.1-4.6-.4.7-.6 1.4-.6 2.3 0 1.5.8 2.9 2 3.7-.7 0-1.4-.2-2-.5 0 2.2 1.5 4 3.6 4.4-.4.1-.8.2-1.2.2-.3 0-.6 0-.8-.1.6 1.8 2.2 3.1 4.2 3.1-1.5 1.2-3.5 1.9-5.6 1.9H0c2 1.3 4.4 2.1 7 2.1 8.4 0 13-7 13-13v-.6c.9-.6 1.7-1.4 2.3-2.3z' },
    { key: 'yt', label: 'YouTube',   path: 'M23.5 6.2c-.3-1-1.1-1.8-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5c-1 .3-1.8 1.1-2.1 2.1C0 8.1 0 12 0 12s0 3.9.5 5.8c.3 1 1.1 1.8 2.1 2.1 1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5c1-.3 1.8-1.1 2.1-2.1.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4L15.8 12l-6.2 3.6z' },
    { key: 'li', label: 'LinkedIn',  path: 'M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5V9h3v10zM6.5 7.7a1.7 1.7 0 110-3.4 1.7 1.7 0 010 3.4zM19 19h-3v-5.4c0-1.3-.5-2.1-1.6-2.1-.9 0-1.4.6-1.6 1.2-.1.2-.1.5-.1.8V19h-3V9h3v1.3c.4-.6 1.1-1.5 2.7-1.5 2 0 3.5 1.3 3.5 4V19z' }
];

export default class ElectraFooter extends NavigationMixin(LightningElement) {
    email = '';
    subscribed = false;
    year = new Date().getFullYear();

    @track rawModels = [];

    @wire(getAllModels)
    wiredModels({ data }) {
        if (data) this.rawModels = data;
    }

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    get vehiclesColumn() {
        const byName = new Map((this.rawModels || []).map((m) => [m.name, m]));
        const ordered = VEHICLE_ORDER
            .filter((n) => byName.has(n))
            .map((n) => {
                const m = byName.get(n);
                return { key: m.id, label: n };
            });
        // Fall back to the canonical 4 names if the wire hasn't resolved yet,
        // so the footer never renders an empty column on first paint.
        const items = ordered.length
            ? ordered
            : VEHICLE_ORDER.map((n) => ({ key: n, label: n }));
        items.push({ key: 'all', label: 'Compare Models' });
        return { key: 'vehicles', title: 'Vehicles', items };
    }

    get columns() {
        return [this.vehiclesColumn, ...STATIC_COLUMNS];
    }

    get socials() {
        return SOCIAL;
    }

    get subscribeLabel() {
        return this.subscribed ? 'Subscribed \u2713' : 'Subscribe';
    }

    get subscribeBtnClass() {
        return this.subscribed ? 'newsletter__btn newsletter__btn--done' : 'newsletter__btn';
    }

    handleEmailInput(event) {
        this.email = event.target.value || '';
    }

    handleSubscribe(event) {
        event.preventDefault();
        if (!this.email || !this.email.includes('@')) return;
        this.subscribed = true;
        // Clear state after a few seconds so the user can try again if needed
        setTimeout(() => {
            this.subscribed = false;
            this.email = '';
            const input = this.template.querySelector('.newsletter__input');
            if (input) input.value = '';
        }, 2500);
    }

    handleLinkClick(event) {
        event.preventDefault();
        const action = event.currentTarget.dataset.action;
        if (action === 'chat') {
            openChat({ source: 'footer-link' });
        }
        // Other links are decorative for now; they can be wired to NavigationMixin
        // when the corresponding Experience Cloud pages exist.
    }
}