<template>
    <PanelCard title="预估算法说明" subtitle="先看懂模型，再调参数 · 本页所有公式与口径均与数据引擎一致">
        <template #actions>
            <el-tag size="small" type="info" effect="plain">模型透明化</el-tag>
        </template>

        <div class="doc">
            <!-- ===== 1. 回收曲线（对数） ===== -->
            <article class="doc__block doc__block--log">
                <header class="doc__head">
                    <h4 class="doc__title">① 回收曲线（对数形态 · 当前系统采用）</h4>
                    <span class="doc__tag">累计口径</span>
                </header>

                <pre class="doc__code">ROI(n) = curveA · ln(n) + curveB</pre>

                <ul class="doc__list">
                    <li>
                        <b>n</b> = 投放后天数；<b>ROI(n)</b> = 第 n 天的<b>累计</b>回收 ROI（倍数，<b>1.0 = 回本</b>）。
                        例如 ROI(30) = 1.20，表示这批投放 30 天累计回收了消耗的 1.20 倍。
                    </li>
                    <li>
                        对数函数的边际增速 <code>dROI/dn = curveA / n</code> 随 n 递减，天然刻画「<b>早期回收快、后期趋缓</b>」的买量回收规律：
                        D1→D30 涨得最猛，D180 之后基本走平。
                    </li>
                    <li>
                        <b>curveB</b> 是首日回收率：把 n = 1 代入得 <code>ROI(1) = curveA · ln1 + curveB = curveB</code>，
                        所以 curveB 直接决定「第一天能收回多少」，也决定了这条曲线整体水位的高低。
                    </li>
                    <li>
                        <b>curveA</b> 决定曲线爬升速度：curveA 越大，同样的天数区间内 ROI 增长越多，回本越早；
                        curveA 越小则曲线扁平、回本周期被拉长。
                    </li>
                </ul>
            </article>

            <!-- ===== 2. 幂律备选 ===== -->
            <article class="doc__block doc__block--power">
                <header class="doc__head">
                    <h4 class="doc__title">② 幂律备选形态（现有系统也在用）</h4>
                    <span class="doc__tag doc__tag--alt">对照参考</span>
                </header>

                <pre class="doc__code">ROI(n) = p · n^q
q = (ln y₂ − ln y₁) / (ln x₂ − ln x₁)
p = y₁ / x₁^q</pre>

                <ul class="doc__list">
                    <li>幂律曲线用<b>两点拟合</b>：给定两个锚点 (x₁, y₁)、(x₂, y₂)，即可解出 p 与 q，曲线必然穿过这两个锚点。</li>
                    <li>
                        本页「曲线形状对比图」用对数曲线在 <b>D90 / D360</b> 两个锚点反推幂律参数，让两条曲线<b>共享同一组锚点</b>，
                        这样看到的差异才是「形态差异」，而不是参数差异。
                    </li>
                    <li>幂律形态在前期上扬更快、尾部长得更开；对数形态后期更平缓。同一批投放选择哪种形态，直接改变当月预估的回收金额。</li>
                </ul>
            </article>

            <!-- ===== 3~5. 三个口径公式 ===== -->
            <article class="doc__block doc__block--formula">
                <header class="doc__head">
                    <h4 class="doc__title">③ 三个核心口径的计算式</h4>
                    <span class="doc__tag doc__tag--op">经营口径</span>
                </header>

                <div class="doc__formula">
                    <p class="doc__formula-label">应确认收入（经营口径收入）</p>
                    <pre class="doc__code">应确认收入 = Σ 本期各投放日在其后各天的回收增量
           + 历史 cohort 在本期新回收的部分</pre>
                    <p class="doc__formula-note">
                        即：本期花的钱，按回收曲线逐日确认后面每一天新增的回收；早先投放的存量用户，在本期继续回收的部分也计入本期收入。
                    </p>
                </div>

                <div class="doc__formula">
                    <p class="doc__formula-label doc__formula-label--op">经营利润（权责发生制 + 预估）</p>
                    <pre class="doc__code">经营利润 = 应确认收入 − 本期投放消耗 − 人工成本 − 管理费用</pre>
                    <p class="doc__formula-note">及时反映经营质量，但含预估成分：投放消耗全额进成本，回收端按曲线预估，因此回本周期长的游戏当期会先「不赚钱」。</p>
                </div>

                <div class="doc__formula">
                    <p class="doc__formula-label doc__formula-label--book">账面利润（银行流水口径）</p>
                    <pre class="doc__code">账面利润 = 已到账收入 − 充值支出 − 人工成本 − 管理费用</pre>
                    <p class="doc__formula-note">收入按平台结算到账、成本按实际支付核算，精确可审计，但受结算周期（30~60 天）影响，数字滞后。</p>
                </div>

                <p class="doc__foot">
                    <b>注意：</b>全站 ROI / 回收完成度均为「自数据起点<b>累计</b>口径」，不是本期口径；
                    曲线参数（curveA / curveB）与预估窗口（90 / 180 / 360 日）会同时改变预估收入、预估 ROI 与应收未收。
                </p>
            </article>
        </div>
    </PanelCard>
