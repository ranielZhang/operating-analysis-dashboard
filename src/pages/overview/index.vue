<template>
    <div class="ov">
        <!-- 页面标题 -->
        <header class="ov__head">
            <div>
                <h2 class="ov__title">经营总览</h2>
                <p class="ov__sub">
                    {{ periodLabel }} · 口径：{{ basisText }}利润 · 预估窗口：{{ filter.roiWindow }} 日 · 范围：{{ scopeText }}
                </p>
            </div>
            <el-button size="small" @click="docVisible = true">口径说明</el-button>
        </header>

        <div v-if="hasFilter" class="ov__scope">
            <span>已按范围过滤：{{ scopeDetail }}</span>
            <el-button link type="primary" size="small" @click="reset()">清除范围</el-button>
        </div>

        <!-- 一、经营结论 + 关键指标 + 月度趋势 -->
        <OverviewHeadline />

        <!-- 二、游戏 / 投手经营利润排名 -->
        <OverviewRanking />

        <!-- 四、更多分析：默认收起，供财务与运营做口径核对与结构下钻 -->
        <section class="ov__more">
            <el-collapse v-model="opened">
                <el-collapse-item name="more">
                    <template #title>
                        <div class="ov__more-title">
                            <span>更多分析</span>
                            <em>双口径趋势与差额归因 · 年 / 季 / 月对比 · 组织利润贡献 · 收入成本结构</em>
                        </div>
                    </template>

                    <div class="ov__more-body">
                        <ProfitBasisTrend />
                        <ProfitBridge />
                        <PeriodCompare />
                        <OrgContribution />
                        <RevenueCostStructure />
                    </div>
                </el-collapse-item>
            </el-collapse>
        </section>

        <!-- 口径说明：集中解释术语，正文里不再重复 -->
        <el-dialog v-model="docVisible" title="口径说明" width="680px" append-to-body>
            <div class="ov__doc">
                <h4>一、两个利润口径</h4>
                <table>
                    <thead>
                        <tr>
                            <th>项目</th>
                            <th>账面利润</th>
                            <th>经营利润</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td>核算基础</td>
                            <td>银行账户实时流水</td>
                            <td>权责发生制 + 预估回收曲线</td>
                        </tr>
                        <tr>
                            <td>收入确认</td>
                            <td>已到账（流量主结算 / 广告金 / 渠道分成）</td>
                            <td>应确认（本期投放按回收曲线确认的回收）</td>
                        </tr>
                        <tr>
                            <td>成本确认</td>
                            <td>已支付（投放充值、人工、管理费用）</td>
                            <td>本期投放消耗 + 人工 + 管理费用</td>
                        </tr>
                        <tr>
                            <td>预付成本处理</td>
                            <td>计入本期现金流出</td>
                            <td>形成预付款资产，按消耗进度转成本</td>
                        </tr>
                        <tr>
                            <td>特征</td>
                            <td>精确可审计，但受结算周期影响滞后 30~60 天</td>
                            <td>及时反映经营质量，含预估成分</td>
                        </tr>
                        <tr>
                            <td>适用场景</td>
                            <td>现金流管理、税务、审计</td>
                            <td>经营决策、投放节奏、绩效核算</td>
                        </tr>
                    </tbody>
                </table>

                <h4>二、口径差额</h4>
                <p>
                    口径差额 = 经营利润 − 账面利润。正数表示本期投入已确认经营成果、但现金尚未回笼，
                    主要来自两项存量：<b>应收未收</b>（已回收但平台未结算）与<b>预付余额</b>（已充值但未消耗）。
                    二者与本期差额不必然相等，因还包含跨期错配。
                </p>

                <h4>三、累计口径指标</h4>
                <ul>
                    <li><b>累计预估 ROI</b> = 自数据起点累计预估总回收 ÷ 累计投放消耗（含本金，1.0 = 回本）</li>
                    <li><b>实际 ROI</b> = 累计已回收 ÷ 累计投放消耗</li>
                    <li><b>回收完成度</b> = 累计已回收 ÷ 累计预估总回收</li>
                    <li><b>人效比</b> = 经营利润 ÷ 人工成本</li>
                </ul>
                <p class="ov__doc-note">
                    以上四项均为<b>累计口径</b>，不是本期口径：按单月筛选时，它们描述的仍是该范围内存量盘子的累计表现。
                </p>

                <h4>四、回收曲线与预估</h4>
                <p>
                    预估回收曲线为对数形式 <code>ROI(n) = curveA · ln(n) + curveB</code>，其中 n 为投放后天数，
                    ROI(n) 为累计回收倍数，参数按游戏分别标定。当月实时预估 = 已过天数实际值 + 剩余天数按近 7 日均值与季节系数外推；
                    未来月份 = 存量 cohort 回收 + 新增投放推演。详见「预估参数与口径」页。
                </p>
            </div>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { CENTERS, GAMES, PLATFORMS, PROJECTS } from '@/domain/dimensions';
    import { useAnalysisFilter } from '@/composables/useAnalysisFilter';

    /* 默认展开：经营结论、关键指标、月度趋势、排名 */
    import OverviewHeadline from './components/OverviewHeadline.vue';
    import OverviewRanking from './components/OverviewRanking.vue';

    /* 默认收起：口径核对与结构明细 */
    import ProfitBasisTrend from './components/ProfitBasisTrend.vue';
    import ProfitBridge from './components/ProfitBridge.vue';
    import PeriodCompare from './components/PeriodCompare.vue';
    import OrgContribution from './components/OrgContribution.vue';
    import RevenueCostStructure from './components/RevenueCostStructure.vue';

    /**
     * 经营总览。
     * 顺序：经营结论 → 关键指标 → 月度趋势 → 排名 → 更多分析（收起）。
     * 术语一律使用财务通用口径，含义集中在「口径说明」弹窗解释。
     */
    defineOptions({ name: 'OverviewPage' });

    const { filter, periodLabel, hasFilter, reset } = useAnalysisFilter();
    const docVisible = ref(false);
    const opened = ref<string[]>([]);

    const basisText = computed(() => (filter.basis === 'book' ? '账面' : '经营'));

    const scopeDetail = computed(() => {
        const parts: string[] = [];
        const push = (ids: string[], list: Array<{ id: string; name: string }>, label: string) => {
            if (!ids.length) return;
            const hit = list.filter((x) => ids.includes(x.id)).map((x) => x.name);
            parts.push(`${label} ${hit.length > 3 ? `${hit.slice(0, 3).join('、')} 等 ${hit.length} 项` : hit.join('、')}`);
        };
        push(filter.centerIds, CENTERS, '中心');
        push(filter.platformIds, PLATFORMS, '平台');
        push(filter.projectIds, PROJECTS, '项目');
        push(filter.gameIds, GAMES, '游戏');
        return parts.join('；') || '部分范围';
    });

    const scopeText = computed(() => (hasFilter.value ? scopeDetail.value : '全公司'));
