<template>
    <div class="fc">
        <!-- ===== 标题区：为什么账面利润与经营利润会差一个身位 ===== -->
        <header class="fc__head">
            <div class="fc__head-main">
                <h2 class="fc__title">月度经营预估</h2>
                <p class="fc__subtitle">
                    买量业务的成本在投放当天一次性发生，收入却在未来 90~360 天陆续回来。本页按<b>预估回收曲线</b>把未来的收入提前确认，并针对每个月给出乐观 / 中性 / 悲观三档预估。
                </p>
            </div>

            <div class="fc__head-actions">
                <el-tag class="fc__window" type="info" size="small">
                    预估窗口：{{ filter.roiWindow }} 日曲线
                </el-tag>
                <span class="fc__window-hint">
                    {{ store.currentMonth }} 预估 · 可在顶部筛选栏切换 90/180/360 日
                </span>
                <el-button size="small" plain @click="methodDialogVisible = true">预估方法说明</el-button>
            </div>
        </header>

        <!-- ===== 范围提示条：筛选生效时说明预估值只反映该范围 ===== -->
        <div v-if="hasFilter" class="fc__scope">
            <span class="fc__scope-label">当前已按范围过滤：</span>
            <span class="fc__scope-text">{{ scopeText }}</span>
            <span class="fc__scope-tail">，预估值仅反映该范围。</span>
        </div>

        <!-- ===== ① 当月实时预估：已过天数实际 + 剩余天数外推（整行） ===== -->
        <section class="fc__row">
            <CurrentMonthForecast />
        </section>

        <!-- ===== ② 未来 6 个月滚动预估 + 乐观/中性/悲观三档情景（整行） ===== -->
        <section class="fc__row">
            <RollingForecast />
        </section>

        <!-- ===== ③ Cohort 投放回收曲线：解释预估值从哪里来（整行） ===== -->
        <section class="fc__row">
            <CohortRecovery />
        </section>

        <!-- ===== 预估方法说明弹窗：口径与算法白皮书（与 store 实现保持一致） ===== -->
        <el-dialog
            v-model="methodDialogVisible"
            title="预估方法说明 · 月度经营预估怎么算出来的"
            width="720px"
            append-to-body
            class="fc__dialog"
        >
            <div class="fc__doc">
                <section class="fc__doc-item fc__doc-item--curve">
                    <h4>1. 回收曲线</h4>
                    <p>
                        <code>ROI(n) = curveA · ln(n) + curveB</code>，其中 <code>n</code> = 投放后天数，
                        <code>ROI(n)</code> = 第 n 天的<b>累计回收 ROI</b>（倍数，<b>1.0 = 回本</b>，含本金）。
                        对数函数刻画「早期回收快、后期趋缓」的买量回收规律；<code>curveA</code> / <code>curveB</code>
                        按 <b>平台 × 游戏</b> 分别标定，某游戏取不到参数时回退到平台均值。
                    </p>
                </section>

                <section class="fc__doc-item fc__doc-item--accrual">
                    <h4>2. 本期应确认收入</h4>
                    <p>
                        = 本期各投放日在其后各天的回收增量之和（<b>权责发生制</b>）
                        + 历史 cohort 在本期产生的新回收部分（老投放继续回款）。
                        即「钱是本期投的，收入按曲线摊到未来各天；老投放的回收也算本期收入」。
                    </p>
                </section>

                <section class="fc__doc-item fc__doc-item--operating">
                    <h4>3. 经营利润（权责发生制口径）</h4>
                    <p>
                        = 应确认收入 − 本期投放消耗 − 人工成本（工资 / 医社保 / 个税 / 项目奖金）− 管理费用（福利费 / 办公费）。
                    </p>
                </section>

                <section class="fc__doc-item fc__doc-item--book">
                    <h4>4. 账面利润（银行流水口径）</h4>
                    <p>
                        = 已到账收入 − 充值支出 − 人工成本 − 管理费用。
                        两者的差额就是<b>「已投入未回收」</b>，即投出去的钱还没回收完，是<b>放量期的正常特征</b>，不等于亏损。
                    </p>
                </section>

                <section class="fc__doc-item fc__doc-item--current">
                    <h4>5. 当月实时预估</h4>
                    <p>
                        当月未结束，按「<b>已过天数实际值 + 剩余天数 × 近 7 日均值 × 季节系数</b>」外推。
                        其中余额类指标（预付余额 / 应收未收）是<b>时点值</b>，不按月累加。
                    </p>
                </section>

                <section class="fc__doc-item fc__doc-item--confidence">
                    <h4>6. 置信度</h4>
                    <p>
                        随预测期拉长按 <b>6%/月</b> 递减，最低 <b>42%</b>；当月预估置信度为 <b>86%</b>。
                        越远的月份越只能看趋势、不宜当承诺值。
                    </p>
                </section>

                <section class="fc__doc-item fc__doc-item--config">
                    <h4>7. 参数可配置</h4>
                    <p>
                        曲线系数、季节系数、置信度衰减等参数见「<b>预估参数配置</b>」页；本页所有预估结果都会随之变化。
                    </p>
                </section>

                <p class="fc__doc-note">
                    本页只做预估口径的展示与解释，不改动任何筛选条件；切换顶部筛选栏的「预估窗口（90/180/360 日）」会改变应确认收入与三档预估。
                </p>
            </div>

            <template #footer>
                <el-button type="primary" @click="methodDialogVisible = false">我知道了</el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { store } from '@/domain/store';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';
    import { ORG_MAP, PLATFORM_MAP, PROJECT_MAP, GAME_MAP } from '@/domain/dimensions';

    // 兄弟组件（A11 / A12 / A13 并行开发，均无 props、自读全局筛选、自包含）
    import CurrentMonthForecast from './components/CurrentMonthForecast.vue';
    import RollingForecast from './components/RollingForecast.vue';
    import CohortRecovery from './components/CohortRecovery.vue';

    /** 月度经营预估页：只做布局组装与筛选描述，不自行取数（数据全部在子组件内） */
    defineOptions({ name: 'ForecastPage' });

    const { filter, hasFilter } = useAnalysisFilter();

    /** 预估方法说明弹窗开关 */
    const methodDialogVisible = ref(false);

    /** 当前筛选范围的可读清单（组织 / 平台 / 项目 / 游戏） */
    const scopeTags = computed<Array<{ key: string; label: string }>>(() => {
        const tags: Array<{ key: string; label: string }> = [];
        const push = (prefix: string, ids: string[], nameOf: (id: string) => string | undefined) => {
            ids.forEach((id) => tags.push({ key: `${prefix}:${id}`, label: `${prefix}·${nameOf(id) ?? id}` }));
        };

        // 组织范围（中心 / 部门 / 小组 / 投手四层合并展示）
        push('组织', [...filter.centerIds, ...filter.departmentIds, ...filter.groupIds, ...filter.pitcherIds], (id) => ORG_MAP.get(id)?.name);
        // 业务范围
        push('平台', filter.platformIds, (id) => PLATFORM_MAP.get(id)?.name);
        push('项目', filter.projectIds, (id) => PROJECT_MAP.get(id)?.name);
        push('游戏', filter.gameIds, (id) => GAME_MAP.get(id)?.name);

        return tags;
    });

    /** 范围提示条文案（项数过多时折叠，避免占满一行） */
    const scopeText = computed(() => {
        const tags = scopeTags.value;
        if (!tags.length) return '全公司';
        const head = tags
            .slice(0, 3)
            .map((t) => t.label.replace('·', ' '))
            .join('、');
        return tags.length > 3 ? `${head} 等 ${tags.length} 项` : head;
    });
