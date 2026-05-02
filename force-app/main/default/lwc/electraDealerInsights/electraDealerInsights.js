import { LightningElement, api, wire, track } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import { loadStyle } from 'lightning/platformResourceLoader';
import getMyDealerContext from '@salesforce/apex/TD_DealerConsoleController.getMyDealerContext';
import getMyBookingInsights from '@salesforce/apex/TD_DealerConsoleController.getMyBookingInsights';
import FONTS from '@salesforce/resourceUrl/electraFonts';

const FUNNEL_STAGES = [
    { key: 'Scheduled',   label: 'Scheduled',   tone: 'a' },
    { key: 'Confirmed',   label: 'Confirmed',   tone: 'b' },
    { key: 'Arrived',     label: 'Arrived',     tone: 'c' },
    { key: 'In Progress', label: 'In Progress', tone: 'd' },
    { key: 'Completed',   label: 'Completed',   tone: 'e' }
];

const OUTCOME_PALETTE = [
    { match: ['Hot', 'Hot Lead', 'Very Interested'], cls: 'oc oc--hot',  label: 'Hot' },
    { match: ['Warm', 'Warm Lead', 'Interested'],    cls: 'oc oc--warm', label: 'Warm' },
    { match: ['Cold', 'Cold Lead', 'Lukewarm'],      cls: 'oc oc--cold', label: 'Cold' },
    { match: ['Lost', 'Not Interested', 'Disqualified'], cls: 'oc oc--lost', label: 'Lost' }
];

function classifyOutcome(rawLabel) {
    if (!rawLabel) return { cls: 'oc oc--other', label: rawLabel || 'Other' };
    const lower = String(rawLabel).toLowerCase();
    for (const p of OUTCOME_PALETTE) {
        if (p.match.some((m) => lower.includes(m.toLowerCase()))) {
            return { cls: p.cls, label: rawLabel };
        }
    }
    return { cls: 'oc oc--other', label: rawLabel };
}

function extractError(err) {
    if (!err) return 'Unknown error';
    if (typeof err === 'string') return err;
    if (err.body && err.body.message) return err.body.message;
    if (err.message) return err.message;
    return JSON.stringify(err);
}

export default class ElectraDealerInsights extends LightningElement {
    @api pageTitle = 'Dealer Insights';

    @track context;
    @track contextError;
    @track snapshot;
    @track snapshotError;

    contextResult;
    snapshotResult;

    _fontsLoaded = false;

    connectedCallback() {
        if (!this._fontsLoaded) {
            loadStyle(this, FONTS + '/fonts.css').catch(() => {});
            this._fontsLoaded = true;
        }
    }

    @wire(getMyDealerContext)
    wiredContext(result) {
        this.contextResult = result;
        if (result.data) {
            this.context = result.data;
            this.contextError = undefined;
        } else if (result.error) {
            this.context = undefined;
            this.contextError = extractError(result.error);
        }
    }

    @wire(getMyBookingInsights)
    wiredSnapshot(result) {
        this.snapshotResult = result;
        if (result.data) {
            this.snapshot = result.data;
            this.snapshotError = undefined;
        } else if (result.error) {
            this.snapshotError = extractError(result.error);
        }
    }

    get hasContext() { return !!(this.context && this.context.dealerAccountId); }
    get noDealerLink() { return !!this.contextError; }
    get dealerName() { return this.context ? this.context.dealerName : 'Electra Dealer'; }
    get dealerCity() { return this.context && this.context.dealerCity ? this.context.dealerCity : ''; }
    get hasSnapshot() { return !!this.snapshot; }
    get isLoading() { return !this.snapshot && !this.snapshotError; }

    // ------- KPI cards -------

