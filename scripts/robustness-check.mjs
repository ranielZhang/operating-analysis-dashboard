/**
 * 极端筛选健壮性测试：把全局筛选条件推到边界，逐页真实渲染，捕获运行时异常与异常数值。
 *
 * 覆盖的场景都是「业务上会出现、但开发者容易忘」的：
 *   单月 / 全部历史 / 未来空区间 / 无投放的成本中心 / 单个亏损游戏 / 单投手 /
 *   账面口径 / 90 日窗口 / 按年粒度 / 按季度粒度 / 按项目
 *
 * 用法：node scripts/robustness-check.mjs
 */
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus';

/**
 * Element Plus 在 SSR 下要求应用显式提供 id / z-index provider，否则每个使用
 * useId / useZIndex 的组件都会打一条 ElementPlusError（IdInjection / ZIndexInjection）。
 * 那是**本脚本的脚手架配置问题**，不是应用缺陷：浏览器端是纯 CSR，永远不会触发。
 * 这里补上 provider，让输出只反映真正的应用告警与渲染问题。
 */
function provideSsrInjections(app) {
    app.provide(ID_INJECTION_KEY, { prefix: 1024, current: 0 });
    app.provide(ZINDEX_INJECTION_KEY, { current: 0 });
}

const PAGES = [
    ['经营总览', '/src/pages/overview/index.vue'],
    ['逐层下钻', '/src/pages/drilldown/index.vue'],
    ['月度预估', '/src/pages/forecast/index.vue'],
    ['收入分析', '/src/pages/revenue/index.vue'],
    ['成本分析', '/src/pages/cost/index.vue'],
    ['投手人效', '/src/pages/pitcher/index.vue'],
    ['参数配置', '/src/pages/settings/index.vue'],
];

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

const { useAnalysisFilter } = await server.ssrLoadModule('/src/composables/useAnalysisFilter.ts');
const { store } = await server.ssrLoadModule('/src/domain/store.ts');
const filter = useAnalysisFilter().filter;

const base = () => ({
    ...store.defaultFilter(),
});

const SCENARIOS = [
    ['默认（近12月·经营口径）', () => base()],
    ['账面口径 + 90日窗口', () => ({ ...base(), basis: 'book', roiWindow: 90 })],
    ['单月（当月）', () => ({ ...base(), startMonth: store.currentMonth, endMonth: store.currentMonth })],
    ['全部历史', () => ({ ...base(), startMonth: store.months[0], endMonth: store.currentMonth })],
    ['完全无投放期（2026-06 之后）', () => ({ ...base(), startMonth: '2026-07', endMonth: '2026-09' })],
    ['成本中心（研发中心）', () => ({ ...base(), centerIds: ['c1'] })],
    ['单个亏损游戏（成语消消 g16）', () => ({ ...base(), gameIds: ['g16'] })],
    ['单个投手', () => ({ ...base(), pitcherIds: [store.defaultFilter() && 'c2d1g1p1'] })],
    ['按年粒度', () => ({ ...base(), granularity: 'year', startMonth: store.months[0] })],
    ['按季度粒度', () => ({ ...base(), granularity: 'quarter', startMonth: '2024-01' })],
    ['单项目 + 单平台', () => ({ ...base(), projectIds: ['pj2'], platformIds: ['pf1'] })],
];

const mods = new Map();
let totalFail = 0;
let totalWarn = 0;

for (const [sName, makeFilter] of SCENARIOS) {
    Object.assign(filter, makeFilter());
    const line = [];
    for (const [pName, path] of PAGES) {
        try {
            if (!mods.has(path)) mods.set(path, (await server.ssrLoadModule(path)).default);
            const app = createSSRApp(mods.get(path));
            app.use(ElementPlus);
            provideSsrInjections(app);
            const html = await renderToString(app);
            const bad = [];
            if (/\bNaN\b/.test(html)) bad.push('NaN');
            if (/\bInfinity\b/.test(html)) bad.push('Infinity');
            if (/\[object Object\]/.test(html)) bad.push('[object Object]');
            if (html.length < 400) bad.push(`过短${html.length}`);
            if (bad.length) {
                totalWarn++;
                line.push(`${pName}:${bad.join('/')}`);
            }
        } catch (err) {
            totalFail++;
            line.push(`${pName}:渲染异常(${err && err.message ? err.message.slice(0, 60) : err})`);
        }
    }
    const status = line.length ? `⚠️  ${line.join('  |  ')}` : '✅ 全部通过';
    console.log(`${sName.padEnd(26)} ${status}`);
}

await server.close();
console.log(`\n异常场景 ${totalWarn} 个，渲染失败 ${totalFail} 个（共 ${SCENARIOS.length} × ${PAGES.length} = ${SCENARIOS.length * PAGES.length} 次渲染）`);
process.exit(totalFail ? 1 : 0);
