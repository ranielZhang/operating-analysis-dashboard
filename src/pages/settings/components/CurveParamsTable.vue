<template>
    <PanelCard title="回收曲线参数表" subtitle="每个游戏一条回收曲线：ROI(n) = curveA · ln(n) + curveB" plain>
        <template #actions>
            <span class="cpt__count">
                共 <b class="oa-num">{{ rows.length }}</b> 个游戏 · 低于回本线
                <b class="oa-num oa-down">{{ breakEvenCount }}</b> 个
            </span>
            <el-input
                v-model="keyword"
                class="cpt__search"
                size="small"
                clearable
                placeholder="搜索游戏名称 / 所属项目"
                :prefix-icon="Search"
            />
        </template>

        <div class="cpt__body">
            <el-table
                :data="rows"
                size="small"
                height="100%"
                show-overflow-tooltip
                :default-sort="{ prop: 'roi360', order: 'descending' }"
            >
                <el-table-column type="index" label="#" width="46" align="center" fixed="left" />

                <el-table-column prop="name" label="游戏名称" min-width="150" fixed="left" sortable>
                    <template #default="{ row }">
                        <span class="cpt__game">{{ row.name }}</span>
                        <el-tag v-if="GAME_MAP.get(row.key)?.keyGame" class="cpt__key" size="small" effect="plain" type="warning">
                            重点
                        </el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="所属项目" min-width="110" fixed="left">
                    <template #default="{ row }">{{ projectName(row.key) }}</template>
                </el-table-column>

                <el-table-column label="变现类型" width="88" align="center">
                    <template #default="{ row }">
                        <el-tag size="small" effect="plain" :type="row.monetizeTag">{{ row.monetizeText }}</el-tag>
                    </template>
                </el-table-column>

                <el-table-column label="生命周期阶段" width="104" align="center">
                    <template #default="{ row }">
                        <span class="cpt__stage" :class="`cpt__stage--${row.stageKey}`">{{ row.stage }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="curveA" label="curveA" width="82" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.curveA.toFixed(2) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="curveB" label="curveB（= D1）" width="104" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.curveB.toFixed(2) }}</span>
                    </template>
                </el-table-column>

                <el-table-column
                    v-for="col in ROI_COLS"
                    :key="col.prop"
                    :prop="col.prop"
                    :label="col.label"
                    width="92"
                    align="right"
                    sortable
                >
                    <template #default="{ row }">
                        <span class="oa-num" :class="roiClass(row[col.prop])">{{ ratio(row[col.prop]) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="paybackDays" label="目标回本周期" width="108" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ row.paybackDays }} 天</span>
                    </template>
                </el-table-column>

                <el-table-column prop="breakEvenDay" label="曲线实际回本" width="108" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num" :class="row.breakEvenDay > 0 ? '' : 'oa-muted'">{{ paybackText(row.breakEvenDay) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="redLineRoi" label="ROI 红线" width="92" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num oa-down">{{ ratio(row.redLineRoi) }}</span>
                    </template>
                </el-table-column>

                <el-table-column prop="mape" label="拟合 MAPE（演示值）" width="150" align="right" sortable>
                    <template #default="{ row }">
                        <span class="oa-num">{{ percent(row.mape) }}</span>
                        <el-progress
                            class="cpt__mape"
                            :percentage="Math.min(100, Math.round(row.mape * 100 * 6))"
                            :show-text="false"
                            :stroke-width="4"
                            :color="row.mape > 0.09 ? '#ff9140' : '#4d94fa'"
                        />
                    </template>
                </el-table-column>
            </el-table>
        </div>

        <p class="cpt__foot">
            <b>ROI 口径：</b>D1 / D30 / D90 / D180 / D360 = 投放后第 n 天的<b>累计</b>回收 ROI（倍数，1.0 = 回本），由
            <code>roiAt(n, curveA, curveB)</code> 计算；D1 恒等于 curveB。低于 1.0（未回本）标红，达标标绿。
            「曲线实际回本」= 由 curveA / curveB 解出的 ROI 首次达到 1.0 的天数，可与该游戏的目标回本周期互相校验。
            <br />
            <b>拟合 MAPE 为演示值</b>：真实系统需用各投放日的实际回收数据回归拟合后回填，本页按游戏 id 生成确定性模拟值仅供展示，
            不代表真实拟合精度。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed, ref } from 'vue';
    import { Search } from '@element-plus/icons-vue';
    import PanelCard from '@/components/PanelCard.vue';
    import { GAMES, GAME_MAP, PROJECT_MAP } from '@/domain/dimensions';
    import { hash01, roiAt } from '@/domain/store';
    import type { CurveParam, GameMeta } from '@/domain/types';
    import { percent, ratio } from '@/utils/format';

    /**
     * 区块 2 · 回收曲线参数表
     * 用 GAMES 构造表；MAPE 为按 hash01(game.id) 生成的确定性「演示值」，界面上已明确标注。
     */
    defineOptions({ name: 'SettingsCurveParamsTable' });

    /** 表格行 = CurveParam（scope='game'，参数取自 GameMeta）+ 各期 ROI 预计算值 */
    type ParamRow = Omit<CurveParam, 'scope' | 'scopeId' | 'scopeName' | 'sampleDays' | 'enabled'> & {
        /** 游戏 id（表格行键） */
        key: string;
        name: string;
        projectId: string;
        monetize: GameMeta['monetize'];
        stage: GameMeta['stage'];
        /** 变现类型展示文案 / 标签色（预计算，避免模板内索引 Record） */
        monetizeText: string;
        monetizeTag: 'success' | 'warning' | 'primary';
        /** 阶段样式后缀（test / grow / mature / decline） */
        stageKey: string;
        paybackDays: number;
        redLineRoi: number;
        roi1: number;
        roi30: number;
        roi90: number;
        roi180: number;
        roi360: number;
        /** 曲线实际回本天数（ROI 首次 ≥ 1.0），0 = 360 天内未回本 */
        breakEvenDay: number;
    };

    const ROI_COLS = [
        { prop: 'roi1', label: 'D1 ROI' },
        { prop: 'roi30', label: 'D30 ROI' },
        { prop: 'roi90', label: 'D90 ROI' },
        { prop: 'roi180', label: 'D180 ROI' },
        { prop: 'roi360', label: 'D360 ROI' },
    ] as const;

    const MONETIZE_TEXT: Record<GameMeta['monetize'], string> = { iaa: 'IAA 广告', iap: 'IAP 内购', mix: '混合变现' };
    const MONETIZE_TAG: Record<GameMeta['monetize'], 'success' | 'warning' | 'primary'> = {
        iaa: 'success',
        iap: 'warning',
        mix: 'primary',
    };
    const STAGE_KEY: Record<GameMeta['stage'], string> = {
        测试期: 'test',
        成长期: 'grow',
        成熟期: 'mature',
        衰退期: 'decline',
    };

    /** ROI 首次达到 1.0（回本）的天数：由 a·ln(n)+b ≥ 1 解出 n = exp((1−b)/a) */
    function breakEvenDayOf(a: number, b: number): number {
        if (a <= 0) return b >= 1 ? 1 : 0;
        const n = Math.exp((1 - b) / a);
        if (!Number.isFinite(n)) return 1;
        return n <= 1 ? 1 : n <= 360 ? Math.ceil(n) : 0;
    }

    /**
     * 拟合 MAPE 的「演示值」（3% ~ 12%）
     * hash01 是数据引擎的确定性哈希，但游戏 id 连续（g1/g2/...）时其取值几乎等差，
     * 直接用会得到一排几乎相同的百分比。这里叠加两轮 hash01 把 id 打散，
     * 仍是纯确定性计算（不用 Math.random），且界面上已明确标注为演示值。
     */
    function demoMape(id: string): number {
        const raw = (hash01(`${id}:mape`) + hash01(`mape:${id}:fit`) * 0.37) % 1;
        return 0.03 + raw * 0.09;
    }

    const allRows = computed<ParamRow[]>(() =>
        GAMES.map((g) => {
            const roi1 = roiAt(1, g.curveA, g.curveB);
            const roi30 = roiAt(30, g.curveA, g.curveB);
            const roi90 = roiAt(90, g.curveA, g.curveB);
            const roi180 = roiAt(180, g.curveA, g.curveB);
            const roi360 = roiAt(360, g.curveA, g.curveB);
            return {
                key: g.id,
                name: g.name,
                projectId: g.projectId,
                monetize: g.monetize,
                stage: g.stage,
                monetizeText: MONETIZE_TEXT[g.monetize] ?? g.monetize,
                monetizeTag: MONETIZE_TAG[g.monetize] ?? 'primary',
                stageKey: STAGE_KEY[g.stage] ?? 'mature',
                curveA: g.curveA,
                curveB: g.curveB,
                paybackDays: g.paybackDays,
                redLineRoi: g.redLineRoi,
                roi1,
                roi30,
                roi90,
                roi180,
                roi360,
                /** 演示值：确定性模拟 MAPE（3% ~ 12%），非真实拟合结果 */
                mape: demoMape(g.id),
                breakEvenDay: breakEvenDayOf(g.curveA, g.curveB),
            };
        }),
    );

    const keyword = ref('');
    const rows = computed<ParamRow[]>(() => {
        const kw = keyword.value.trim().toLowerCase();
        if (!kw) return allRows.value;
        return allRows.value.filter(
            (r) =>
                r.name.toLowerCase().includes(kw) ||
                (PROJECT_MAP.get(r.projectId)?.name ?? '').toLowerCase().includes(kw),
        );
    });

    /** 低于回本线（D360 ROI < 1.0）的游戏数 */
    const breakEvenCount = computed(() => rows.value.filter((r) => r.roi360 < 1).length);

    function projectName(key: string): string {
        return PROJECT_MAP.get(GAME_MAP.get(key)?.projectId ?? '')?.name ?? '—';
    }

    /** 低于 1.0 = 未回本（红）；≥ 1.0 = 已回本（绿） */
    function roiClass(v: number): string {
        return v < 1 ? 'oa-down' : 'oa-up';
    }

    function paybackText(day: number): string {
        return day > 0 ? `第 ${day} 天` : '360 天内未回本';
    }
