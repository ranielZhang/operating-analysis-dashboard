# 经营分析看板 · Operating Analysis Dashboard

**一句话定位**：面向**游戏公司管理层与财务**的经营分析看板——用「投资额 + 预估回收曲线」算出**经营利润**，与银行流水口径的**账面利润**并列对照，回答「公司这段时间做的生意最终赚不赚钱」，并用两套正交的钻取轴（组织轴 / 业务轴）定位到具体中心、部门、投手、平台、项目、游戏。

---

## 快速开始

```bash
cd operating-analysis-dashboard
npm install
npm run dev
```

打开 <http://localhost:5180/>

> 端口 5180 在 `vite.config.ts` 中已用 `strictPort: true` 固定，不要改端口。
> 其他脚本：`npm run build`（打包）、`npm run preview`（预览打包产物）、`npm run typecheck`（`vue-tsc` 类型检查）。

---

## 页面清单

左侧菜单 6 个页面，每个页面回答一个明确的问题：

| # | 路由 | 页面 | 回答什么问题 | 主要模块 |
|---|---|---|---|---|
| 1 | `/overview` | 经营总览 | **本期经营结果如何？两个利润口径差在哪？谁在赚钱、谁在亏钱？** | M1 全局筛选、经营结论 + M2 核心指标卡 + 月度经营利润趋势、游戏/投手经营利润排名（以上默认展开）；M3 双口径趋势、口径差额桥接、M4 组织贡献、M5 收入结构、M6 成本结构收在「更多分析」内 |
| 2 | `/drilldown` | 逐层下钻 | **赚钱的能力具体在哪一层、哪个人、哪个游戏上？** | M7 树形下钻表、下钻详情侧栏 |
| 4 | `/revenue` | 收入分析 | **收入从哪来？流量主 / 广告金 / 分成三块各占多少、趋势如何？** | M5 深化：三科目趋势、平台分布、游戏 TopN |
| 5 | `/cost` | 成本分析 | **钱花到哪去了？投放、预付、人工、管理各占多少？分摊到了谁身上？** | M6 深化：成本四科目结构树、趋势、分摊明细 |
| 6 | `/pitcher` | 投手人效 | **哪个投手最能赚钱？人效比（经营利润 / 人力成本）谁高谁低？** | M10 人效榜、排名、单人人效比与消耗/收入结构 |
| 7 | `/settings` | 预估参数配置 | **预估逻辑长什么样？回收曲线参数（curveA / curveB）怎么配？** | M12 分游戏曲线参数、曲线对照图、成本分摊规则、算法公式说明 |

## 目录结构

```
operating-analysis-dashboard/
├── docs/                        文档（先看这个）
│   ├── 01-需求梳理与模块规划.md     需求背景、模块清单、双轴下钻模型
│   ├── 02-模块开发契约.md           数据引擎 API 与口径契约（开发必读）
│   ├── 03-数据源与取数方案.md       面向数据开发：数据源、口径表、物理表设计、校验规则
│   └── 04-预估算法说明.md           面向业务与财务：回收曲线、卷积、三层预估、模型局限
├── src/
│   ├── domain/                  【数据引擎】唯一数据真源，页面只读
│   │   ├── types.ts              领域模型（Metrics / MetricRow / ForecastPoint / CohortPoint / AlertItem…）
│   │   ├── dimensions.ts         组织树、平台、项目、游戏、投放组合、成本参数常量
│   │   └── store.ts              日粒度事实生成 + 双轴聚合 + 预估 + Cohort + 预警
│   ├── components/              【公共组件】EChart / MetricCard / PanelCard / PanelEmptyState / AnalysisFilterBar
│   ├── composables/
│   │   └── useAnalysisFilter.ts  全局筛选条件（响应式，所有页面共享）
│   ├── pages/                   【页面】overview / drilldown / forecast / revenue / cost / pitcher / settings
│   ├── styles/                  theme.scss（设计令牌）+ main.scss
│   ├── utils/format.ts          统一数值格式化与涨跌色
│   ├── App.vue / main.ts        壳与路由（Hash 路由）
└── vite.config.ts               端口 5180 + `@` → `/src` 别名
```

---

## 核心口径速查

> 全部来自 `src/domain/store.ts` 文件头的口径注释与 `buildMetrics()`。金额单位均为**元**。

