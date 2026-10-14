<template>
    <PanelCard title="假设控制面板" subtitle="沙盒参数，不写回全局" class="assump">
        <el-form class="assump__form" label-position="top" size="small" @submit.prevent>
            <!-- 投放预算变化 -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        投放预算变化
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                整体月投放消耗相对近 3 个月基线的变化。<br />
                                范围 −50% ~ +100%，步长 5%；正数 = 放量，负数 = 控量。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                    <b class="assump__val oa-num" :class="trendClass(params.budgetDelta)">
                        {{ changeText(params.budgetDelta, 0) }}
                    </b>
                </template>
                <el-slider
                    v-model="params.budgetDelta"
                    :min="-0.5"
                    :max="1"
                    :step="0.05"
                    :format-tooltip="pctTooltip"
                    :marks="{ '-0.5': '-50%', 0: '基线', 0.3: '+30%', 1: '+100%' }"
                />
            </el-form-item>

            <!-- 曲线 curveA -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        回收曲线 curveA 变化
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                curveA 是回收曲线的爬升速度（ROI(n)=A·ln n+B）。<br />
                                范围 −30% ~ +30%；下调 = 回本更慢，上调 = 回本更快。<br />
                                注意：A 每 +5%，360 天累计 ROI 约 +0.2 倍，对结果影响很大。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                    <b class="assump__val oa-num" :class="trendClass(params.curveADelta)">
                        {{ changeText(params.curveADelta, 0) }}
                    </b>
                </template>
                <el-slider
                    v-model="params.curveADelta"
                    :min="-0.3"
                    :max="0.3"
                    :step="0.01"
                    :format-tooltip="pctTooltip"
                    :marks="{ '-0.3': '-30%', 0: '基线', 0.3: '+30%' }"
                />
            </el-form-item>

            <!-- 曲线 curveB -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        回收曲线 curveB 变化
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                curveB 决定首日回收率 ROI(1)=A·ln1+B=B，也抬高整条曲线。<br />
                                范围 −30% ~ +30%；通常代表买量质量 / 变现效率的变化。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                    <b class="assump__val oa-num" :class="trendClass(params.curveBDelta)">
                        {{ changeText(params.curveBDelta, 0) }}
                    </b>
                </template>
                <el-slider
                    v-model="params.curveBDelta"
                    :min="-0.3"
                    :max="0.3"
                    :step="0.01"
                    :format-tooltip="pctTooltip"
                    :marks="{ '-0.3': '-30%', 0: '基线', 0.3: '+30%' }"
                />
            </el-form-item>

            <!-- 预估窗口 -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        预估窗口
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                用哪条窗口的回收曲线折算「可回收总额」。<br />
                                窗口越长，折算出的收入越高（分母不变），累计预估 ROI 也越高。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                </template>
                <el-radio-group v-model="params.window" size="small">
                    <el-radio-button :value="90">90 日</el-radio-button>
                    <el-radio-button :value="180">180 日</el-radio-button>
                    <el-radio-button :value="360">360 日</el-radio-button>
                </el-radio-group>
            </el-form-item>

            <!-- 人工成本变化 -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        人工成本变化
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                招聘 / 精简的推演：人工成本（工资+医社保+个税+奖金）相对基线的变化。<br />
                                范围 −20% ~ +30%；管理费用按 50% 传导系数联动。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                    <b class="assump__val oa-num" :class="trendClass(params.laborDelta)">
                        {{ changeText(params.laborDelta, 0) }}
                    </b>
                </template>
                <el-slider
                    v-model="params.laborDelta"
                    :min="-0.2"
                    :max="0.3"
                    :step="0.05"
                    :format-tooltip="pctTooltip"
                    :marks="{ '-0.2': '-20%', 0: '基线', 0.3: '+30%' }"
                />
            </el-form-item>

            <!-- 平台结构 -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        平台结构
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                只保留选中的平台，并把投放预算按权重重新分配。<br />
                                不同平台结算滞后天数不同（腾讯 45 天 / 巨量·快手 30 天 / 小米 60 天），<br />
                                因此平台结构会影响现金缺口，但不影响经营利润的计量口径。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                </template>
                <el-select v-model="params.platformIds" multiple collapse-tags placeholder="选择平台" class="assump__select">
                    <el-option v-for="p in platforms" :key="p.id" :label="p.name" :value="p.id">
                        <span class="assump__dot" :style="{ background: p.color }" />
                        <span>{{ p.name }}</span>
                        <span class="assump__opt-sub oa-num">基线 {{ percent(p.baseShare, 0) }}</span>
                    </el-option>
                </el-select>

                <div v-if="activePlatforms.length" class="assump__weights">
                    <div v-for="p in activePlatforms" :key="p.id" class="assump__weight">
                        <span class="assump__weight-name" :title="`结算滞后 ${p.settleLagDays} 天`">
                            <i class="assump__dot" :style="{ background: p.color }" />{{ p.name }}
                        </span>
                        <el-slider
                            v-model="params.platformWeight[p.id]"
                            :min="0"
                            :max="100"
                            :step="5"
                            size="small"
                            :show-tooltip="false"
                            class="assump__weight-slider"
                        />
                        <span class="assump__weight-val oa-num">
                            权重 {{ params.platformWeight[p.id] ?? 0 }}
                            <em class="assump__muted">实投 {{ percent(structureShare(p.id), 0) }} · 结算滞后 {{ p.settleLagDays }} 天</em>
                        </span>
                    </div>
                </div>
                <p v-else class="assump__note">未选择平台时无投放，推演结果为空。</p>
            </el-form-item>

            <!-- 游戏结构 -->
            <el-form-item class="assump__item">
                <template #label>
                    <span class="assump__label">
                        游戏结构
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                只保留选中的游戏，未选中的游戏不再投放。<br />
                                投入按选中游戏的实际消耗等比缩放，回收按各游戏自己的曲线逐组合卷积。<br />
                                <b>人工与管理费用不随游戏选择缩放</b>（组织不会因为少投几个游戏就减人），<br />
                                因此只投少数游戏会显著压低利润——这正是"砍游戏"决策要看的代价。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                    <b class="assump__val oa-num">已选 {{ params.gameIds.length }}</b>
                </template>
                <el-select
                    v-model="params.gameIds"
                    multiple
                    collapse-tags
                    collapse-tags-tooltip
                    :multiple-limit="8"
                    placeholder="选择游戏（最多 8 个）"
                    class="assump__select"
                >
                    <el-option v-for="g in games" :key="g.id" :label="g.name" :value="g.id">
                        <span>{{ g.name }}</span>
                        <span class="assump__opt-sub oa-num">基线 {{ percent(g.baseShare, 0) }}</span>
                    </el-option>
                </el-select>
                <p class="assump__note">
                    当前游戏结构覆盖基线消耗 {{ percent(gameScale, 0) }}；固定成本（人工 + 管理费用）始终按全公司口径计入，
                    因此覆盖比例越低、利润被摊薄的幅度越大。默认已选中全部有消耗的游戏，与「月度经营预估」页口径一致。
                </p>
            </el-form-item>

            <!-- 推演期数 -->
            <el-form-item class="assump__item assump__item--last">
                <template #label>
                    <span class="assump__label">
                        推演期数
                        <el-tooltip placement="top" effect="dark">
                            <template #content>
                                从下个月起推演多少个月。<br />
                                期数越长，累计经营利润越大，但季节系数与预估窗口的折算影响也越明显。
                            </template>
                            <span class="assump__q">?</span>
                        </el-tooltip>
                    </span>
                </template>
                <el-radio-group v-model="params.horizon" size="small">
                    <el-radio-button :value="3">3 个月</el-radio-button>
                    <el-radio-button :value="6">6 个月</el-radio-button>
                    <el-radio-button :value="12">12 个月</el-radio-button>
                </el-radio-group>
            </el-form-item>
        </el-form>

        <template #actions>
            <el-button size="small" @click="emit('applyFilter')">应用当前筛选范围</el-button>
            <el-button size="small" type="primary" plain @click="emit('reset')">重置为基线</el-button>
        </template>
    </PanelCard>