</script>

<style scoped lang="scss">
    .cpt__count {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);

        b {
            font-weight: 600;
        }
    }

    .cpt__search {
        width: 220px;
    }

    /* 表格区域固定高度，内部滚动（表格自身 height="100%"） */
    .cpt__body {
        height: 380px;
        min-height: 0;
        padding: 0;
    }

    .cpt__game {
        color: var(--oa-text-1);
        font-weight: 600;
    }

    .cpt__key {
        margin-left: 5px;
        transform: scale(0.92);
    }

    .cpt__stage {
        display: inline-block;
        padding: 1px 7px;
        border-radius: 10px;
        font-size: var(--oa-fs-xs);
    }

    .cpt__stage--test {
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);
    }

    .cpt__stage--grow {
        background: var(--oa-success-soft);
        color: var(--oa-success);
    }

    .cpt__stage--mature {
        background: #f1f5f9;
        color: var(--oa-text-2);
    }

    .cpt__stage--decline {
        background: var(--oa-warning-soft);
        color: var(--oa-warning);
    }

    .cpt__mape {
        width: 100%;
        margin-top: 2px;
    }

    .cpt__foot {
        flex: 0 0 auto;
        margin: 0;
        padding: 9px 14px;
        border-top: 1px solid var(--oa-border-light);
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
</style>