```text
账面利润   bookProfit      = 已到账收入 − 充值支出 − 人工成本 − 管理费用        （银行流水口径）
经营利润   operatingProfit = 应计确认收入 − 投放消耗 − 人工成本 − 管理费用      （权责发生制 + 预估回收）
口径差额   profitGap       = operatingProfit − bookProfit                        （核心信号：正在回收路上的钱）
累计预估ROI forecastRoi    = 累计预估总回收 / 累计投放消耗       （倍，1.0 = 回本；窗口取 filter.roiWindow）
累计实际ROI actualRoi      = 累计已确认回收 / 累计投放消耗       （倍）
累计回收完成度 recoveryRate = 累计已确认回收 / 累计预估总回收     （小数；< 0.6 触发预警）
人效比     efficiencyRatio = 经营利润 / 人工成本                （倍；< 1 触发预警）
现金缺口   cashGap         = 预付余额 + 应收未收 = max(0,Σ充值−Σ消耗) + max(0,累计预估总回收−累计已确认回收)
```

⚠️ **口径提醒（全站统一，必读）**：`累计预估ROI` / `累计实际ROI` / `累计回收完成度` 三项是**自数据起点（2024-01）累计口径**，实现上取「筛选区间末月」的 `cum*` 字段，**不随筛选期间变化**。UI 文案中一律带「累计」二字；**按单月筛选时，这三个数描述的仍是该范围内存量盘子的累计表现，不是当月新投的钱的表现**（实测：单月 `2026-06` 与 12 个月期间的三个值完全相同）。详见 `docs/04` §7.5。

其他常用：

```text
应计确认收入 accrualRevenue = Σ_d spend(d) · f(t − d)      f(k) = ROI(k) − ROI(k−1)
回收曲线     ROI(n)         = curveA · ln(n) + curveB     curveB = 首日回收率 ROI(1)
收入三科目   流量主 = 应计收入 × iaaShare × liuliangzhuShare ｜ 广告金 = 应计收入 × iaaShare × (1 − liuliangzhuShare) ｜ 分成 = 应计收入 × (1 − iaaShare)
成本四科目   投放消耗 ｜ 预付充值 ｜ 人工（工资+医社保+个税+项目奖金）｜ 管理费用（福利费+办公费）
```

---

## 数据说明（重要）

| 项 | 说明 |
|---|---|
| **当前数据形态** | **纯前端确定性 Mock 数据，没有任何后端接口**。所有数字由 `src/domain/store.ts` 用确定性伪随机（`mulberry32` / `hash01`）+ 业务公式生成，**刷新页面结果完全一致**，便于演示与评审 |
| 数据范围 | `2024-01-01 ~ 2026-06`（`DATA_START` → `MAX_MONTH`），共 900 个自然日、30 个月 |
| **当月数据截至** | **`2026-06-18`**（`TODAY`），当月已过 **18 天 / 共 30 天**。因此：① 当月业务数据是「不完整月」；② **固定成本（人工 / 办公费）在含当月的区间里按 18/30 = 60% 摊薄**，而「当月全月预估」用整月值——两个口径都能在引擎里取到，不要混用 |
| 默认筛选 | `2025-07 ~ 2026-06`、按月、经营口径、预估窗口 360 天 |
| 演示数据规模 | 4 个中心 / 9 个部门 / 17 个小组 / 79 人（其中真投手 19 人）/ 4 个平台 / 6 个项目 / 16 个游戏 / 84 个投放组合 |
| 关键实测值（默认筛选，万元） | 应计收入 21312.8 ｜ 投放消耗 15149.5 ｜ 人工成本 3461.5 ｜ 管理费用 394.0 ｜ **经营利润 2307.8** ｜ **账面利润 −168.4** ｜ 口径差额 2476.2 ｜ 现金缺口 8180.0 |
| **替换为真实接口时** | **只需改 `src/domain/store.ts` 的取数层**（`MONTHS` / `SERIES` / `CAMPAIGN_MONTH` / `ORG_OWN_COST` 的构建部分），保持 `StoreApi` 的查询方法（`queryRows` / `metricsOf` / `querySeries` / `queryMonthSeries` / `alerts` / `forecast` / `cohorts` / `project`）与 `Metrics` 字段签名不变，7 个页面**零改动**。接口与物理表的对应关系见 `docs/03` §5 |

### 数据引擎能直接回答的 8 个问题

