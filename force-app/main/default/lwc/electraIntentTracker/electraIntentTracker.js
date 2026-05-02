import { LightningElement } from 'lwc';
import { subscribe, unsubscribe, onError } from 'lightning/empApi';
import { openChat } from 'c/electraChatBridge';
import logEngagement from '@salesforce/apex/TD_IntentController.logEngagement';

const NUDGE_THRESHOLD = 60;
const VISIT_KEY = 'electra_visited';
const NUDGE_KEY = 'electra_nudge_shown';
const VISITOR_KEY = 'electra_visitor_id';
const NUDGE_EVENT_CHANNEL = '/event/Visitor_Intent_Threshold_Crossed__e';

export default class ElectraIntentTracker extends LightningElement {
    timeOnPage = 0;
    maxScrollDepth = 0;
    isReturnVisit = false;
    nudgeFired = false;
    tickHandle;
    visitorId;
    sessionId;
    nudgeSubscription;

    connectedCallback() {
        try {
            if (sessionStorage.getItem(NUDGE_KEY)) {
                this.nudgeFired = true;
            }
            if (localStorage.getItem(VISIT_KEY)) {
                this.isReturnVisit = true;
            }
            localStorage.setItem(VISIT_KEY, String(Date.now()));
        } catch (e) {
            // storage may be blocked — continue without return-visit bonus
        }

        this.visitorId = this.getOrCreateVisitorId();
        this.sessionId = this.createSessionId();

        this.tickHandle = setInterval(() => this.onTick(), 1000);
        window.addEventListener('scroll', this.onScroll, { passive: true });

        this.subscribeToServerNudge();
        this.logEvent(this.isReturnVisit ? 'return_visit' : 'page_view');
    }

    disconnectedCallback() {
        if (this.tickHandle) {
            clearInterval(this.tickHandle);
            this.tickHandle = undefined;
        }
        window.removeEventListener('scroll', this.onScroll);
        this.unsubscribeFromServerNudge();
    }

    onScroll = () => {
        const doc = document.documentElement;
        const scrollTop = window.pageYOffset || doc.scrollTop || 0;
        const viewport = window.innerHeight || doc.clientHeight || 0;
        const total = doc.scrollHeight || 1;
        const depth = Math.min(100, Math.round(((scrollTop + viewport) / total) * 100));
        if (depth > this.maxScrollDepth) {
            this.maxScrollDepth = depth;
        }
    };

    onTick() {
        this.timeOnPage += 1;
        if (this.nudgeFired) {
            return;
        }
        if (this.calculateScore() >= NUDGE_THRESHOLD) {
            this.fireNudge();
        }
    }

    get isModelPage() {
        try {
            const href = window.location.href.toLowerCase();
            return href.includes('vehicle-detail') || href.includes('/vehicle/');
        } catch (e) {
            return false;
        }
    }

    get currentModel() {
        try {
            const h1 = document.querySelector('h1');
            if (h1 && h1.textContent) {
                const text = h1.textContent.trim();
                if (text.toLowerCase().startsWith('electra')) {
                    return text.split('—')[0].trim();
                }
            }
        } catch (e) {
            // ignore
        }
        return '';
    }

    calculateScore() {
        let score = 0;
        if (this.isModelPage) score += 10;
        if (this.timeOnPage > 300) {
            score += 25;
        } else if (this.timeOnPage > 120) {
            score += 15;
        }
        if (this.maxScrollDepth > 80) score += 10;
        if (this.isReturnVisit) score += 15;
        return score;
    }

    fireNudge() {
        this.nudgeFired = true;
        try {
            sessionStorage.setItem(NUDGE_KEY, 'true');
        } catch (e) {
            // ignore
        }
        const model = this.currentModel;
        const message = model
            ? `I see you're interested in the ${model}! Would you like to book a test drive? I can find available slots near you in seconds.`
            : "Welcome back! Ready to book a test drive? I can help you find the perfect Electra for you.";

        openChat({
            source: 'intent-nudge',
            score: this.calculateScore(),
            model,
            greeting: message
        });

        this.logEvent('click_cta');
    }

