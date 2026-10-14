<template>
    <PanelCard title="成本分摊规则表" subtitle="哪些成本直接归集、哪些要向下分摊，以及分摊基数怎么选">
        <template #actions>
            <span class="cas__lab">间接费用分摊基数</span>
            <el-radio-group v-model="basisMode" size="small">
                <el-radio-button value="spend">按投放消耗占比</el-radio-button>
                <el-radio-button value="head">按人头占比</el-radio-button>
            </el-radio-group>
        </template>

        <!-- ===== 规则表（静态配置说明） ===== -->
        <el-table class="cas__rule" :data="RULE_ROWS" size="small" show-overflow-tooltip>
            <el-table-column prop="item" label="成本项" min-width="180">
                <template #default="{ row }">
                    <span class="cas__item">{{ row.item }}</span>
                </template>
            </el-table-column>
            <el-table-column prop="collect" label="归集方式" min-width="210" />
            <el-table-column prop="base" label="默认分摊基数" min-width="200">
                <template #default="{ row }">
                    <span :class="row.base === '—' ? 'oa-muted' : ''">{{ row.base }}</span>
                </template>
            </el-table-column>
            <el-table-column prop="note" label="说明" min-width="300" />
        </el-table>

        <!-- ===== 分摊基数对比演示 ===== -->
        <div class="cas__demo">
            <header class="cas__demo-head">
                <h4 class="cas__demo-title">分摊基数对比演示</h4>
                <span class="cas__demo-sub">
                    固定间接费用池 <b class="oa-num">100.0 万</b>（本页示例值，非真实业务数据）；当前选择：<b>{{ basisModeText }}</b>
                </span>
            </header>

            <PanelEmptyState v-if="!rows.length" text="当前筛选条件下暂无投放数据，无法演示分摊" />

            <el-table v-else :data="rows" size="small" show-overflow-tooltip>
                <el-table-column prop="name" label="游戏" min-width="140" fixed />
                <el-table-column label="投放消耗" width="118" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ money(row.spend) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="消耗占比" width="96" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ percent(row.spendShare) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="人头（折算）" width="112" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.heads.toFixed(1) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="人头占比" width="96" align="right">
                    <template #default="{ row }">
                        <span class="oa-num">{{ percent(row.headShare) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="按消耗占比分摊" width="140" align="right">
                    <template #default="{ row }">
                        <span class="oa-num" :class="{ 'cas__cell--active': basisMode === 'spend' }">{{ money(row.allocSpend) }}</span>
                    </template>
                </el-table-column>
                <el-table-column label="按人头占比分摊" width="140" align="right">
                    <template #default="{ row }">
                        <span class="oa-num" :class="{ 'cas__cell--active': basisMode === 'head' }">{{ money(row.allocHead) }}</span>
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <p class="cas__foot">
            <b>演示口径：</b>这是本页的<b>示例计算</b>，用当前筛选范围内的游戏投放消耗与公司人数演示两种分摊基数的差别——
            消耗占比法让「投得多的游戏」多担间接费用，人头占比法让「人多的盘面」多担，两者对单个游戏的影响可以相差数倍。
            <br />
            <b>「人头（折算）」为折算值</b>：业务轴（游戏）本身没有独立人头，这里按该游戏消耗占比把公司总人数折算过去，仅用于演示分摊逻辑。
            <br />
            <b>真实系统需在后端配置并生效</b>：分摊基数、分摊层级、间接费用池的口径都应由财务在后台配置，本页只做参数透明化展示，
            不写回数据引擎（切换本页选项<b>只影响本页示例计算</b>，不改变全站指标）。
            当前数据引擎对业务轴（游戏 / 项目 / 平台）的默认处理正是「成本池按投放消耗占比分摊」，与本页左侧一列一致。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import PanelEmptyState from '@/components/PanelEmptyState.vue';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { store } from '@/domain/store';
    import { money, percent } from '@/utils/format';

    /**
     * 区块 5 · 成本分摊规则表（静态说明 + 分摊基数对比演示）
     * 演示用的固定间接费用池 100 万是「示例值」，界面上已明确标注；切换基数只影响本页示例计算。
     */
    defineOptions({ name: 'SettingsCostAllocationSection' });

    /** 固定间接费用池（本页示例值） */
    const DEMO_POOL = 1_000_000;

    const RULE_ROWS = [
        {
            item: '投放成本',
            collect: '直接归集到 投手 / 小组 / 平台 / 游戏',
            base: '—',
            note: '媒体后台实际消耗，四轴都能直接落到具体组合（投手 × 平台 × 游戏），不需要分摊。经营利润口径下即为本期业务成本。',
        },
        {
            item: '预付成本',
            collect: '直接归集，按消耗进度转成本',
            base: '—',
            note: '充值进平台账户时是资产（预付款），随实际消耗逐日转成本；账面利润口径下按充值额一次性计入本期现金流出，这是两个口径最大的差别来源。',
        },
        {
            item: '项目奖金',
            collect: '直接归集到项目 / 游戏',
            base: '—',
            note: '按项目业绩发放，可全额落到项目与游戏，属于人工成本的一部分，不需要向下分摊。',
        },
        {
            item: '工资 / 医社保 / 个税',
            collect: '按人归集到部门 / 小组',
            base: '直接归集（有人员归属表）',
            note: '有明确人员归属，人工成本按组织树（部门 / 小组 / 投手）直接归集；汇聚到中心与公司时逐层向上汇总，不做二次分摊。',
        },
        {
            item: '福利费 / 办公费',
            collect: '间接费用，向下分摊',
            base: '默认按投放消耗占比（可切「按人头占比」）',
            note: '属于典型间接费用，需要选择分摊基数向下分摊到业务 / 组织；基数选择会直接改变单个游戏、单个小组的利润归属，需财务确认口径。',
        },
    ];

    const { filter } = useAnalysisFilter();
    const basisMode = ref<'spend' | 'head'>('spend');
    const basisModeText = computed(() => (basisMode.value === 'spend' ? '按投放消耗占比' : '按人头占比'));

    /** 当前筛选范围的公司合计人头（用于折算） */
    const companyHeadcount = computed(() => store.metricsOf(filter, 'company', 'company')?.headcount ?? 0);

    interface AllocRow {
        key: string;
        name: string;
        spend: number;
        spendShare: number;
        heads: number;
        headShare: number;
        allocSpend: number;
        allocHead: number;
    }

    const rows = computed<AllocRow[]>(() => {
        const list = store
            .queryRows(filter, 'game')
            .filter((r) => r.spend > 0)
            .sort((a, b) => b.spend - a.spend)
            .slice(0, 8);
        const totalSpend = list.reduce((s, r) => s + r.spend, 0);
        if (totalSpend <= 0) return [];
        const raw = list.map((r) => {
            const spendShare = r.spend / totalSpend;
            const heads = companyHeadcount.value * spendShare;
            return { key: r.key, name: r.name, spend: r.spend, spendShare, heads };
        });
        const totalHeads = raw.reduce((s, r) => s + r.heads, 0) || 1;
        return raw.map((r) => {
            const headShare = r.heads / totalHeads;
            return {
                ...r,
                headShare,
                allocSpend: DEMO_POOL * r.spendShare,
                allocHead: DEMO_POOL * headShare,
            };
        });
    });
</script>

<style scoped lang="scss">
    .cas__lab {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .cas__rule {
        min-width: 0;
    }

    .cas__item {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .cas__demo {
        margin-top: 14px;
        padding-top: 12px;
        border-top: 1px dashed var(--oa-border-light);
        min-width: 0;
    }

    .cas__demo-head {
        display: flex;
        flex-wrap: wrap;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
    }

    .cas__demo-title {
        margin: 0;
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .cas__demo-sub {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-1);
        }
    }

    .cas__cell--active {
        color: var(--oa-primary-deep);
        font-weight: 600;
    }

    .cas__foot {
        margin: 12px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.85;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-2);
        }
    }
</style>
