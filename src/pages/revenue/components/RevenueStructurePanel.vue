<template>
    <PanelCard title="收入结构" subtitle="三科目占比与金额（中心为应确认收入合计）">
        <PanelEmptyState v-if="!hasData" text="当前筛选条件下暂无收入结构数据" />

        <div v-else class="st">
            <EChart :option="option" style="height: 244px" />

            <div class="st__list">
                <div class="st__row st__row--head">
                    <span class="st__name">科目</span>
                    <span class="st__amount">金额</span>
                    <span class="st__share">占比</span>
                </div>

                <div v-for="item in items" :key="item.key" class="st__row">
                    <span class="st__name">
                        <i class="st__dot" :style="{ background: item.color }" />
                        {{ item.name }}
                    </span>
                    <span class="st__amount oa-num">{{ money(item.value) }}</span>
                    <span class="st__share">
                        <el-progress
                            class="st__bar"
                            :percentage="item.barPercent"
                            :color="item.color"
                            :stroke-width="6"
                            :show-text="false"
                        />
                        <span class="st__pct oa-num">{{ percent(item.share) }}</span>
                    </span>
                </div>

                <div class="st__row st__row--total">
                    <span class="st__name">应确认收入合计</span>
                    <span class="st__amount oa-num">{{ money(total) }}</span>
                    <span class="st__share oa-num">{{ total > 0 ? '100.0%' : '—' }}</span>
                </div>

                <p class="st__desc">
                    <b>流量主收入</b>＝小游戏内激励视频 / 插屏 / Banner 广告分成；<b>广告金</b>＝平台返还的广告金与返点；
                    <b>分成收入</b>＝IAP 内购流水经渠道分成后的净额。
                </p>
            </div>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import type { EChartsOption } from 'echarts';
    import EChart from '@/components/EChart.vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import { money, percent } from '@/utils/format';
    import {
        REVENUE_SUBJECTS,
        hasRevenue,
        revenueColor,
        safeRatio,
        subjectAmount,
        token,
        wanTooltip,
    } from './revenueTheme';

    /** 收入结构环形图 + 结构明细：回答「收入由哪几块构成」 */
    defineOptions({ name: 'RevenueStructurePanel' });

    const { filter } = useAnalysisFilter();

    const metrics = computed(() => store.metricsOf(filter, 'company', 'company'));
    const hasData = computed(() => hasRevenue(metrics.value));

    const total = computed(() => metrics.value?.accrualRevenue ?? 0);

    const items = computed(() =>
        REVENUE_SUBJECTS.map((subject) => {
            const value = subjectAmount(metrics.value?.revenueByType, subject.key);
            const share = safeRatio(value, total.value);
            return {
                key: subject.key,
                name: subject.name,
                desc: subject.desc,
                value,
                share,
                color: revenueColor(subject.key),
                /** el-progress 只接受 0~100 */
                barPercent: Math.min(100, Math.max(0, Number((share * 100).toFixed(1)))),
            };
        }),
    );

    const option = computed<EChartsOption>(() => ({
        tooltip: { trigger: 'item', valueFormatter: wanTooltip },
        title: {
            text: money(total.value),
            subtext: '应确认收入合计',
            left: 'center',
            top: '38%',
            textAlign: 'center',
            textStyle: { fontSize: 16, fontWeight: 700, color: token('--oa-text-1', '#1f2937') },
            subtextStyle: { fontSize: 11, color: token('--oa-text-4', '#9ca3af') },
        },
        series: [
            {
                name: '收入结构',
                type: 'pie',
                radius: ['58%', '80%'],
                center: ['50%', '50%'],
                avoidLabelOverlap: true,
                itemStyle: {
                    borderColor: token('--oa-card', '#ffffff'),
                    borderWidth: 2,
                },
                label: {
                    formatter: '{b}\n{d}%',
                    color: token('--oa-text-3', '#6b7280'),
                    fontSize: 11,
                    lineHeight: 15,
                },
                labelLine: { length: 8, length2: 6 },
                data: items.value.map((item) => ({
                    name: item.name,
                    value: Number((item.value / 1e4).toFixed(2)),
                    itemStyle: { color: item.color },
                })),
            },
        ],
    }));
</script>

<style scoped lang="scss">
    .st {
        display: flex;
        flex-direction: column;
        gap: 10px;
        min-width: 0;
    }

    .st__list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
    }

    .st__row {
        display: grid;
        grid-template-columns: minmax(90px, 1.1fr) minmax(70px, 1fr) minmax(96px, 1.3fr);
        align-items: center;
        gap: 8px;
        padding: 4px 0;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
    }

    .st__row--head {
        color: var(--oa-text-4);
        border-bottom: 1px solid var(--oa-border-light);
    }

    .st__row--total {
        padding-top: 8px;
        border-top: 1px solid var(--oa-border-light);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .st__name {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .st__dot {
        flex: 0 0 auto;
        width: 8px;
        height: 8px;
        border-radius: 2px;
    }

    .st__amount {
        text-align: right;
    }

    .st__share {
        display: flex;
        align-items: center;
        gap: 6px;
        min-width: 0;
    }

    .st__bar {
        flex: 1 1 auto;
        min-width: 0;
    }

    .st__pct {
        flex: 0 0 auto;
        width: 44px;
        text-align: right;
        color: var(--oa-text-2);
    }

    .st__desc {
        margin: 6px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-2);
            font-weight: 600;
        }
    }
</style>