    getOrCreateVisitorId() {
        try {
            let id = localStorage.getItem(VISITOR_KEY);
            if (!id) {
                id = 'WEB-' + Math.random().toString(36).substring(2, 10).toUpperCase() + '-' + Date.now();
                localStorage.setItem(VISITOR_KEY, id);
            }
            return id;
        } catch (e) {
            return 'WEB-NO-STORAGE-' + Date.now();
        }
    }

    createSessionId() {
        return 'SESS-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    detectDeviceType() {
        try {
            const w = window.innerWidth || 0;
            if (w < 768) return 'Mobile';
            if (w < 1024) return 'Tablet';
            return 'Desktop';
        } catch (e) {
            return 'Desktop';
        }
    }

    detectReferralSource() {
        try {
            const ref = (document.referrer || '').toLowerCase();
            if (!ref) return 'Direct';
            if (ref.includes('google')) return 'Google Organic';
            if (ref.includes('facebook') || ref.includes('instagram')) return 'Social';
            if (ref.includes('email') || ref.includes('mc.')) return 'Email';
            return 'Other';
        } catch (e) {
            return 'Direct';
        }
    }

    logEvent(eventType) {
        if (!this.visitorId) {
            return;
        }
        logEngagement({
            visitorId: this.visitorId,
            pageUrl: window.location.href,
            vehicleModel: this.currentModel || '',
            timeOnPageSeconds: this.timeOnPage,
            scrollDepthPercent: this.maxScrollDepth,
            eventType: eventType,
            deviceType: this.detectDeviceType(),
            sessionId: this.sessionId,
            referralSource: this.detectReferralSource()
        }).catch(() => {
            // swallow logging errors — must never break the page experience
        });
    }

    subscribeToServerNudge() {
        try {
            onError(() => {
                // EmpApi connection errors — silent; client-side nudge still runs as a fallback
            });
            subscribe(NUDGE_EVENT_CHANNEL, -1, (message) => this.handleServerNudge(message))
                .then((sub) => {
                    this.nudgeSubscription = sub;
                })
                .catch(() => {
                    // empApi may not be available on Experience Site guest sessions; client-side nudge still works
                });
        } catch (e) {
            // ignore — fall back to client-side nudge only
        }
    }

    unsubscribeFromServerNudge() {
        if (!this.nudgeSubscription) {
            return;
        }
        try {
            unsubscribe(this.nudgeSubscription, () => {});
        } catch (e) {
            // ignore
        }
        this.nudgeSubscription = undefined;
    }

    handleServerNudge(message) {
        try {
            const payload = (message && message.data && message.data.payload) || {};
            // Only react if this server-side nudge targets THIS visitor
            if (!payload.Visitor_Id__c || payload.Visitor_Id__c !== this.visitorId) {
                return;
            }
            if (this.nudgeFired) {
                return;
            }
            this.nudgeFired = true;
            try {
                sessionStorage.setItem(NUDGE_KEY, 'true');
            } catch (e) {
                // ignore
            }

            const model = payload.Preferred_Model__c || this.currentModel || '';
            const score = payload.Intent_Score__c || this.calculateScore();
            const reason = payload.Trigger_Reason__c || 'HighIntent';

            const greeting = (reason === 'VeryHighIntent' && model)
                ? `The ${model} is turning heads — ready to turn the wheel? I have slots available this week at your nearest dealership.`
                : (model
                    ? `I see you're interested in the ${model}! Would you like to book a test drive? I can find available slots near you in seconds.`
                    : 'Welcome! Ready to book a test drive? I can help you find the perfect Electra in seconds.');

            openChat({
                source: 'server-nudge',
                score,
                model,
                greeting,
                reason
            });
        } catch (e) {
            // never throw to UI
        }
    }
}