    get kpis() {
        const s = this.snapshot || {};
        return [
            { key: 'total',  label: 'Total bookings',  value: s.totalBookings ?? 0, hint: 'last 60 days' },
            { key: 'conv',   label: 'Conversion',      value: (s.conversionPct ?? 0) + '%', hint: 'completed / closed' },
            { key: 'today',  label: 'Today',           value: s.todayCount ?? 0,    hint: 'happening today' },
            { key: 'week',   label: 'This week',       value: s.thisWeekCount ?? 0, hint: 'so far this week' }
        ];
    }

    // ------- Funnel -------

    get funnelRows() {
        const s = this.snapshot;
        if (!s || !s.statusCounts) return [];
        const top = s.statusCounts['Scheduled'] || 0;
        // Use Scheduled count as the 100% baseline. If it's zero, fall back to max of any stage.
        let baseline = top;
        if (!baseline) {
            for (const stage of FUNNEL_STAGES) {
                const c = s.statusCounts[stage.key] || 0;
                if (c > baseline) baseline = c;
            }
        }
        if (!baseline) baseline = 1;
        let prev = top || 0;
        return FUNNEL_STAGES.map((stage, idx) => {
            const count = s.statusCounts[stage.key] || 0;
            const pct = Math.round((count / baseline) * 100);
            // drop-off vs previous stage (only meaningful when prev > 0 and count <= prev)
            let dropOffPct = 0;
            if (idx > 0 && prev > 0 && count < prev) {
                dropOffPct = Math.round(((prev - count) / prev) * 100);
            }
            prev = count;
            return {
                key: stage.key,
                label: stage.label,
                count,
                pct,
                tone: stage.tone,
                barClass: 'fbar fbar--' + stage.tone,
                barStyle: `width: ${Math.max(pct, 6)}%;`,
                showDrop: dropOffPct > 0,
                dropOffPct
            };
        });
    }

    get lostStrip() {
        const s = this.snapshot;
        if (!s || !s.statusCounts) return null;
        const cancelled = s.statusCounts['Cancelled'] || 0;
        const noShow = s.statusCounts['No-Show'] || 0;
        if (cancelled === 0 && noShow === 0) return null;
        return { cancelled, noShow, total: cancelled + noShow };
    }

    // ------- Top vehicles -------

    get vehicleRows() {
        const s = this.snapshot;
        if (!s || !s.topVehicles || !s.topVehicles.length) return [];
        const max = Math.max(...s.topVehicles.map((v) => v.count));
        return s.topVehicles.map((v, i) => ({
            key: `${i}-${v.label}`,
            label: v.label,
            count: v.count,
            rank: String(i + 1).padStart(2, '0'),
            barStyle: `width: ${Math.max(Math.round((v.count / max) * 100), 8)}%;`
        }));
    }

    get hasVehicles() { return this.vehicleRows.length > 0; }

    // ------- Outcome mix (stacked bar + legend) -------

    get outcomeSegments() {
        const s = this.snapshot;
        if (!s || !s.outcomeCounts) return [];
        const entries = Object.entries(s.outcomeCounts);
        const total = entries.reduce((a, [, n]) => a + n, 0);
        if (total === 0) return [];
        return entries.map(([rawLabel, count], i) => {
            const cls = classifyOutcome(rawLabel);
            const pct = Math.round((count / total) * 100);
            return {
                key: `${i}-${rawLabel}`,
                label: cls.label,
                cls: cls.cls,
                count,
                pct,
                style: `width: ${pct}%;`
            };
        });
    }

    get hasOutcomes() { return this.outcomeSegments.length > 0; }
    get totalOutcomeCount() {
        return this.outcomeSegments.reduce((a, b) => a + b.count, 0);
    }

    get outcomePending() {
        const s = this.snapshot;
        if (!s) return 0;
        const totalOutcomes = this.totalOutcomeCount;
        return Math.max((s.totalBookings || 0) - totalOutcomes, 0);
    }

    // ------- Refresh -------

    handleRefresh() {
        if (this.contextResult) refreshApex(this.contextResult);
        if (this.snapshotResult) refreshApex(this.snapshotResult);
    }
}