</script>

<style scoped lang="scss">
    /* ---------- 页面骨架：三个子模块整行堆叠 ---------- */
    .fc {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
        min-height: 0;
    }

    .fc__row {
        min-width: 0;
        min-height: 0;
    }

    /* ---------- 标题区 ---------- */
    .fc__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: var(--oa-gap);
        padding: 10px 14px;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
    }

    .fc__head-main {
        min-width: 0;
    }

    .fc__title {
        margin: 0;
        font-size: var(--oa-fs-xl);
        font-weight: 700;
        color: var(--oa-text-1);
        letter-spacing: 0.5px;
    }

    .fc__subtitle {
        margin: 4px 0 0;
        font-size: var(--oa-fs-sm);
        color: var(--oa-text-3);
        line-height: 1.6;

        b {
            color: var(--oa-primary-deep);
            font-weight: 600;
        }
    }

    .fc__head-actions {
        display: flex;
        flex: 0 0 auto;
        align-items: center;
        gap: 8px;
    }

    .fc__window {
        cursor: default;
    }

    .fc__window-hint {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        white-space: nowrap;
    }

    /* ---------- 范围提示条 ---------- */
    .fc__scope {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        padding: 7px 12px;
        font-size: var(--oa-fs-xs);
        border: 1px solid var(--oa-border-light);
        border-left: 3px solid var(--oa-primary);
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
    }

    .fc__scope-label {
        color: var(--oa-text-4);
    }

    .fc__scope-text {
        color: var(--oa-text-1);
        font-weight: 600;
    }

    .fc__scope-tail {
        color: var(--oa-text-3);
    }

    /* ---------- 方法说明弹窗 ---------- */
    .fc__doc {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }

    .fc__doc-item {
        padding: 10px 12px;
        border-radius: var(--oa-radius-sm);
        border-left: 3px solid var(--oa-primary);
        background: var(--oa-hover);

        h4 {
            margin: 0 0 4px;
            font-size: var(--oa-fs-base);
            font-weight: 600;
            color: var(--oa-text-1);
        }

        p {
            margin: 0;
            font-size: var(--oa-fs-sm);
            line-height: 1.75;
            color: var(--oa-text-2);
        }

        b {
            color: var(--oa-text-1);
        }

        code {
            padding: 1px 5px;
            border-radius: var(--oa-radius-sm);
            background: var(--oa-card);
            border: 1px solid var(--oa-border);
            font-size: var(--oa-fs-xs);
            color: var(--oa-primary-deep);
        }
    }

    /* 逐条用语义色区分：曲线 / 应计 / 经营 / 账面 / 当月 / 置信度 / 配置 */
    .fc__doc-item--curve {
        border-left-color: var(--oa-revenue);
    }

    .fc__doc-item--accrual {
        border-left-color: var(--oa-operating);
    }

    .fc__doc-item--operating {
        border-left-color: var(--oa-operating);
    }

    .fc__doc-item--book {
        border-left-color: var(--oa-book);
    }

    .fc__doc-item--current {
        border-left-color: var(--oa-cost-prepay);
        background: var(--oa-warning-soft);
    }

    .fc__doc-item--confidence {
        border-left-color: var(--oa-warning);
    }

    .fc__doc-item--config {
        border-left-color: var(--oa-cost-admin);
    }

    .fc__doc-note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
    }

    /* ---------- 窄屏：标题区与右侧信息换行堆叠 ---------- */
    @media (max-width: 1200px) {
        .fc__head {
            flex-direction: column;
        }

        .fc__head-actions {
            flex-wrap: wrap;
        }

        .fc__window-hint {
            white-space: normal;
        }
    }
</style>
