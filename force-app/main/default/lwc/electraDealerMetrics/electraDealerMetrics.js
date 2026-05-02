import { LightningElement, api, wire } from 'lwc';
import { refreshApex } from '@salesforce/apex';
import getMetrics from '@salesforce/apex/TD_DealerMetricsController.getMetrics';

export default class ElectraDealerMetrics extends LightningElement {
    @api dealerAccountId;
    @api recordId; // when placed on Account record page
    @api daysBack = 7;
    @api refreshSeconds = 60;

    wiredResult;
    metrics;
    error;
    _timer;

    get effectiveDealerId() {
        return this.dealerAccountId || this.recordId || null;
    }

    @wire(getMetrics, { dealerAccountId: '$effectiveDealerId', daysBack: '$daysBack' })
    captured(result) {
        this.wiredResult = result;
        if (result.data) {
            this.metrics = result.data;
            this.error = undefined;
        } else if (result.error) {
            this.error = this.extractError(result.error);
            this.metrics = undefined;
        }
    }

    connectedCallback() {
        const interval = Number(this.refreshSeconds) || 0;
        if (interval > 0) {
            this._timer = setInterval(() => {
                if (this.wiredResult) refreshApex(this.wiredResult);
            }, interval * 1000);
        }
    }

    disconnectedCallback() {
        if (this._timer) clearInterval(this._timer);
    }

    handleRefresh() {
        if (this.wiredResult) refreshApex(this.wiredResult);
    }

    extractError(err) {
        if (Array.isArray(err.body)) return err.body.map(e => e.message).join(', ');
        if (err.body && err.body.message) return err.body.message;
        return err.message || 'Unknown error';
    }

    get showUpRateLabel() {
        return this.metrics ? `${this.metrics.showUpRate ?? 0}%` : '--';
    }

    get conversionRateLabel() {
        return this.metrics ? `${this.metrics.conversionRate ?? 0}%` : '--';
    }

    get hotLeadsLabel() {
        if (!this.metrics) return '--';
        return `${this.metrics.interestedCount ?? 0} / ${this.metrics.opportunityCount ?? 0}`;
    }

    get todayLabel() {
        return this.metrics ? String(this.metrics.todayTotal ?? 0) : '--';
    }

    get topModelLabel() {
        return this.metrics && this.metrics.topModel ? this.metrics.topModel : 'N/A';
    }

    get upcomingLabel() {
        return this.metrics ? String(this.metrics.upcomingNext7Days ?? 0) : '--';
    }
}