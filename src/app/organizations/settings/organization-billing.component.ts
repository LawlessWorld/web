import {
    Component,
    OnInit,
} from '@angular/core';
import {
    ActivatedRoute,
    Router
} from '@angular/router';

import { ToasterService } from 'angular2-toaster';
import { Angulartics2 } from 'angulartics2';


import { BillingChargeResponse } from 'jslib/models/response/billingResponse';
import { OrganizationBillingResponse } from 'jslib/models/response/organizationBillingResponse';

import { ApiService } from 'jslib/abstractions/api.service';
import { I18nService } from 'jslib/abstractions/i18n.service';
import { PlatformUtilsService } from 'jslib/abstractions/platformUtils.service';
import { TokenService } from 'jslib/abstractions/token.service';

import { PaymentMethodType } from 'jslib/enums/paymentMethodType';
import { PlanType } from 'jslib/enums/planType';

@Component({
    selector: 'app-org-billing',
    templateUrl: 'organization-billing.component.html',
})
export class OrganizationBillingComponent implements OnInit {
    loading = false;
    firstLoaded = false;
    organizationId: string;
    adjustStorageAdd = true;
    showAdjustStorage = false;
    showAdjustPayment = false;
    showUpdateLicense = false;
    billing: OrganizationBillingResponse;
    paymentMethodType = PaymentMethodType;
    selfHosted = false;

    cancelPromise: Promise<any>;
    reinstatePromise: Promise<any>;

    constructor(private tokenService: TokenService, private apiService: ApiService,
        private platformUtilsService: PlatformUtilsService, private i18nService: I18nService,
        private analytics: Angulartics2, private toasterService: ToasterService,
        private router: Router, private route: ActivatedRoute) {
        this.selfHosted = platformUtilsService.isSelfHost();
    }

    async ngOnInit() {
        this.route.parent.parent.params.subscribe(async (params) => {
            this.organizationId = params.organizationId;
            await this.load();
            this.firstLoaded = true;
        });
    }

    async load() {
        if (this.loading) {
            return;
        }
        this.loading = true;
        this.billing = await this.apiService.getOrganizationBilling(this.organizationId);
        this.loading = false;
    }

    async reinstate() {
        if (this.loading) {
            return;
        }

        const confirmed = await this.platformUtilsService.showDialog(this.i18nService.t('reinstateConfirmation'),
            this.i18nService.t('reinstateSubscription'), this.i18nService.t('yes'), this.i18nService.t('cancel'));
        if (!confirmed) {
            return;
        }

        try {
            this.reinstatePromise = this.apiService.postOrganizationReinstate(this.organizationId);
            await this.reinstatePromise;
            this.analytics.eventTrack.next({ action: 'Reinstated Plan' });
            this.toasterService.popAsync('success', null, this.i18nService.t('reinstated'));
            this.load();
        } catch { }
    }

    async cancel() {
        if (this.loading) {
            return;
        }

        const confirmed = await this.platformUtilsService.showDialog(this.i18nService.t('cancelConfirmation'),
            this.i18nService.t('cancelSubscription'), this.i18nService.t('yes'), this.i18nService.t('no'), 'warning');
        if (!confirmed) {
            return;
        }

        try {
            this.cancelPromise = this.apiService.postOrganizationCancel(this.organizationId);
            await this.cancelPromise;
            this.analytics.eventTrack.next({ action: 'Canceled Plan' });
            this.toasterService.popAsync('success', null, this.i18nService.t('canceledSubscription'));
            this.load();
        } catch { }
    }

    async changePlan() {
        const contactSupport = await this.platformUtilsService.showDialog(this.i18nService.t('changeBillingPlanDesc'),
            this.i18nService.t('changeBillingPlan'), this.i18nService.t('contactSupport'), this.i18nService.t('close'));
        if (contactSupport) {
            this.platformUtilsService.launchUri('https://bitwarden.com/contact');
        }
    }

    downloadLicense() {
        if (this.loading) {
            return;
        }
    }

    updateLicense() {
        if (this.loading) {
            return;
        }
        this.showUpdateLicense = true;
    }

    closeUpdateLicense(load: boolean) {
        this.showUpdateLicense = false;
        if (load) {
            this.load();
        }
    }

    adjustStorage(add: boolean) {
        this.adjustStorageAdd = add;
        this.showAdjustStorage = true;
    }

    closeStorage(load: boolean) {
        this.showAdjustStorage = false;
        if (load) {
            this.load();
        }
    }

    changePayment() {
        this.showAdjustPayment = true;
    }

    closePayment(load: boolean) {
        this.showAdjustPayment = false;
        if (load) {
            this.load();
        }
    }

    async viewInvoice(charge: BillingChargeResponse) {
        const token = await this.tokenService.getToken();
        const url = this.apiService.apiBaseUrl + '/organizations/' + this.organizationId +
            '/billing-invoice/' + charge.invoiceId + '?access_token=' + token;
        this.platformUtilsService.launchUri(url);
    }

    get subscriptionMarkedForCancel() {
        return this.subscription != null && !this.subscription.cancelled && this.subscription.cancelAtEndDate;
    }

    get subscription() {
        return this.billing != null ? this.billing.subscription : null;
    }

    get nextInvoice() {
        return this.billing != null ? this.billing.upcomingInvoice : null;
    }

    get paymentSource() {
        return this.billing != null ? this.billing.paymentSource : null;
    }

    get charges() {
        return this.billing != null ? this.billing.charges : null;
    }

    get storagePercentage() {
        return this.billing != null && this.billing.maxStorageGb ?
            +(100 * (this.billing.storageGb / this.billing.maxStorageGb)).toFixed(2) : 0;
    }

    get storageProgressWidth() {
        return this.storagePercentage < 5 ? 5 : 0;
    }

    get billingInterval() {
        const monthly = this.billing.planType === PlanType.EnterpriseMonthly ||
            this.billing.planType === PlanType.TeamsMonthly;
        return monthly ? 'month' : 'year';
    }

    get storageGbPrice() {
        return this.billingInterval === 'month' ? 0.5 : 4;
    }

    get seatPrice() {
        return 4;
    }
}