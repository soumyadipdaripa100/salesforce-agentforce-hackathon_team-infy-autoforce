import { LightningElement, api, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const STORAGE_KEY = 'electraChatInvite.dismissed';

// Selectors that match the chat-launch button across MIAW + legacy chat builds.
// Tried in order; first match gets clicked when the invitation is accepted.
const LAUNCH_SELECTORS = [
    'button.embeddedMessagingConversationButton',
    'button.embeddedMessagingFrame',
    'button[aria-label*="Start Chat"]',
    'button[aria-label*="Chat with"]',
    'button.uiButton.embeddedServiceSidebarButton',
    '#embeddedMessagingConversationButton',
    '#embedded-messaging button'
];

export default class ElectraChatInvite extends LightningElement {
    @api delaySeconds = 6;
    @api headline;
    @api message = 'Want to book a Test Drive? Let us know!';
    @api acceptLabel = 'Begin';
    @api dismissLabel = 'Maybe later';
    @api respectDismissal = false;
    @api bottomOffsetPx = 96;
    @api rightOffsetPx = 24;

    @track visible = false;
    @track closing = false;

    _shown = false;
    _timer;
    _fontsLoaded = false;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
        if (this.respectDismissal && this.isDismissed()) return;
        const delay = Math.max(0, parseInt(this.delaySeconds, 10) || 0) * 1000;
        this._timer = setTimeout(() => this.show(), delay);
    }

    disconnectedCallback() {
        if (this._timer) clearTimeout(this._timer);
    }

    get cardClass() {
        return this.closing ? 'ci ci--closing' : 'ci';
    }

    get cardStyle() {
        const b = parseInt(this.bottomOffsetPx, 10);
        const r = parseInt(this.rightOffsetPx, 10);
        return `bottom: ${isNaN(b) ? 96 : b}px; right: ${isNaN(r) ? 24 : r}px;`;
    }

    isDismissed() {
        try { return sessionStorage.getItem(STORAGE_KEY) === '1'; }
        catch (e) { return false; }
    }

    rememberDismissal() {
        try { sessionStorage.setItem(STORAGE_KEY, '1'); }
        catch (e) { /* sessionStorage unavailable — silently ignore */ }
    }

    show() {
        if (this._shown) return;
        this._shown = true;
        this.visible = true;
    }

    hide() {
        this.closing = true;
        setTimeout(() => {
            this.visible = false;
            this.closing = false;
        }, 220);
    }

    handleDismiss() {
        if (this.respectDismissal) this.rememberDismissal();
        this.hide();
    }

    handleAccept() {
        // Modern MIAW launch API
        try {
            const bs = window.embeddedservice_bootstrap;
            if (bs && bs.utilAPI && typeof bs.utilAPI.launchChat === 'function') {
                bs.utilAPI.launchChat();
                this.hide();
                return;
            }
        } catch (e) { /* fall through to selector-click fallback */ }

        // Fallback: programmatically click the chat bubble in the DOM
        for (const sel of LAUNCH_SELECTORS) {
            try {
                const el = document.querySelector(sel);
                if (el && typeof el.click === 'function') {
                    el.click();
                    this.hide();
                    return;
                }
            } catch (e) { /* continue trying */ }
        }

        // No launch target found — close anyway so the invite doesn't linger
        this.hide();
    }
}