</template>

<script setup lang="ts">
    import PanelCard from '@/components/PanelCard.vue';
    import type { PlatformStruct, SandboxParams } from './simulatorEngine';
    import { changeText, percent, trendClass } from '@/utils/format';
    import { computed } from 'vue';

    /** 假设控制面板：所有推演参数的唯一入口（参数对象由页面持有，本组件只改内容） */
    defineOptions({ name: 'SimulatorAssumptionPanel' });

    const props = defineProps<{
        /** 页面持有的推演参数（reactive），本组件直接改其字段 */
        params: SandboxParams;
        /** 基线平台结构（含消耗占比，用于提示） */
        platforms: PlatformStruct[];
        /** 基线游戏结构 */
        games: Array<{ id: string; name: string; baseShare: number }>;
    }>();

    const emit = defineEmits<{ reset: []; applyFilter: [] }>();

    const activePlatforms = computed(() => props.platforms.filter((p) => props.params.platformIds.includes(p.id)));

    /** 选中平台权重总量（用于把权重换算成实际投入占比） */
    const weightTotal = computed(() =>
        activePlatforms.value.reduce((s, p) => s + Math.max(0, props.params.platformWeight[p.id] ?? 0), 0),
    );

    /** 某平台的实际投入占比 = 归一化权重（游戏结构再乘一层） */
    function structureShare(pid: string): number {
        if (weightTotal.value <= 0) return 0;
        return Math.max(0, props.params.platformWeight[pid] ?? 0) / weightTotal.value;
    }

    /** 选中游戏的基线消耗合计占比 */
    const gameScale = computed(() => {
        const sel = new Set(props.params.gameIds);
        return props.games.reduce((s, g) => s + (sel.has(g.id) ? g.baseShare : 0), 0);
    });

    function pctTooltip(v: number): string {
        return changeText(v, 0);
    }
