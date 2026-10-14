<template>
    <PanelCard title="当前生效的成本参数" subtitle="以下常量直接参与全站成本核算（从维度配置读取，非页面硬编码）">
        <div class="cpc__grid">
            <article v-for="item in rateItems" :key="item.label" class="cpc__card">
                <span class="cpc__label">{{ item.label }}</span>
                <span class="cpc__value oa-num">{{ item.value }}</span>
                <span class="cpc__expr">{{ item.expr }}</span>
                <span class="cpc__note">{{ item.note }}</span>
            </article>
        </div>

        <h4 class="cpc__sub">各中心人均月薪（月薪基数，参与人工成本按月计提）</h4>
        <el-table :data="salaryRows" size="small" show-overflow-tooltip>
            <el-table-column prop="name" label="中心" min-width="150" fixed />
            <el-table-column label="人均月薪" width="120" align="right">
                <template #default="{ row }">
                    <span class="oa-num cpc__strong">{{ money(row.salary) }}</span>
                </template>
            </el-table-column>
            <el-table-column label="医社保（公司承担）" width="164" align="right">
                <template #default="{ row }">
                    <span class="oa-num">{{ money(row.socialInsurance) }}</span>
                    <span class="cpc__rate">（{{ percent(SOCIAL_INSURANCE_RATE) }}）</span>
                </template>
            </el-table-column>
            <el-table-column label="个税（代缴）" width="150" align="right">
                <template #default="{ row }">
                    <span class="oa-num">{{ money(row.tax) }}</span>
                    <span class="cpc__rate">（{{ percent(TAX_RATE) }}）</span>
                </template>
            </el-table-column>
            <el-table-column label="办公费（元/人·月）" width="160" align="right">
                <template #default="{ row }">
                    <span class="oa-num">{{ money(row.office) }}</span>
                    <span class="cpc__rate">（管理费用）</span>
                </template>
            </el-table-column>
            <el-table-column label="合计单人月成本" width="150" align="right">
                <template #default="{ row }">
                    <span class="oa-num cpc__strong">{{ money(row.total) }}</span>
                </template>
            </el-table-column>
        </el-table>

        <p class="cpc__foot">
            口径说明：中心人均月薪是各中心的人头月薪基数，个人实际月薪在此基础上按职级系数浮动；
            <b>医社保</b>（比例 {{ percent(SOCIAL_INSURANCE_RATE) }}）与<b>个税</b>（比例 {{ percent(TAX_RATE) }}）按人按月随工资一并计提，计入人工成本；
            <b>福利费</b>按中心人工成本 × {{ percent(WELFARE_RATE) }} 归集，<b>办公费</b>按人头 × {{ money(OFFICE_COST_PER_HEAD) }}/人/月 归集，两者构成管理费用。
            人工成本与项目奖金按组织树直接归集到部门 / 小组（有人员归属表），不下摊；
            管理费用属间接费用，在数据引擎中对业务轴按投放消耗占比向下分摊，详情见上方「成本分摊规则表」。
        </p>
    </PanelCard>
</template>

<script setup lang="ts">
    import { computed } from 'vue';
    import PanelCard from '@/components/PanelCard.vue';
    import {
        CENTERS,
        CENTER_SALARY,
        OFFICE_COST_PER_HEAD,
        SOCIAL_INSURANCE_RATE,
        TAX_RATE,
        WELFARE_RATE,
    } from '@/domain/dimensions';
    import { money, percent } from '@/utils/format';

    /**
     * 区块 5 补充 · 当前实际使用的成本参数常量
     * 全部从 @/domain/dimensions 导入（不硬编码），金额用 money()、比例用 percent() 格式化。
     */
    defineOptions({ name: 'SettingsCostParamConstants' });

    const rateItems = computed(() => [
        {
            label: '医社保公司承担比例',
            value: percent(SOCIAL_INSURANCE_RATE),
            expr: 'SOCIAL_INSURANCE_RATE',
            note: '按个人月薪计提，计入人工成本',
        },
        {
            label: '个税占薪资比例',
            value: percent(TAX_RATE),
            expr: 'TAX_RATE',
            note: '公司代缴现金流口径，计入人工成本',
        },
        {
            label: '福利费计提比例',
            value: percent(WELFARE_RATE),
            expr: 'WELFARE_RATE',
            note: '按中心人工成本比例归集，计入管理费用',
        },
        {
            label: '办公费单价',
            value: `${money(OFFICE_COST_PER_HEAD)} / 人 · 月`,
            expr: 'OFFICE_COST_PER_HEAD',
            note: '按中心人头数归集，计入管理费用',
        },
    ]);

    /** 各中心人均月薪 + 由其派生的单人月成本（纯函数推导，与数据引擎同一套常量） */
    const salaryRows = computed(() =>
        CENTERS.map((c) => {
            const salary = CENTER_SALARY[c.id] ?? 0;
            const socialInsurance = salary * SOCIAL_INSURANCE_RATE;
            const tax = salary * TAX_RATE;
            return {
                key: c.id,
                name: c.name,
                headcount: c.headcount,
                salary,
                socialInsurance,
                tax,
                office: OFFICE_COST_PER_HEAD,
                total: salary + socialInsurance + tax,
            };
        }),
    );
</script>

<style scoped lang="scss">
    .cpc__grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    .cpc__card {
        display: flex;
        flex-direction: column;
        gap: 3px;
        min-width: 0;
        padding: 10px 12px;
        border: 1px solid var(--oa-border-light);
        border-radius: var(--oa-radius);
        background: var(--oa-hover);
    }

    .cpc__label {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-3);
    }

    .cpc__value {
        font-size: var(--oa-fs-lg);
        font-weight: 600;
        color: var(--oa-primary-deep);
    }

    .cpc__expr {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 11px;
        color: var(--oa-text-4);
    }

    .cpc__note {
        font-size: var(--oa-fs-xs);
        line-height: 1.6;
        color: var(--oa-text-4);
    }

    .cpc__sub {
        margin: 14px 0 8px;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-text-2);
    }

    .cpc__strong {
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .cpc__rate {
        margin-left: 3px;
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
    }

    .cpc__foot {
        margin: 12px 0 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.85;
        color: var(--oa-text-3);

        b {
            color: var(--oa-text-2);
        }
    }
</style>