</template>

<script setup lang="ts">
    import PanelCard from '@/components/PanelCard.vue';

    /**
     * 区块 1 · 算法说明卡（纯文字 + 公式）
     * 只解释模型，不取数、无 props；公式用等宽字体代码块展示。
     */
    defineOptions({ name: 'SettingsAlgorithmDoc' });
</script>

<style scoped lang="scss">
    .doc {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
        gap: var(--oa-gap);
        min-height: 0;
    }

    .doc__block {
        display: flex;
        flex-direction: column;
        gap: 8px;
        min-width: 0;
        padding: 12px 14px;
        border-radius: var(--oa-radius);
        border: 1px solid var(--oa-border-light);
        border-left: 3px solid var(--oa-primary);
        background: var(--oa-hover);
    }

    .doc__block--log {
        border-left-color: var(--oa-operating);
    }

    .doc__block--power {
        border-left-color: var(--oa-revenue);
    }

    .doc__block--formula {
        grid-column: 1 / -1;
        border-left-color: var(--oa-gap-color);
        background: var(--oa-card);
    }

    .doc__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
    }

    .doc__title {
        margin: 0;
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
    }

    .doc__tag {
        flex: 0 0 auto;
        padding: 1px 7px;
        border-radius: 10px;
        background: var(--oa-success-soft);
        color: var(--oa-success);
        font-size: var(--oa-fs-xs);
    }

    .doc__tag--alt {
        background: var(--oa-primary-soft);
        color: var(--oa-primary-deep);
    }

    .doc__tag--op {
        background: var(--oa-warning-soft);
        color: var(--oa-warning);
    }

    /* 公式块：等宽字体（这是公式不是正文，允许本地指定 font-family） */
    .doc__code {
        margin: 0;
        padding: 9px 11px;
        border-radius: var(--oa-radius-sm);
        border: 1px dashed var(--oa-border);
        background: var(--oa-card);
        color: var(--oa-primary-deep);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: var(--oa-fs-sm);
        line-height: 1.75;
        white-space: pre-wrap;
        word-break: break-word;
        overflow-x: auto;
    }

    .doc__list {
        margin: 0;
        padding-left: 18px;
        display: flex;
        flex-direction: column;
        gap: 5px;

        li {
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
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: var(--oa-fs-xs);
            color: var(--oa-primary-deep);
        }
    }

    .doc__formula {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 9px 0 0;

        & + .doc__formula {
            margin-top: 9px;
            border-top: 1px dashed var(--oa-border-light);
        }
    }

    .doc__formula-label {
        margin: 0;
        font-size: var(--oa-fs-sm);
        font-weight: 600;
        color: var(--oa-operating);
    }

    .doc__formula-label--op {
        color: var(--oa-operating);
    }

    .doc__formula-label--book {
        color: var(--oa-book);
    }

    .doc__formula-note {
        margin: 0;
        font-size: var(--oa-fs-xs);
        line-height: 1.7;
        color: var(--oa-text-3);
    }

    .doc__foot {
        margin: 0;
        padding: 8px 10px;
        border-radius: var(--oa-radius-sm);
        background: var(--oa-primary-soft);
        font-size: var(--oa-fs-xs);
        line-height: 1.75;
        color: var(--oa-text-2);

        b {
            color: var(--oa-primary-deep);
        }
    }
</style>
