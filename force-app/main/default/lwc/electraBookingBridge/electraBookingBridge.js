const BOOKING_EVENT = 'electra:openbooking';
const MY_BOOKINGS_EVENT = 'electra:openmybookings';

export function openBooking(context = {}) {
    try {
        window.dispatchEvent(new CustomEvent(BOOKING_EVENT, { detail: context }));
    } catch (e) {
        // CustomEvent ctor exists in all supported browsers; nothing to fall back to
    }
}

export function openMyBookings(context = {}) {
    try {
        window.dispatchEvent(new CustomEvent(MY_BOOKINGS_EVENT, { detail: context }));
    } catch (e) {
        // no-op
    }
}

export const BOOKING_EVENT_NAME = BOOKING_EVENT;
export const MY_BOOKINGS_EVENT_NAME = MY_BOOKINGS_EVENT;