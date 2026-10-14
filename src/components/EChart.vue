<template>
    <div ref="el" class="echart" />
</template>

<script setup lang="ts">
    import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
    import * as echarts from 'echarts';
    import type { EChartsOption } from 'echarts';

    /**
     * ECharts 轻封装：实例初始化 / option 响应式更新 / 容器尺寸自适应 / 卸载销毁
     *
     * ⚠️ 关键能力：**自动解析 CSS 变量**
     * Canvas 渲染不认 `var(--oa-xxx)`，zrender 对非法 fillStyle 会静默忽略 → 图表变黑/串色。
     * 这里在 setOption 之前把 option 里所有形如 `var(--x)` 的字符串替换成
     * `getComputedStyle(document.documentElement)` 解析出的真实值，
     * 因此全站图表可以直接写 `color: 'var(--oa-operating)'`，无需各页面自己转换。
     *
     * 用法：<EChart :option="computedOption" style="width/height" />
     */
    defineOptions({ name: 'EChart' });

    const props = defineProps<{
        /** ECharts option（传 computed 即随数据自动更新） */
        option: EChartsOption;
    }>();

    const el = ref<HTMLDivElement>();
    let chart: echarts.ECharts | null = null;
    let ro: ResizeObserver | null = null;

    /** 令牌缓存：主题令牌在运行期不变，解析一次即可 */
    const tokenCache = new Map<string, string>();

    function readToken(name: string): string {
        const hit = tokenCache.get(name);
        if (hit !== undefined) return hit;
        let value = '';
        if (typeof window !== 'undefined' && document.documentElement) {
            value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
        }
        tokenCache.set(name, value);
        return value;
    }

    /** 匹配 `var(--x)`，允许带 fallback：`var(--x, #fff)` */
    const VAR_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/;

    /** 是否是合法 CSS 颜色（用于识别「令牌被同名间距值覆盖」这类坑） */
    function isValidColor(v: string): boolean {
        if (!v) return false;
        if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
            return CSS.supports('color', v);
        }
        return /^(#|rgb|hsl|[a-z]+$)/i.test(v);
    }

    function resolveVarString(input: string): string {
        const m = VAR_RE.exec(input.trim());
        if (!m) return input;
        const name = m[1];
        const resolved = readToken(name);
        // 解析出来的值必须是合法颜色；否则尝试 `<name>-color` 别名
        // （theme.scss 里 --oa-gap 既是间距 12px 又是口径差额色，靠这个兜底拿到正确色值）
        if (isValidColor(resolved)) return resolved;
        const alias = readToken(`${name}-color`);
        if (isValidColor(alias)) return alias;
        if (resolved) return resolved;
        return m[2] ? m[2].trim() : input;
    }

    /**
     * 深度解析 option 中的 CSS 变量。
     * 只遍历普通对象与数组；函数（formatter 等）、类实例原样透传，避免破坏 ECharts 语义。
     */
    function resolveOption<T>(input: T): T {
        if (typeof input === 'string') {
            return (input.includes('var(--') ? resolveVarString(input) : input) as T;
        }
        if (Array.isArray(input)) {
            return input.map((item) => resolveOption(item)) as T;
        }
        if (input && typeof input === 'object') {
            const proto = Object.getPrototypeOf(input);
            // 仅处理纯对象（跳过 Date / RegExp / ECharts 内部实例等）
            if (proto === Object.prototype || proto === null) {
                const out: Record<string, unknown> = {};
                for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
                    out[k] = resolveOption(v);
                }
                return out as T;
            }
        }
        return input;
    }

    const resolvedOption = computed<EChartsOption>(() => resolveOption(props.option));

    onMounted(() => {
        if (!el.value) return;
        chart = echarts.init(el.value);
        chart.setOption(resolvedOption.value);
        ro = new ResizeObserver(() => chart?.resize());
        ro.observe(el.value);
    });

    watch(
        resolvedOption,
        (opt) => {
            chart?.setOption(opt, { notMerge: true });
        },
        { deep: true },
    );

    onBeforeUnmount(() => {
        ro?.disconnect();
        ro = null;
        chart?.dispose();
        chart = null;
    });
</script>

<style scoped>
    .echart {
        width: 100%;
        height: 100%;
    }
</style>
