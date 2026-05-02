import { LightningElement, api } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import { loadStyle } from 'lightning/platformResourceLoader';
import { openBooking, openMyBookings } from 'c/electraBookingBridge';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const PRIMARY_TABS = [
    { id: 'home',        label: 'Home',              target: { type: 'comm__namedPage', attributes: { name: 'Home' } } },
    { id: 'dealer',      label: 'Dealer Locator',    target: { type: 'comm__namedPage', attributes: { name: 'showrooms__c' } } },
    { id: 'book',        label: 'Book Test Drive',   action: 'book' },
    { id: 'catalog',     label: 'Catalogue', target: { type: 'comm__namedPage', attributes: { name: 'collections__c' } } },
    { id: 'mybookings',  label: 'My Bookings',       action: 'mybookings' }
];

const AUTH_TAB = {
    id: 'dealerLogin',
    label: 'Dealer Login',
    target: { type: 'comm__namedPage', attributes: { name: 'dealerdashboard__c' } }
};

export default class ElectraTopNav extends NavigationMixin(LightningElement) {
    @api activePage = 'home';

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    get tabs() {
        return PRIMARY_TABS.map((t) => ({
            ...t,
            className: t.id === this.activePage ? 'tab tab--active' : 'tab'
        }));
    }

    get authTab() {
        return {
            ...AUTH_TAB,
            className: AUTH_TAB.id === this.activePage ? 'auth-tab auth-tab--active' : 'auth-tab'
        };
    }

    handleTabClick(event) {
        event.preventDefault();
        const id = event.currentTarget.dataset.id;
        const tab = id === AUTH_TAB.id
            ? AUTH_TAB
            : PRIMARY_TABS.find((t) => t.id === id);
        if (!tab) return;

        if (tab.action === 'book') {
            openBooking({ source: 'top-nav' });
            return;
        }

        if (tab.action === 'mybookings') {
            openMyBookings({ source: 'top-nav' });
            return;
        }

        if (tab.target) {
            try {
                this[NavigationMixin.Navigate](tab.target);
            } catch (e) {
                // navigation target may not resolve outside Experience Cloud
            }
        }
    }

    handleBrandClick(event) {
        event.preventDefault();
        try {
            this[NavigationMixin.Navigate]({
                type: 'comm__namedPage',
                attributes: { name: 'Home' }
            });
        } catch (e) {
            // ignore
        }
    }
}