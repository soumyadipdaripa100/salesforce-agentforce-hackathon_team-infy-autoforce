import { LightningElement } from 'lwc';
import { loadStyle } from 'lightning/platformResourceLoader';
import { openChat } from 'c/electraChatBridge';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const STEPS = [
    {
        num: '1',
        title: 'Book',
        desc: 'Choose your model and pick a time that works for you through our AI assistant.'
    },
    {
        num: '2',
        title: 'We Deliver',
        desc: 'Our concierge team brings the vehicle to your preferred location.'
    },
    {
        num: '3',
        title: 'You Drive',
        desc: 'Take the wheel for a 30-minute test drive on your own terms.'
    }
];

const FAQS = [
    { q: 'How long is the Experience Drive?', a: 'Each Experience Drive session is 30 minutes.' },
    { q: 'Is there a cost?', a: 'Experience Drives are completely free, no obligation.' },
    { q: 'Where is it available?', a: 'Currently available in the San Francisco Bay Area — San Francisco, San Jose, Oakland, and Palo Alto.' },
    { q: 'What do I need?', a: 'Just a valid driver\'s license. Our concierge handles everything else.' },
    { q: 'Can I choose the route?', a: 'You\'re free to drive wherever you\'d like within the time window.' }
];

const COMPARISON = [
    { feature: 'Location', standard: 'At the dealership', experience: 'At your doorstep' },
    { feature: 'Duration', standard: '20 minutes', experience: '30 minutes' },
    { feature: 'Route', standard: "Dealer's test route", experience: 'Your choice' },
    { feature: 'Scheduling', standard: 'Walk-in or appointment', experience: 'Appointment only' },
    { feature: 'Availability', standard: 'Mon-Sat, 10AM-4PM', experience: 'Mon-Fri, 9AM-5PM' },
    { feature: 'Cost', standard: 'Free', experience: 'Free' },
    { feature: 'Concierge', standard: 'No', experience: 'Yes — personal concierge' }
];

export default class ElectraExperienceDrive extends LightningElement {
    steps = STEPS;
    faqs = FAQS.map((f, i) => ({ ...f, key: `faq-${i}` }));
    rows = COMPARISON.map((r, i) => ({ ...r, key: `row-${i}` }));

    connectedCallback() {
        loadStyle(this, FONTS + '/fonts.css').catch(() => {});
    }

    handleBook() {
        openChat({ source: 'experience-drive', driveType: 'Experience Drive' });
    }
}