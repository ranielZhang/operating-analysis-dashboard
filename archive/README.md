# 归档模块（不在看板里，代码保留）

这些模块功能完整、可运行，但**面向的是专业使用者，不是老板**，因此从看板里摘掉。

| 模块 | 原来在哪 | 为什么不给老板看 |
|---|---|---|
| `simulator/` | 经营推演模拟器页 `/simulator` | what-if 沙盒：要老板自己调预算、调回收曲线去看结果。老板不会调，也不需要调。 |
| `datasource/` | 数据源与质量页 `/datasource` | 是给数据/IT 团队看的数据源清单与完整度，跟经营决策无关。 |
| `CrossMatrix.vue` | 逐层下钻页底部「组织 × 平台交叉矩阵」 | 12~72 个格子的热力矩阵，「谁在哪个平台赚钱」是运营主管的问题，不是老板的问题。 |

## 想恢复怎么办

1. 把对应目录/文件移回 `src/pages/` 原位（`CrossMatrix.vue` 移回 `src/pages/drilldown/components/`）。
2. `src/main.ts` 里加回路由与 import（原代码见下），`src/App.vue` 菜单里加回条目。
3. `src/pages/drilldown/index.vue` 里加回 `<CrossMatrix />` 那一段。
4. `scripts/ssr-check.mjs` 与 `scripts/robustness-check.mjs` 的页面清单里加回。

原路由（已从 main.ts 删除）：
```ts
import Simulator from './pages/simulator/index.vue';
import DataSource from './pages/datasource/index.vue';
// ...
{ path: '/simulator',  name: 'Simulator',  component: Simulator,  meta: { title: '经营推演模拟器' } },
{ path: '/datasource', name: 'DataSource', component: DataSource, meta: { title: '经营数据源与质量' } },
```

## 追加归档（老板视角改版）

| 模块 | 原来在哪 | 为什么摘掉 |
|---|---|---|
| `KpiRow.vue` | 经营总览首屏的 13 张指标卡 | 已被 `src/pages/overview/components/OverviewHeadline.vue` 取代（收敛为 6 张卡 + 经营结论 + 月度趋势）。 |

同一轮改版还做了两件事（不是归档，是就地修改）：
1. 筛选栏去掉全局「利润口径」切换 —— 经营利润与账面利润不是二选一，而是必须同屏对照，已并排展示在总览页。
2. 左侧菜单按「结果 → 构成 → 主体 → 模型」重排，分组标题改为专业表述。

## 追加归档（首屏瘦身）

| 模块 | 原来在哪 | 为什么摘掉 |
|---|---|---|
| `AlertPanel.vue` | 经营总览第二屏「预警与洞察」 | 13 条高风险预警的卡片列表占掉近 1400px 纵向空间，把首屏撑得极长。风险信号已由首屏的「亏损游戏 9/16」指标卡与「游戏经营利润排名」承担；引擎侧 `store.alerts()` 仍然保留，需要时可原样挂回。 |

同一轮还把「月度经营利润」图表从 280px 压到 168px（收紧 grid 留白与字号），
避免图表类组件独占首屏。

## 追加归档（收敛为「数据看板」单页）

| 模块 | 原来在哪 | 为什么摘掉 |
|---|---|---|
| `forecast-page/index.vue` | 月度经营预估页 `/forecast` | 该页仅由三个组件堆成，这三个组件已作为「模拟预估」板块挂到 `/drilldown` 数据看板内，页面壳成为 100% 重复。**`src/pages/forecast/components/` 保留在原位**，仍被数据看板引用。 |

同一轮还做了：左菜单分组改为「经营结果 / 经营分析 / 收入与成本 / 模型与口径」；
`/drilldown` 页面名由「逐层下钻」改为「经营数据看板」（逐层下钻作为副标题保留）；侧栏宽度 216px → 184px。

### 恢复 /forecast 页面
把 `archive/forecast-page/index.vue` 移回 `src/pages/forecast/index.vue`，
在 `src/main.ts` 加回路由与 import，在 `src/App.vue` 菜单里加回条目，
并把 `scripts/*.mjs` 的页面清单补回 `['月度经营预估', '/src/pages/forecast/index.vue']`。