</script>

<style scoped lang="scss">
    .ov {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: var(--oa-gap);
    }

    .ov__head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
    }

    .ov__title {
        margin: 0 0 3px;
        font-size: 17px;
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .ov__sub {
        margin: 0;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .ov__scope {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 7px 14px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        font-size: var(--oa-fs-xs);
        color: var(--oa-primary-deep);
    }

    .ov__more {
        :deep(.el-collapse) {
            border: 1px solid var(--oa-border);
            border-radius: var(--oa-radius);
            background: var(--oa-card);
            box-shadow: var(--oa-shadow);
            overflow: hidden;
        }

        :deep(.el-collapse-item__header) {
            height: auto;
            padding: 11px 16px;
            border-bottom: none;
            line-height: 1.4;
        }

        :deep(.el-collapse-item__wrap) {
            border-bottom: none;
        }
    }

    .ov__more-title {
        display: flex;
        align-items: baseline;
        gap: 10px;

        span {
            font-size: var(--oa-fs-base);
            font-weight: 600;
            color: var(--oa-text-1);
        }

        em {
            font-size: var(--oa-fs-xs);
            font-style: normal;
            color: var(--oa-text-4);
        }
    }

    .ov__more-body {
        display: flex;
        flex-direction: column;
        gap: var(--oa-gap);
        padding: 4px 16px 16px;
    }

    .ov__doc {
        font-size: var(--oa-fs-sm);
        line-height: 1.75;
        color: var(--oa-text-2);

        h4 {
            margin: 16px 0 8px;
            font-size: var(--oa-fs-base);
            font-weight: 600;
            color: var(--oa-text-1);

            &:first-child {
                margin-top: 0;
            }
        }

        p {
            margin: 0 0 8px;
        }

        ul {
            margin: 0 0 8px;
            padding-left: 20px;
        }

        li {
            margin-bottom: 4px;
        }

        code {
            padding: 1px 5px;
            border-radius: 3px;
            background: #f1f5f9;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px;
        }

        table {
            width: 100%;
            margin-bottom: 8px;
            border-collapse: collapse;
            font-size: var(--oa-fs-xs);

            th,
            td {
                padding: 7px 10px;
                border: 1px solid var(--oa-border-light);
                text-align: left;
                vertical-align: top;
            }

            th {
                background: #f7f9fe;
                font-weight: 600;
                color: var(--oa-text-2);
            }
        }
    }

    .ov__doc-note {
        color: var(--oa-text-3);
    }
</style>
