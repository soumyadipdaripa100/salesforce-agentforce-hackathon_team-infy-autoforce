import { LightningElement, api, track } from 'lwc';
import handleMessage from '@salesforce/apex/TD_AgentChat.handleMessage';

const QUICK_REPLIES_INITIAL = [
    'Book a test drive',
    'What models do you have?',
    'Show me Crossover specs',
    'Slots tomorrow?'
];
const QUICK_REPLIES_MID = [
    'Yes, confirm',
    'Tomorrow 3pm works',
    'Zip 94105',
    'Switch to Sedan'
];
const QUICK_REPLIES_AFTER = [
    'Thanks!',
    'Reschedule please',
    'Show my booking',
    'Cancel'
];

function nowTime() {
    const d = new Date();
    let h = d.getHours();
    const m = String(d.getMinutes()).padStart(2, '0');
    const ampm = h >= 12 ? 'PM' : 'AM';
    h = h % 12 || 12;
    return `${h}:${m} ${ampm}`;
}

function shortId() {
    return Math.random().toString(36).slice(2, 10);
}

function detectBookingMention(text) {
    if (!text) return false;
    const s = text.toLowerCase();
    return s.includes('booking') &&
        (s.includes('confirm') || s.includes('booked') || s.includes('td-') || s.includes('reference'));
}

export default class ElectraSocialDock extends LightningElement {
    @api whatsappPhone = '+919876543210';
    @api whatsappMessage = "Hi! I'd like to book a test drive with Electra EV.";
    @api instagramHandle = 'electraev';
    @api facebookHandle = 'electraev';
    @api delaySeconds = 2;
    @api topOffsetVh = 42;
    @api tooltipText = 'Express Booking using WhatsApp';
    @api agentApiName = '';
    @api customerName = 'Electra EV';

    @track visible = false;
    @track tooltipDismissed = false;

    // Chat-modal state
    @track chatOpen = false;
    @track messages = [];
    @track sessionId = null;
    @track isThinking = false;
    @track inputValue = '';
    @track lastError;
    @track turnCount = 0;
    @track bookingConfirmed = false;

    _timer;

    connectedCallback() {
        const delay = Math.max(0, parseInt(this.delaySeconds, 10) || 0) * 1000;
        this._timer = setTimeout(() => { this.visible = true; }, delay);
    }

    disconnectedCallback() {
        if (this._timer) clearTimeout(this._timer);
    }

    // ----- Dock visuals -----

    get dockStyle() {
        const v = parseInt(this.topOffsetVh, 10);
        return `top: ${isNaN(v) ? 42 : v}vh;`;
    }

    get dockClass() {
        return this.visible ? 'dock dock--in' : 'dock';
    }

    get tooltipVisible() {
        return !this.tooltipDismissed && !!(this.tooltipText && this.tooltipText.trim());
    }

    handleTooltipDismiss(event) {
        if (event) { event.stopPropagation(); event.preventDefault(); }
        this.tooltipDismissed = true;
    }

    get instagramUrl() {
        const handle = (this.instagramHandle || '').replace(/^@/, '');
        return `https://www.instagram.com/${handle}/`;
    }

    get facebookUrl() {
        return `https://www.facebook.com/${this.facebookHandle || ''}`;
    }

    // ----- WhatsApp click — open modal (or fallback to wa.me) -----

    handleWhatsAppClick(event) {
        event.preventDefault();
        this.chatOpen = true;
    }

    handleClose() {
        this.chatOpen = false;
    }

    handleScrimClick(event) {
        if (event.target.classList && event.target.classList.contains('scrim')) {
            this.chatOpen = false;
        }
    }

    // ----- Chat -----

    get hasAgentName() { return !!(this.agentApiName && this.agentApiName.trim()); }

    get quickReplies() {
        if (this.bookingConfirmed) return QUICK_REPLIES_AFTER;
        if (this.turnCount === 0) return QUICK_REPLIES_INITIAL;
        return QUICK_REPLIES_MID;
    }

    get bubbles() {
        return this.messages.map((m) => ({
            ...m,
            bubbleClass: m.role === 'customer' ? 'bubble bubble--out' : 'bubble bubble--in'
        }));
    }

    get hasMessages() { return this.messages.length > 0; }

    handleInput(event) { this.inputValue = event.target.value; }

    handleKeydown(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            this.sendCurrent();
        }
    }

    handleClickSend() { this.sendCurrent(); }

    handleQuickReply(event) {
        const text = event.currentTarget.dataset.text;
        if (text) this.sendText(text);
    }

    handleReset() {
        this.messages = [];
        this.sessionId = null;
        this.isThinking = false;
        this.inputValue = '';
        this.lastError = undefined;
        this.turnCount = 0;
        this.bookingConfirmed = false;
    }

    sendCurrent() {
        const text = (this.inputValue || '').trim();
        if (!text) return;
        this.inputValue = '';
        this.sendText(text);
    }

    async sendText(text) {
        if (this.isThinking) return;
        if (!this.hasAgentName) {
            this.lastError = 'Agent API name not configured. Set it on the App Page property.';
            return;
        }
        this.appendMessage('customer', text);
        this.isThinking = true;
        this.lastError = undefined;
        try {
            const result = await handleMessage({
                agentApiName: this.agentApiName,
                sessionId: this.sessionId,
                userMessage: text
            });
            if (!result || !result.success) {
                this.lastError = (result && result.errorMessage) || 'Unknown agent error';
                return;
            }
            if (result.sessionId) this.sessionId = result.sessionId;
            const reply = result.agentResponse || '(empty agent reply)';
            this.appendMessage('agent', reply);
            this.turnCount += 1;
            if (detectBookingMention(reply)) this.bookingConfirmed = true;
        } catch (err) {
            this.lastError = (err && err.body && err.body.message) || (err && err.message) || String(err);
        } finally {
            this.isThinking = false;
        }
    }

    appendMessage(role, text) {
        this.messages = [
            ...this.messages,
            { id: shortId(), role, text, ts: nowTime() }
        ];
        Promise.resolve().then(() => {
            const el = this.template.querySelector('.bubbles');
            if (el) el.scrollTop = el.scrollHeight;
        });
    }
}