</script>

<style scoped lang="scss">
    .assump {
        min-height: 0;
    }

    .assump__form {
        display: flex;
        flex-direction: column;
        min-height: 0;
    }

    .assump__item {
        margin-bottom: 6px;

        :deep(.el-form-item__label) {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
            padding: 0 0 2px;
            line-height: 20px;
            color: var(--oa-text-2);
        }

        :deep(.el-form-item__content) {
            display: block;
            line-height: 1.4;
        }

        :deep(.el-slider) {
            --el-slider-height: 4px;
        }

        :deep(.el-slider__marks-text) {
            font-size: 10px;
            color: var(--oa-text-4);
            white-space: nowrap;
        }

        :deep(.el-radio-button__inner) {
            padding: 5px 9px;
            font-size: var(--oa-fs-xs);
        }

        &--last {
            margin-bottom: 0;
        }
    }

    .assump__label {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
    }

    .assump__q {
        display: inline-grid;
        place-items: center;
        width: 13px;
        height: 13px;
        border-radius: 50%;
        background: var(--oa-border);
        color: var(--oa-text-3);
        font-size: 10px;
        cursor: help;
    }

    .assump__val {
        font-size: var(--oa-fs-xs);
        font-weight: 600;
    }

    .assump__select {
        width: 100%;
    }

    .assump__dot {
        display: inline-block;
        width: 8px;
        height: 8px;
        margin-right: 6px;
        border-radius: 50%;
        vertical-align: middle;
    }

    .assump__opt-sub {
        float: right;
        margin-left: 12px;
        color: var(--oa-text-4);
        font-size: var(--oa-fs-xs);
    }

    .assump__weights {
        margin-top: 6px;
        padding: 6px 8px;
        background: var(--oa-hover);
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius-sm);
    }

    .assump__weight {
        display: grid;
        grid-template-columns: 72px 1fr;
        grid-template-rows: auto auto;
        align-items: center;
        gap: 0 8px;
        padding: 2px 0;
    }

    .assump__weight-name {
        grid-row: 1 / span 2;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-2);
        white-space: nowrap;
    }

    .assump__weight-slider {
        grid-column: 2;
    }

    .assump__weight-val {
        grid-column: 2;
        font-size: 11px;
        color: var(--oa-text-3);
    }

    .assump__muted {
        margin-left: 6px;
        font-style: normal;
        color: var(--oa-text-4);
    }

    .assump__note {
        margin: 4px 0 0;
        font-size: 11px;
        line-height: 1.5;
        color: var(--oa-text-4);
    }
</style>
