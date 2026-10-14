<template>
    <PanelCard title="口径对照表" subtitle="回答一个问题：账面利润和经营利润到底差在哪">
        <template #actions>
            <span class="bct__legend">
                <span class="bct__legend-dot bct__legend-dot--book" />账面（银行流水口径）
                <span class="bct__legend-dot bct__legend-dot--op" />经营（权责发生制 + 预估）
            </span>
        </template>

        <div class="bct__table">
            <div class="bct__row bct__row--head">
                <div class="bct__cell bct__cell--item">项目</div>
                <div class="bct__cell bct__cell--book">账面利润（银行流水口径）</div>
                <div class="bct__cell bct__cell--op">经营利润（权责发生制 + 预估）</div>
            </div>

            <div v-for="row in ROWS" :key="row.item" class="bct__row">
                <div class="bct__cell bct__cell--item">{{ row.item }}</div>
                <div class="bct__cell bct__cell--book" :class="`bct__cell--${row.tone}`">{{ row.book }}</div>
                <div class="bct__cell bct__cell--op" :class="`bct__cell--${row.tone}`">{{ row.operating }}</div>
            </div>
        </div>

        <p class="bct__foot">
            <b>一句话总结：</b>账面利润回答「钱在账户里发生了什么」，精确可审计、但滞后（平台结算周期 30~60 天）；
            经营利润回答「这段时间的投放到底赚不赚钱」，及时、但含预估成分。
            两者之间的差额（口径差额 = 经营利润 − 账面利润）主要是<b>已投放未回收的应收未收</b>与<b>已充值未消耗的预付款</b>，
            放量投入期为正数、属正常现象，不等于亏损。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import PanelCard from '@/components/PanelCard.vue';

    /**
     * 区块 6 · 口径对照表（账面利润 vs 经营利润）
     * 纯静态对照文案，不取数、无 props。用两列对照卡片而非表格，以容纳长文案并保留配色语义。
     */
    defineOptions({ name: 'SettingsBasisCompareTable' });

    interface CompareRow {
        item: string;
        book: string;
        operating: string;
        /** 该行的强调语义（决定左侧色条） */
        tone: 'default' | 'cash' | 'accrual' | 'prepay' | 'feature' | 'usage';
    }

    const ROWS: CompareRow[] = [
        {
            item: '收入确认',
            book: '已到账：流量主结算 / 广告金 / 渠道分成到账',
            operating: '应确认：本期投放按回收曲线确认的回收（含历史 cohort 在本期的新回收）',
            tone: 'accrual',
        },
        {
            item: '成本确认',
            book: '已支付：投放充值、人工、管理费用',
            operating: '本期投放消耗 + 人工 + 管理费用',
            tone: 'accrual',
        },
        {
            item: '预付处理',
            book: '计入本期现金流出（充多少算多少）',
            operating: '形成预付款资产，按消耗进度转成本',
            tone: 'prepay',
        },
        {
            item: '特征',
            book: '精确可审计，但滞后（结算周期 30~60 天）',
            operating: '及时反映经营质量，含预估成分（随曲线参数与预估窗口变化）',
            tone: 'feature',
        },
        {
            item: '适用',
            book: '现金流管理、税务、审计',
            operating: '经营决策、投放节奏、绩效核算',
            tone: 'usage',
        },
    ];
</script>

<style scoped lang="scss">
    .bct__legend {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .bct__legend-dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-left: 8px;
        border-radius: 50%;
    }

    .bct__legend-dot--book {
        background: var(--oa-book);
    }

    .bct__legend-dot--op {
        background: var(--oa-operating);
    }

    .bct__table {
        display: flex;
        flex-direction: column;
        min-width: 0;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius);
        overflow: hidden;
    }

    .bct__row {
        display: grid;
        grid-template-columns: 110px minmax(0, 1fr) minmax(0, 1fr);
        min-width: 0;

        & + .bct__row {
            border-top: 1px solid var(--oa-border-light);
        }

        &:nth-child(even) {
            background: var(--oa-hover);
        }
    }

    .bct__row--head {
        background: #f7f9fe;
        font-weight: 600;
    }

    .bct__cell {
        padding: 10px 12px;
        font-size: var(--oa-fs-sm);
        line-height: 1.7;
        color: var(--oa-text-2);
        min-width: 0;
        word-break: break-word;
    }

    .bct__cell--item {
        font-weight: 600;
        color: var(--oa-text-1);
        background: var(--oa-card);
    }

    .bct__cell--book {
        border-left: 3px solid var(--oa-book);
    }

    .bct__cell--op {
        border-left: 3px solid var(--oa-operating);
    }

    /* 头部两列的色条与语义色 */
    .bct__row--head .bct__cell--book {
        color: var(--oa-book);
    }

    .bct__row--head .bct__cell--op {
        color: var(--oa-operating);
    }

    .bct__cell--prepay {
        color: var(--oa-cost-prepay);
    }

    .bct__cell--feature {
        color: var(--oa-text-2);
    }

    .bct__cell--usage {
        color: var(--oa-text-1);
    }

    .bct__foot {
        margin: 12px 0 0;
        padding: 9px 11px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        font-size: var(--oa-fs-xs);
        line-height: 1.85;
        color: var(--oa-text-2);

        b {
            color: var(--oa-primary-deep);
        }
    }

    @media (max-width: 1400px) {
        .bct__row {
            grid-template-columns: 92px minmax(0, 1fr) minmax(0, 1fr);
        }

        .bct__cell {
            padding: 8px 9px;
            font-size: var(--oa-fs-xs);
        }
    }
</style>