```ts
store.queryRows(filter, groupBy, parentId?)  // 维度行（表格 / 柱图）：组织轴与业务轴
store.metricsOf(filter, groupBy, key)        // 单节点指标
store.querySeries(filter) / queryMonthSeries(filter)   // 时间序列（年 / 季 / 月）
store.alerts(filter)                          // 规则引擎预警
store.forecast(filter, horizon = 6)           // 月度滚动预估：实际月 + 当月 + 未来 6 个月（实测 18 条）
store.cohorts(filter, count = 8)              // Cohort 回收曲线（每 30 天一个点）
  horizon, spendScale, curveAScale, curveBScale, laborScale, platformIds, gameIds
})
```


## 配色约定说明（全站统一）

本项目统一采用「**绿 = 正向 / 盈利，红 = 负向 / 亏损**」：

| 语义 | 颜色 | 令牌 |
|---|---|---|
| 正向 / 盈利 / 达标 | 绿 `#12b566` | `--oa-success`、`.oa-up` |
| 负向 / 亏损 / 风险 | 红 `#fd6464` | `--oa-danger`、`.oa-down` |
| 预警 / 关注 / 口径差额 | 橙 `#ff9140` | `--oa-warning`、**`--oa-gap-color`** |
| 账面利润（固定色） | 蓝 `#4d94fa` | `--oa-book` |
| 经营利润（固定色） | 绿 `#12b566` | `--oa-operating` |

**为什么需要专门说明**：团队既有系统里同时存在两套互相矛盾的旧约定——一套是金融行情式的「**红涨绿跌**」，一套是通用报表式的「**绿好红坏**」。两套混用会导致同一个红色在不同页面表示相反含义，是最容易造成误读的视觉缺陷。

**本看板的取舍**：本看板是**决策与预警导向**的——红灯必须表示风险。因此全站统一为「绿 = 正向」，并把它固化为 `--oa-*` 设计令牌与 `.oa-up` / `.oa-down` 工具类，避免各页面各自解释。利润类数值单元格统一使用 `trendClass(value)` 上色，保证跨页面语义一致。

**令牌命名注意（含 EChart 解析规则）**：

- 口径差额橙的令牌是 **`--oa-gap-color`**（不是 `--oa-gap`）。原因：`--oa-gap` 在 `theme.scss` 中同时被定义为「口径差额色 `#ff9140`」和「栅格间距 `12px`」两个不同语义的值（同名两次定义）。为避免歧义，已新增 `--oa-gap-color: #ff9140` 作为颜色别名。
- **图表 option 内可以直接写 `var(--oa-xxx)`**：`EChart.vue` 会按 CSS 变量解析 option 里的 `var(--oa-*)`；若解析出的值不是合法颜色，会自动回退到 **`<name>-color`** 别名（例如 `var(--oa-gap)` 解析失败 → 用 `var(--oa-gap-color)`）。
- **写新代码时**：颜色统一用 `--oa-gap-color` 这类**无歧义命名**；间距用 `var(--oa-gap)`。

---

## 开源协议

本项目基于 [MIT License](LICENSE) 开源，可自由使用、修改、分发与商用，保留版权声明即可。
第三方依赖各自的协议：Vue / Element Plus / Vite（MIT）、ECharts（Apache-2.0）。

> **关于数据**：仓库内的公司名称（云舟互娱）、组织架构、人员、薪酬水平、投放与收入数据
> **全部是为演示构造的模拟数据**，与任何真实企业无关，也不含任何真实业务或个人信息。
> 数据由前端确定性伪随机生成（同一输入永远得到同一结果），不含后端与真实接口。

---

## 文档索引

| 文档 | 读者 | 内容 |
|---|---|---|
| `docs/01-需求梳理与模块规划.md` | 所有人 | 业务背景、两个利润口径、数据源盘点、模块清单（M1~M12）、双轴下钻模型、成本分摊规则 |
| `docs/02-模块开发契约.md` | 开发者 | 数据引擎 API、`Metrics` 字段全表、格式化工具、设计令牌、图表/表格规范 |
| `docs/03-数据源与取数方案.md` | 数据开发 / 后端 | 数据源全景（含「哪些没有真实数据源」的如实结论）、指标口径定义表、两条聚合轴、7 张物理表设计、取数链路图、17 条数据质量校验规则 |
| `docs/04-预估算法说明.md` | 业务 / 财务 / 算法 | 为什么必须预估、回收曲线推导与两点标定、卷积算法、权责发生制确认、三层滚动预估、Cohort 分析、MAPE 回测、**模型已知局限**、9 条待确认口径清单 |
