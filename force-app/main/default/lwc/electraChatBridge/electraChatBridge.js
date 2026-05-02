const CHAT_EVENT = 'electra:openchat';

const BUTTON_SELECTORS = [
    'button.embeddedMessagingConversationButton',
    'button[class*="embeddedMessagingConversationButton"]',
    'button[class*="EmbeddedServiceConversationButton"]',
    'button[aria-label*="Chat"]',
    'button[aria-label*="messaging" i]',
    'button[aria-label*="Open Conversation"]',
    'button.uiButton[class*="helpButton"]'
];

function tryClickLauncherButton() {
    for (const sel of BUTTON_SELECTORS) {
        try {
            const btn = document.querySelector(sel);
            if (btn) {
                btn.click();
                return true;
            }
        } catch (e) {
            // try next selector
        }
    }
    return false;
}

function setHiddenPrechatIfPossible(context) {
    try {
        if (window.embeddedservice_bootstrap?.prechatAPI && context && context.model) {
            window.embeddedservice_bootstrap.prechatAPI.setHiddenPrechatFields({
                Model_Interested: context.model
            });
        }
    } catch (e) {
        // ignore
    }
}

export function openChat(context = {}) {
    try {
        window.dispatchEvent(new CustomEvent(CHAT_EVENT, { detail: context }));
    } catch (e) {
        // no-op — CustomEvent ctor is available on all supported browsers
    }

    setHiddenPrechatIfPossible(context);

    // Strategy 1: utilAPI.launchChat (works on standard MIAW deployments)
    if (typeof window !== 'undefined' && window.embeddedservice_bootstrap?.utilAPI?.launchChat) {
        try {
            const result = window.embeddedservice_bootstrap.utilAPI.launchChat();
            // launchChat returns a Promise — catch async failures and fall through
            if (result && typeof result.catch === 'function') {
                result.catch(() => {
                    // launchChat rejected — try clicking the launcher button directly
                    tryClickLauncherButton();
                });
            }
            return;
        } catch (e) {
            // synchronous failure — fall through to DOM-click strategy
        }
    }

    // Strategy 2: simulate click on the actual launcher button in the DOM
    if (tryClickLauncherButton()) {
        return;
    }

    // Strategy 3: legacy embedded_svc event (very old deployments)
    try {
        document.dispatchEvent(new CustomEvent('embedded_svc:open', { detail: context }));
    } catch (e) {
        // no-op
    }
}

export const CHAT_EVENT_NAME = CHAT_EVENT;