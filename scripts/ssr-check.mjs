/**
 * SSR 渲染冒烟测试：把 9 个页面在 Node 中真实渲染一遍，捕获运行时异常。
 *
 * 为什么需要：dev server 只能证明「模块能编译」，证明不了「渲染不出错」。
 * 本脚本用 Vite 的 ssrLoadModule 加载页面组件，配 Element Plus 真实渲染成 HTML，
 * 并扫描产物中的 NaN / undefined / Infinity / [object Object] 等异常痕迹。
 *
 * 用法：node scripts/ssr-check.mjs
 */
import { createServer } from 'vite';
import { createSSRApp } from 'vue';
import { renderToString } from 'vue/server-renderer';
import ElementPlus, { ID_INJECTION_KEY, ZINDEX_INJECTION_KEY } from 'element-plus';

/**
 * Element Plus 在 SSR 下要求应用显式提供 id / z-index provider，否则每个使用
 * useId / useZIndex 的组件都会打一条 ElementPlusError（IdInjection / ZIndexInjection）。
 * 那是**本脚本的脚手架配置问题**，不是应用缺陷：浏览器端是纯 CSR，永远不会触发。
 * 这里补上 provider，让 ElementPlusError 计数只反映「真正需要修的应用代码告警」。
 */
function provideSsrInjections(app) {
    app.provide(ID_INJECTION_KEY, { prefix: 1024, current: 0 });
    app.provide(ZINDEX_INJECTION_KEY, { current: 0 });
}

const ROUTES = [
    ['经营总览', '/src/pages/overview/index.vue'],
    ['逐层下钻', '/src/pages/drilldown/index.vue'],
    ['月度经营预估', '/src/pages/forecast/index.vue'],
    ['收入分析', '/src/pages/revenue/index.vue'],
    ['成本分析', '/src/pages/cost/index.vue'],
    ['投手人效', '/src/pages/pitcher/index.vue'],
    ['预估参数配置', '/src/pages/settings/index.vue'],
];

const server = await createServer({
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
});

let failed = 0;
const warnings = [];

for (const [name, path] of ROUTES) {
    try {
        const mod = await server.ssrLoadModule(path);
        const comp = mod.default;
        if (!comp) throw new Error('模块没有 default 导出');
        const app = createSSRApp(comp);
        app.use(ElementPlus);
        provideSsrInjections(app);
        const html = await renderToString(app);
        const problems = [];
        if (/NaN/.test(html)) problems.push('出现 NaN');
        if (/Infinity/.test(html)) problems.push('出现 Infinity');
        if (/\[object Object\]/.test(html)) problems.push('出现 [object Object]');
        if (/undefined/.test(html)) problems.push('出现 undefined 字面量');
        const len = html.length;
        if (len < 400) problems.push(`渲染产物过短(${len})`);
        if (problems.length) {
            failed++;
            console.log(`⚠️  ${name.padEnd(8)} 渲染 ${len} 字符，但：${problems.join('、')}`);
        } else {
            console.log(`✅ ${name.padEnd(8)} 渲染 ${String(len).padStart(6)} 字符，无异常痕迹`);
        }
    } catch (err) {
        failed++;
        console.log(`❌ ${name.padEnd(8)} 渲染失败：${err && err.message ? err.message : err}`);
        if (err && err.stack) warnings.push(`${name}: ${err.stack.split('\n').slice(0, 4).join('\n')}`);
    }
}

await server.close();
console.log(`\n结果：${ROUTES.length - failed}/${ROUTES.length} 个页面渲染通过`);
if (warnings.length) {
    console.log('\n失败堆栈：');
    for (const w of warnings) console.log('---\n' + w);
}
process.exit(failed ? 1 : 0);
