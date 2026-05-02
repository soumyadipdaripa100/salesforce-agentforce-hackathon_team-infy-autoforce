import { LightningElement, api, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import FONTS from '@salesforce/resourceUrl/electraFonts';

export default class ElectraNavBar extends LightningElement {
    @api brandText;
    @api logoUrl = '';

    @api managerLabel = 'Manager';
    @api managerUrl = '/dealer/s/';
    @api customersLabel = 'Customers';
    @api customersUrl = '/dealer/s/customers';
    @api opportunitiesLabel = 'Opportunities';
    @api opportunitiesUrl = '/dealer/s/opportunities';

    @track currentPath = '';

    _fontsLoaded = false;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
        if (typeof window !== 'undefined' && window.location) {
            this.currentPath = window.location.pathname || '';
        }
    }

    get hasLogoImage() {
        return !!(this.logoUrl && this.logoUrl.trim());
    }

    get items() {
        const path = (this.currentPath || '').replace(/\/+$/, '');
        const norm = (u) => (u || '').replace(/\/+$/, '');
        return [
            { key: 'manager',       label: this.managerLabel,       url: this.managerUrl       },
            { key: 'customers',     label: this.customersLabel,     url: this.customersUrl     },
            { key: 'opportunities', label: this.opportunitiesLabel, url: this.opportunitiesUrl }
        ].map((it) => {
            const target = norm(it.url);
            const active = path === target || (target && path.startsWith(target + '/'));
            return {
                ...it,
                className: active ? 'enav__link enav__link--active' : 'enav__link',
                ariaCurrent: active ? 'page' : null
            };
        });
    }
}