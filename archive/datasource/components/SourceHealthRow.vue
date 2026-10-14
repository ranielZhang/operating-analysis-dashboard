<template>
    <section class="health">
        <header class="health__head">
            <div class="health__title-wrap">
                <h3 class="health__title">数据源健康度总览</h3>
                <span class="health__sub">{{ summaryText }}</span>
                <el-tag size="small" type="info" effect="plain">问题数为演示数据</el-tag>
            </div>
        </header>

        <div class="health__grid">
            <MetricCard
                label="数据源总数"
                :value="total"
                format="int"
                tone="default"
                suffix="个"
                hint="含业务 / 管理 / 财务 / 归因四类，口径见下方清单"
            />

            <MetricCard
                label="已接入数据源"
                :value="connected"
                format="int"
                tone="success"
                suffix="个"
                :hint="`含部分接入 ${partial} 个 · 手工维护 ${manual} 个不计入`"
            />

            <MetricCard
                label="数据完整度"
                :value="completeness"
                format="percent"
                tone="success"
                :hint="`已接入 ÷ 总数 = ${connected} ÷ ${total}（源级接入率，非字段级）`"
                :badge="completeness >= 0.8 ? '接入良好' : '接入不足'"
                :badge-tone="completeness >= 0.8 ? 'success' : 'warn'"
            />

            <MetricCard
                label="有真实接口的数据源"
                :value="realApi"
                format="int"
                tone="default"
                suffix="个"
                :hint="`其余 ${total - realApi} 个为手工维护 / 后台导出 / 未配置`"
            />

            <MetricCard
                label="未配置 / 待接入"
                :value="pending"
                format="int"
                tone="warn"
                suffix="个"
                :hint="`未接入 ${unavailable} 个（预付台账等） + 未配置 ${unconfigured} 个（AppsFlyer）`"
                badge="影响口径完整性"
                badge-tone="warn"
            />
        </div>

        <div class="health__strip">
            <div class="health__strip-main">
                <span class="health__strip-num oa-num">{{ issues }}</span>
                <span class="health__strip-unit">条</span>
                <span class="health__strip-label">今日需处理的数据质量问题</span>
                <el-tag size="small" type="info" effect="plain">演示数据</el-tag>
            </div>
            <div class="health__strip-meta">
                <span class="health__split">
                    <span class="health__split-lab">高优先级</span>
                    <span class="health__split-val oa-num">{{ highIssues }} 条</span>
                </span>
                <span class="health__split">
                    <span class="health__split-lab">近 3 个月低于 {{ Math.round(COMPLETENESS_TARGET * 100) }}% 目标线的源</span>
                    <span class="health__split-val oa-num">{{ belowTarget }} 个</span>
                </span>
                <span class="health__strip-hint">问题清单见本页下方「数据质量问题与待办」</span>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import MetricCard from '@/components/MetricCard.vue';
    import { COMPLETENESS_TARGET, DATA_SOURCES, QUALITY_ISSUES, belowTargetMonths, lastMonths, todayIssueCount } from './meta';
    import { store } from '@/domain/store';

    /**
     * 区块 1 · 数据源健康度总览
     * 「源数 / 接入数 / 真实接口数」是清单事实的聚合（可由 DATA_SOURCES 数出来）；
     * 「完整度」= 已接入 ÷ 总数（弹性指标，按需求定义由清单算出）；
     * 「今日待处理问题数」「低于目标线的源数」为 hash01 确定性演示值，已在标题处标注。
     */
    defineOptions({ name: 'DataSourceHealthRow' });

    const total = computed(() => DATA_SOURCES.length);

    /** 已接入 = 已接入 + 部分接入（手工维护 / 未接入 / 未配置不算接入） */
    const connected = computed(() => DATA_SOURCES.filter((s) => s.status === 'connected' || s.status === 'partial').length);
    const partial = computed(() => DATA_SOURCES.filter((s) => s.status === 'partial').length);
    const manual = computed(() => DATA_SOURCES.filter((s) => s.status === 'manual').length);
    const unavailable = computed(() => DATA_SOURCES.filter((s) => s.status === 'unavailable').length);
    const unconfigured = computed(() => DATA_SOURCES.filter((s) => s.status === 'unconfigured').length);

    const completeness = computed(() => (total.value > 0 ? connected.value / total.value : 0));
    const realApi = computed(() => DATA_SOURCES.filter((s) => s.realApi).length);
    const pending = computed(() => unavailable.value + unconfigured.value);

    /** 今日需处理的数据质量问题数（确定性演示值） */
    const issues = computed(() => todayIssueCount());
    const highIssues = computed(() => QUALITY_ISSUES.filter((i) => i.level === 'high').length);

    /** 参与完整度趋势的业务数据源中，近 3 个月低于目标线的数量 */
    const trendSources = computed(() => DATA_SOURCES.filter((s) => s.inTrend));
    const months = computed(() => lastMonths(store.months, 12));
    const belowTarget = computed(() =>
        trendSources.value.filter((s) => belowTargetMonths(s.id, months.value, 3) > 0).length,
    );

    const summaryText = computed(
        () => `共 ${total.value} 个数据源 · 目标完整度 ${Math.round(COMPLETENESS_TARGET * 100)}% · 统计基准 ${store.currentMonth}`,
    );
</script>

<style scoped lang="scss">
    .health {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        min-height: 0;
    }

    .health__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--oa-gap);
        min-width: 0;
    }

    .health__title-wrap {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
    }

    .health__title {
        position: relative;
        margin: 0;
        padding-left: 10px;
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
        white-space: nowrap;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 13px;
            border-radius: 2px;
            background: var(--oa-primary);
        }
    }

    .health__sub {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .health__grid {
        display: grid;
        grid-template-columns: repeat(5, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    .health__split {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: var(--oa-fs-xs);
        line-height: 18px;
        color: var(--oa-text-3);
    }

    .health__split-lab {
        color: var(--oa-text-4);
        white-space: nowrap;
    }

    .health__split-val {
        font-weight: 600;
        color: var(--oa-text-2);
    }

    /* 今日待处理问题条：数字本身是确定性演示值，条上已带「演示数据」标签 */
    .health__strip {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--oa-gap);
        padding: 9px 14px;
        background: var(--oa-warning-soft);
        border: 1px solid var(--oa-border);
        border-left: 3px solid var(--oa-warning);
        border-radius: var(--oa-radius);
        min-height: 0;
    }

    .health__strip-main {
        display: flex;
        align-items: baseline;
        gap: 6px;
        min-width: 0;
    }

    .health__strip-num {
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        line-height: 1.1;
        color: #c96a1c;
    }

    .health__strip-unit {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .health__strip-label {
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .health__strip-meta {
        display: flex;
        align-items: center;
        gap: var(--oa-gap);
        flex-wrap: wrap;
        justify-content: flex-end;
    }

    .health__strip-hint {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    @media (max-width: 1440px) {
        .health__grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
        }
    }

    @media (max-width: 900px) {
        .health__grid {
            grid-template-columns: minmax(0, 1fr);
        }

        .health__strip {
            flex-direction: column;
            align-items: flex-start;
        }

        .health__strip-meta {
            justify-content: flex-start;
        }
    }
</style>
