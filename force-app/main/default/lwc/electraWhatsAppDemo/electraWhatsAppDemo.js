import { LightningElement, api, track } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import handleMessage from '@salesforce/apex/TD_AgentChat.handleMessage';
import FONTS from '@salesforce/resourceUrl/electraFonts';

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

function initialsOf(name) {
    if (!name) return 'CU';
    const parts = String(name).trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'CU';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function detectBookingMention(text) {
    if (!text) return false;
    const s = text.toLowerCase();
    return s.includes('booking') && (s.includes('confirm') || s.includes('booked') || s.includes('td-') || s.includes('reference'));
}

export default class ElectraWhatsAppDemo extends LightningElement {
    @api pageTitle = 'WhatsApp Booking — Live Agentforce Demo';
    @api agentApiName = '';
    @api customerName = 'Priya Sharma';
    @api customerPhone = '+91 98765 43210';

    @track messages = [];
    @track sessionId = null;
    @track isThinking = false;
    @track inputValue = '';
    @track lastError;
    @track turnCount = 0;
    @track bookingConfirmed = false;

    _fontsLoaded = false;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
    }

    // ----- Derived view state -----

    get hasAgentName() { return !!(this.agentApiName && this.agentApiName.trim()); }

    get customerInitials() { return initialsOf(this.customerName); }

    get quickReplies() {
        if (this.bookingConfirmed) return QUICK_REPLIES_AFTER;
        if (this.turnCount === 0) return QUICK_REPLIES_INITIAL;
        return QUICK_REPLIES_MID;
    }

    // Customer-side bubbles: customer = outgoing (right), agent = incoming (left)
    get customerBubbles() {
        return this.messages.map((m) => ({
            ...m,
            bubbleClass: m.role === 'customer'
                ? 'bubble bubble--out'
                : 'bubble bubble--in'
        }));
    }

    // Business-side bubbles: customer = incoming (left), agent = outgoing (right) + AI badge
    get businessBubbles() {
        return this.messages.map((m) => ({
            ...m,
            bubbleClass: m.role === 'customer'
                ? 'bubble bubble--in bubble--biz-in'
                : 'bubble bubble--out bubble--biz-out',
            isAgent: m.role === 'agent'
        }));
    }

    get hasMessages() { return this.messages.length > 0; }

    // ----- Input handlers -----

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

    // ----- Core conversation step -----

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

    // ----- Helpers -----

    appendMessage(role, text) {
        this.messages = [
            ...this.messages,
            { id: shortId(), role, text, ts: nowTime() }
        ];
        this.scrollChatsToBottom();
    }

    scrollChatsToBottom() {
        Promise.resolve().then(() => {
            const lists = this.template.querySelectorAll('.bubbles');
            lists.forEach((el) => { el.scrollTop = el.scrollHeight; });
        });
    }
}