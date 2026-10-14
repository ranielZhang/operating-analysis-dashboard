<template>
    <PanelCard title="预估窗口与场景系数" subtitle="同一个游戏、同一个消耗，只看不同的回收窗口，应收未收就差出一个量级">
        <template #actions>
            <el-radio-group v-model="roiWindow" size="small">
                <el-radio-button v-for="w in ROI_WINDOW_OPTIONS" :key="w.value" :value="w.value">
                    {{ w.label }}
                </el-radio-button>
            </el-radio-group>
        </template>

        <p class="fws__warn">
            <b>该设置会立即影响全站所有页面</b>：经营总览、月度经营预估、下钻、收入 / 成本 / 投手页的预估 ROI、应收未收、累计预估总回收，
            以及由它们派生的经营利润与口径差额，都会按所选窗口重算。切换后请回到相关页面复核结论。
        </p>

        <div class="fws__grid">
            <article
                v-for="w in WINDOWS"
                :key="w"
                class="fws__card"
                :class="{ 'fws__card--active': filter.roiWindow === w }"
                @click="roiWindow = w"
            >
                <header class="fws__card-head">
                    <span class="fws__card-title">{{ w }} 日窗口</span>
                    <el-tag v-if="filter.roiWindow === w" size="small" type="success" effect="light">当前生效</el-tag>
                    <el-tag v-else size="small" type="info" effect="plain">点击本卡切换</el-tag>
                </header>

                <div class="fws__metric">
                    <span class="fws__metric-label">累计预估 ROI</span>
                    <span class="fws__metric-value oa-num" :class="roiClass(roiOf(w))">{{ ratio(roiOf(w)) }} 倍</span>
                </div>

                <div class="fws__metric">
                    <span class="fws__metric-label">预估总回收</span>
                    <span class="fws__metric-value oa-num">{{ money(recoveryOf(w)) }}</span>
                </div>

                <div class="fws__metric">
                    <span class="fws__metric-label">预估应收未收</span>
                    <span class="fws__metric-value oa-num" :class="receivableOf(w) < 0 ? 'oa-down' : ''">{{
                        money(receivableOf(w))
                    }}</span>
                </div>

                <p class="fws__card-note">{{ w }} 日口径 = 只确认投放后 {{ w }} 天内按曲线回收的部分，之后不再计入。</p>
            </article>
        </div>

        <p class="fws__foot">
            <b>示例对象：</b>{{ repName }}（当前筛选范围内投放消耗 {{ money(repSpend) }}，曲线 curveA={{ repCurveA }} / curveB={{ repCurveB }}，
            该游戏累计实际 ROI {{ ratio(actualRoi) }} 倍）。
            计算方式：预估总回收 = 该游戏筛选期内投放消耗 × <code>roiAt(N, curveA, curveB)</code>；
            <b>应收未收 = 预估总回收 − 已实际回收</b>（已实际回收按该游戏在筛选期内的投放消耗 × 累计实际 ROI 计算，与全站口径一致，因此三张卡的已回收额相同，差异全部体现在应确认的回收规模上）。
            窗口越长，确认的回收越多、应收未收越大——这就是「预估窗口本质上是一个保守 / 激进的开关」。
            该游戏的目标回本周期为 <b>{{ rep.paybackDays }} 天</b>：看 90 日窗口时它还谈不上「回本完成」，看 360 日窗口时才把长尾价值算进来。
            <b>若出现负数</b>，说明该窗口曲线给出的累计 ROI 已低于实际已回收水平——这类游戏 90 日窗口会「低估」存量用户价值，
            需要拉长窗口才看得准，选窗口时务必留意。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { useAnalysisFilter, ROI_WINDOW_OPTIONS } from '@/composables/useAnalysisFilter';
    import { GAMES } from '@/domain/dimensions';
    import { roiAt, store } from '@/domain/store';
    import { money, ratio } from '@/utils/format';

    /**
     * 区块 4 · 预估窗口与场景系数
     * 直接读写全局 filter.roiWindow（影响全站预估），并用代表游戏对比 90/180/360 的 ROI 与应收未收规模。
     */
    defineOptions({ name: 'SettingsForecastWindowSection' });

    type Window = 90 | 180 | 360;
    const WINDOWS: Window[] = [90, 180, 360];

    const { filter } = useAnalysisFilter();

    /** 直接双向绑定全局筛选条件：改这里 = 改全站的预估窗口 */
    const roiWindow = computed<Window>({
        get: () => filter.roiWindow,
        set: (v: Window) => {
            filter.roiWindow = v;
        },
    });

    /** 代表游戏：用第一个游戏做示例（真实系统按所选游戏对比） */
    const rep = GAMES[0];
    const repName = rep.name;    const repCurveA = rep.curveA;
    const repCurveB = rep.curveB;

    /** 该游戏在当前筛选范围 / 期间内的指标（投放消耗、已实际回收） */
    const repMetrics = computed(() => store.metricsOf(filter, 'game', rep.id));

    const repSpend = computed(() => repMetrics.value?.spend ?? 0);

    /** 该游戏在当前筛选范围内的累计实际 ROI（倍） */
    const actualRoi = computed(() => repMetrics.value?.actualRoi ?? 0);

    /** 已实际回收 = 本期投放消耗 × 累计实际 ROI */
    const recovered = computed(() => {
        const m = repMetrics.value;
        return m ? m.actualRoi * m.spend : 0;
    });

    function roiOf(w: Window): number {
        return roiAt(w, repCurveA, repCurveB);
    }

    function recoveryOf(w: Window): number {
        return repSpend.value * roiOf(w);
    }

    /** 预估应收未收 = 该窗口下预估总回收 − 已实际回收；为负说明该窗口的曲线值低于已回收值（窗口偏短） */
    function receivableOf(w: Window): number {
        return recoveryOf(w) - recovered.value;
    }

    function roiClass(v: number): string {
        return v < 1 ? 'oa-down' : 'oa-up';
    }
</script>

<style scoped lang="scss">
    .fws__warn {
        margin: 0 0 12px;
        padding: 8px 11px;
        border-radius: var(--oa-radius-sm);
        border-left: 3px solid var(--oa-warning);
        background: var(--oa-warning-soft);
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-2);

        b {
            color: var(--oa-warning);
        }
    }

    .fws__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    .fws__card {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        padding: 12px 14px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius);
        background: var(--oa-hover);
        cursor: pointer;
        transition:
            border-color 0.15s ease,
            background 0.15s ease;

        &:hover {
            border-color: var(--oa-primary);
        }
    }

    .fws__card--active {
        border-color: var(--oa-operating);
        background: var(--oa-success-soft);
    }

    .fws__card-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .fws__card-title {
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .fws__metric {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
    }

    .fws__metric-label {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .fws__metric-value {
        font-size: var(--oa-fs-lg);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .fws__card-note {
        margin: 2px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-4);
    }

    .fws__foot {
        margin: 12px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.8;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-2);
        }

        code {
            padding: 1px 5px;
            border-radius: var(--oa-radius-sm);
            background: var(--oa-hover);
            border: 1px solid var(--oa-border-light);
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            color: var(--oa-primary-deep);
        }
    }

    @media (max-width: 1400px) {
        .fws__grid {
            grid-template-columns: 1fr;
        }
    }
</style>
