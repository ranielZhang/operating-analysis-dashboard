<template>
    <div class="ds">
        <!-- ===== 页面标题区 ===== -->
        <header class="ds__head">
            <div class="ds__head-main">
                <h2 class="ds__title">经营数据源与质量</h2>
                <p class="ds__subtitle">
                    数据源清单 · 接入状态 · 数据完整度
                    <span class="ds__sep">·</span>
                    统计基准 {{ store.currentMonth }}
                    <span class="ds__sep">·</span>
                    共 <b class="ds__strong">{{ total }}</b> 个数据源
                </p>
                <p class="ds__hint">
                    这一页回答「看板上的钱是从哪来的、可不可信」：哪些指标有<b>真实外部接口</b>，哪些只能<b>手工维护</b>，
                    哪些<b>还没有数据源</b>，以及每个数据源的<b>更新频率 / 粒度 / 完整度 / 已知问题</b>。
                    口径如实呈现、不做美化：<b>投放成本</b>是唯一有真实接口的成本项（腾讯广告返回金额单位为「分」）；
                    <b>预付成本与三项收入</b>目前只有中台手工配置字段；第三方归因 <b>AppsFlyer</b> 状态为 unconfigured（未配置），
                    会影响 ROI / 收入 / LTV 口径的完整性。本页数字不随顶部筛选栏变化。
                </p>
            </div>
            <div class="ds__head-actions">
                <el-tag size="small" effect="plain" type="info">完整度 / 最近更新 / 问题数为演示数据</el-tag>
                <el-tag size="small" effect="plain" type="warning">目标完整度 95%</el-tag>
            </div>
        </header>

        <!-- 区块 1 · 数据源健康度总览 -->
        <SourceHealthRow />

        <!-- 区块 2 · 数据源清单表（本页主体） -->
        <DataSourceTable />

        <!-- 区块 3 · 数据完整度趋势 -->
        <CompletenessTrend />

        <!-- 区块 4 · 数据流转链路图 -->
        <DataFlowGraph />

        <!-- 区块 5 · 数据质量问题与待办清单 -->
        <QualityIssues />

        <!-- 区块 6 · 数据字典速查 -->
        <DataDictionary />
    </div>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import { store } from '@/domain/store';
    import CompletenessTrend from './components/CompletenessTrend.vue';
    import DataDictionary from './components/DataDictionary.vue';
    import DataFlowGraph from './components/DataFlowGraph.vue';
    import DataSourceTable from './components/DataSourceTable.vue';
    import QualityIssues from './components/QualityIssues.vue';
    import SourceHealthRow from './components/SourceHealthRow.vue';
    import { DATA_SOURCES } from './components/meta';

    /**
     * 经营数据源与质量页（需求执行项 1：了解所有跟经营分析相关的数据源）
     *
     * 页面定位：把「数据源清单 / 接入状态 / 数据完整度 / 数据质量问题」做成可看的看板，
     * 让老板与财务一眼看清哪些数字是真实的、哪些是手工维护的、哪些还缺。
     *
     * 事实基线（不美化）：
     * - 投放成本是唯一有真实数据源的成本项（腾讯广告 daily_reports/get，cost 单位为「分」）；
     * - 预付成本 / 流量主收入 / 广告金 / 分成收入目前没有真实外部数据源，只有手工配置字段；
     * - AppsFlyer 归因状态为 unconfigured（未配置），影响 ROI / 收入 / LTV 口径完整性；
     * - 管理数据（工资 / 医社保 / 个税 / 项目奖金 / 福利费 / 办公费）按月产生，必须分摊。
     *
     * 本页组件无 props、不读全局筛选（与筛选条件无关），也不修改 filter；
     * 所有非 store 计算结果的数字（完整度、最近更新、问题数、月度趋势）均由 hash01 确定性生成并标注「演示数据」。
     */
    defineOptions({ name: 'DataSourcePage' });

    const total = computed(() => DATA_SOURCES.length);
</script>

<style scoped lang="scss">
    .ds {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    /* ---------- 标题区 ---------- */
    .ds__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--oa-gap);
        padding: 12px 14px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        min-width: 0;
    }

    .ds__head-main {
        min-width: 0;
    }

    .ds__title {
        margin: 0;
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        color: var(--oa-text-1);
        letter-spacing: 0.5px;
    }

    .ds__subtitle {
        margin: 4px 0 0;
        font-size: var(--oa-fs-sm);
        color: var(--oa-text-3);
    }

    .ds__strong {
        color: var(--oa-primary-deep);
    }

    .ds__sep {
        margin: 0 3px;
        color: var(--oa-text-4);
    }

    .ds__hint {
        margin: 6px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-4);

        b {
            color: var(--oa-text-2);
        }
    }

    .ds__head-actions {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex: 0 0 auto;
    }

    @media (max-width: 1400px) {
        .ds__head {
            flex-direction: column;
        }

        .ds__head-actions {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
        }
    }
</style>
