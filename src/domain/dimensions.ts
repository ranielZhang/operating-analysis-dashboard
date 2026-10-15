import type { BusinessType, CampaignMeta, GameMeta, OrgNode, PlatformMeta, ProjectMeta } from './types';

// ============================================================
// 确定性伪随机（保证每次刷新数据一致，便于演示与评审）
// ============================================================
export function mulberry32(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** 全局演示时间基准 */
export const TODAY = '2026-06-18';
export const DATA_START = '2024-01-01';
/** 可分析的最早月份 / 最晚月份 */
export const MIN_MONTH = '2024-01';
export const MAX_MONTH = '2026-06';

// ============================================================
// 一、组织树：公司 → 中心 → 部门 → 小组 → 个人
// ============================================================
const SURNAMES = '赵钱孙李周吴郑王冯陈褚卫蒋沈韩杨朱秦尤许何吕施张孔曹严华金魏陶姜'.split('');
const GIVEN = [
    '伟',
    '芳',
    '娜',
    '敏',
    '静',
    '磊',
    '洋',
    '强',
    '军',
    '杰',
    '涛',
    '明',
    '超',
    '霞',
    '平',
    '刚',
    '桂英',
    '文',
    '辉',
    '鑫',
    '晨',
    '宇',
    '浩',
    '雪',
    '琳',
    '睿',
    '翔',
    '斌',
    '露',
    '哲',
    '帆',
    '萌',
];

interface GroupSpec {
    name: string;
    size: number;
    /** 该小组是否为投放投手 */
    pitcher?: boolean;
    /** 是否在 2024-01 之后才组建（YYYY-MM） */
    joinMonth?: string;
}

interface DeptSpec {
    name: string;
    groups: GroupSpec[];
}

interface CenterSpec {
    name: string;
    depts: DeptSpec[];
}

const ORG_SPEC: CenterSpec[] = [
    {
        name: '研发中心',
        depts: [
            {
                name: '研发一部',
                groups: [
                    { name: '客户端组', size: 6 },
                    { name: '服务端组', size: 5 },
                ],
            },
            {
                name: '研发二部',
                groups: [
                    { name: '策划组', size: 4 },
                    { name: '美术组', size: 6 },
                ],
            },
        ],
    },
    {
        name: '发行中心',
        depts: [
            {
                name: '投放部',
                groups: [
                    { name: '投放一组', size: 7, pitcher: true },
                    { name: '投放二组', size: 6, pitcher: true },
                    { name: '投放三组', size: 6, pitcher: true, joinMonth: '2025-01' },
                ],
            },
            {
                name: '运营部',
                groups: [
                    { name: '活动运营组', size: 4 },
                    { name: '社群运营组', size: 3 },
                ],
            },
            {
                name: '素材部',
                groups: [
                    { name: '视频素材组', size: 8 },
                    { name: '平面素材组', size: 5 },
                ],
            },
        ],
    },
    {
        name: '中台',
        depts: [
            {
                name: '数据中台',
                groups: [
                    { name: '数据开发组', size: 4 },
                    { name: '算法组', size: 3 },
                ],
            },
            {
                name: '技术中台',
                groups: [{ name: '平台研发组', size: 4 }],
            },
        ],
    },
    {
        name: '职能中心',
        depts: [
            {
                name: '人力行政部',
                groups: [
                    { name: '招聘组', size: 3 },
                    { name: '行政组', size: 2 },
                ],
            },
            {
                name: '财务部',
                groups: [{ name: '财务核算组', size: 3 }],
            },
        ],
    },
];

function buildOrg(): OrgNode[] {
    const rand = mulberry32(20260630);
    const nodes: OrgNode[] = [];
    const usedNames = new Set<string>();

    const company: OrgNode = {
        id: 'company',
        name: '云舟互娱',
        level: 'company',
        parentId: null,
        owner: '总经理',
        headcount: 0,
        isPitcher: false,
        joinMonth: '2020-01',
    };
    nodes.push(company);

    let nameIdx = 0;
    const pickName = (): string => {
        for (let i = 0; i < 500; i++) {
            const s = SURNAMES[nameIdx % SURNAMES.length];
            const g = GIVEN[Math.floor(rand() * GIVEN.length)];
            nameIdx++;
            const full = s + g;
            if (!usedNames.has(full)) {
                usedNames.add(full);
                return full;
            }
        }
        return `员工${usedNames.size + 1}`;
    };

    ORG_SPEC.forEach((c, ci) => {
        const centerId = `c${ci + 1}`;
        const center: OrgNode = {
            id: centerId,
            name: c.name,
            level: 'center',
            parentId: 'company',
            owner: pickName(),
            headcount: 0,
            isPitcher: false,
            joinMonth: '2020-01',
        };
        nodes.push(center);

        c.depts.forEach((d, di) => {
            const deptId = `${centerId}d${di + 1}`;
            const dept: OrgNode = {
                id: deptId,
                name: d.name,
                level: 'department',
                parentId: centerId,
                owner: pickName(),
                headcount: 0,
                isPitcher: false,
                joinMonth: '2020-06',
            };
            nodes.push(dept);

            d.groups.forEach((g, gi) => {
                const groupId = `${deptId}g${gi + 1}`;
                const group: OrgNode = {
                    id: groupId,
                    name: g.name,
                    level: 'group',
                    parentId: deptId,
                    owner: pickName(),
                    headcount: 0,
                    isPitcher: false,
                    joinMonth: g.joinMonth ?? '2021-01',
                };
                nodes.push(group);

                for (let p = 0; p < g.size; p++) {
                    nodes.push({
                        id: `${groupId}p${p + 1}`,
                        name: pickName(),
                        level: 'pitcher',
                        parentId: groupId,
                        owner: '',
                        headcount: 1,
                        isPitcher: Boolean(g.pitcher),
                        joinMonth: g.joinMonth ?? (p === 0 ? '2021-01' : '2022-03'),
                    });
                }
            });
        });
    });

    // 回填 headcount
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (n.headcount === 0 && n.level !== 'pitcher') {
            n.headcount = nodes.filter((x) => x.parentId === n.id).reduce((s, x) => s + x.headcount, 0);
        }
        if (n.level === 'pitcher') n.owner = n.name;
    }
    return nodes;
}

export const ORG_NODES: OrgNode[] = buildOrg();
export const ORG_MAP: Map<string, OrgNode> = new Map(ORG_NODES.map((n) => [n.id, n]));

/** 取某节点及其所有后代 id */
export function descendantsOf(id: string, nodes: OrgNode[] = ORG_NODES): string[] {
    const out: string[] = [id];
    const stack = [id];
    const byParent = new Map<string, OrgNode[]>();
    for (const n of nodes) {
        if (!n.parentId) continue;
        const arr = byParent.get(n.parentId) ?? [];
        arr.push(n);
        byParent.set(n.parentId, arr);
    }
    while (stack.length) {
        const cur = stack.pop() as string;
        for (const child of byParent.get(cur) ?? []) {
            out.push(child.id);
            stack.push(child.id);
        }
    }
    return out;
}

export function orgChildren(id: string): OrgNode[] {
    return ORG_NODES.filter((n) => n.parentId === id);
}

export function orgPath(id: string): OrgNode[] {
    const out: OrgNode[] = [];
    let cur = ORG_MAP.get(id);
    while (cur) {
        out.unshift(cur);
        cur = cur.parentId ? ORG_MAP.get(cur.parentId) : undefined;
    }
    return out;
}

export const CENTERS = ORG_NODES.filter((n) => n.level === 'center');
export const DEPARTMENTS = ORG_NODES.filter((n) => n.level === 'department');
export const GROUPS = ORG_NODES.filter((n) => n.level === 'group');
export const PITCHERS = ORG_NODES.filter((n) => n.level === 'pitcher' && n.isPitcher);
export const ALL_PEOPLE = ORG_NODES.filter((n) => n.level === 'pitcher');

// ============================================================
// 二、业务维度：平台 → 项目 → 游戏
// ============================================================
export const PLATFORMS: PlatformMeta[] = [
    { id: 'pf1', name: '腾讯广告', color: '#4d94fa', settleLagDays: 45, rebateRate: 0.06 },
    { id: 'pf2', name: '巨量引擎', color: '#8b5cf6', settleLagDays: 30, rebateRate: 0.05 },
    { id: 'pf3', name: '快手磁力', color: '#ff9140', settleLagDays: 30, rebateRate: 0.04 },
    { id: 'pf4', name: '小米营销', color: '#06b6d4', settleLagDays: 60, rebateRate: 0.03 },
];
export const PLATFORM_MAP = new Map(PLATFORMS.map((p) => [p.id, p]));

export const PROJECTS: ProjectMeta[] = [
    { id: 'pj1', name: '卡牌项目', centerId: 'c2', platformIds: ['pf1', 'pf2'] },
    { id: 'pj2', name: '消除项目', centerId: 'c2', platformIds: ['pf1', 'pf2', 'pf3'] },
    { id: 'pj3', name: '传奇项目', centerId: 'c2', platformIds: ['pf1', 'pf4'] },
    { id: 'pj4', name: '模拟经营项目', centerId: 'c2', platformIds: ['pf2', 'pf3'] },
    { id: 'pj5', name: '塔防项目', centerId: 'c2', platformIds: ['pf1', 'pf3'] },
    { id: 'pj6', name: '休闲竞技项目', centerId: 'c2', platformIds: ['pf2', 'pf4'] },
];
export const PROJECT_MAP = new Map(PROJECTS.map((p) => [p.id, p]));

interface GameSpec {
    id: string;
    name: string;
    projectId: string;
    monetize: 'iaa' | 'iap' | 'mix';
    iaaShare: number;
    liuliangzhuShare: number;
    curveA: number;
    curveB: number;
    paybackDays: number;
    redLineRoi: number;
    onlineMonth: string;
    stage: GameMeta['stage'];
    keyGame: boolean;
}

const GAME_SPEC: GameSpec[] = [
    // 卡牌项目
    { id: 'g1', name: '神域卡牌', projectId: 'pj1', monetize: 'mix', iaaShare: 0.45, liuliangzhuShare: 0.62, curveA: 0.21, curveB: 0.17, paybackDays: 120, redLineRoi: 1.15, onlineMonth: '2024-02', stage: '成熟期', keyGame: true },
    { id: 'g2', name: '幻境卡牌', projectId: 'pj1', monetize: 'iap', iaaShare: 0.18, liuliangzhuShare: 0.7, curveA: 0.19, curveB: 0.12, paybackDays: 150, redLineRoi: 1.12, onlineMonth: '2024-09', stage: '成长期', keyGame: true },
    { id: 'g3', name: '星海卡牌', projectId: 'pj1', monetize: 'mix', iaaShare: 0.5, liuliangzhuShare: 0.58, curveA: 0.15, curveB: 0.09, paybackDays: 160, redLineRoi: 1.1, onlineMonth: '2025-08', stage: '测试期', keyGame: false },
    // 消除项目
    { id: 'g4', name: '糖果消消乐', projectId: 'pj2', monetize: 'iaa', iaaShare: 0.92, liuliangzhuShare: 0.72, curveA: 0.25, curveB: 0.22, paybackDays: 90, redLineRoi: 1.2, onlineMonth: '2024-01', stage: '成熟期', keyGame: true },
    { id: 'g5', name: '花园消消乐', projectId: 'pj2', monetize: 'iaa', iaaShare: 0.95, liuliangzhuShare: 0.68, curveA: 0.22, curveB: 0.19, paybackDays: 100, redLineRoi: 1.18, onlineMonth: '2024-06', stage: '成熟期', keyGame: false },
    { id: 'g6', name: '宝石消消乐', projectId: 'pj2', monetize: 'iaa', iaaShare: 0.9, liuliangzhuShare: 0.75, curveA: 0.17, curveB: 0.13, paybackDays: 130, redLineRoi: 1.15, onlineMonth: '2025-03', stage: '成长期', keyGame: false },
    // 传奇项目
    { id: 'g7', name: '热血传奇', projectId: 'pj3', monetize: 'iap', iaaShare: 0.1, liuliangzhuShare: 0.8, curveA: 0.27, curveB: 0.24, paybackDays: 75, redLineRoi: 1.25, onlineMonth: '2024-03', stage: '成熟期', keyGame: true },
    { id: 'g8', name: '复古传奇', projectId: 'pj3', monetize: 'iap', iaaShare: 0.12, liuliangzhuShare: 0.78, curveA: 0.2, curveB: 0.15, paybackDays: 110, redLineRoi: 1.2, onlineMonth: '2025-01', stage: '成长期', keyGame: false },
    // 模拟经营
    { id: 'g9', name: '我的小镇', projectId: 'pj4', monetize: 'iaa', iaaShare: 0.88, liuliangzhuShare: 0.66, curveA: 0.18, curveB: 0.14, paybackDays: 120, redLineRoi: 1.15, onlineMonth: '2024-05', stage: '成熟期', keyGame: false },
    { id: 'g10', name: '梦想餐厅', projectId: 'pj4', monetize: 'mix', iaaShare: 0.62, liuliangzhuShare: 0.6, curveA: 0.16, curveB: 0.11, paybackDays: 140, redLineRoi: 1.12, onlineMonth: '2025-02', stage: '成长期', keyGame: false },
    { id: 'g11', name: '乡村生活', projectId: 'pj4', monetize: 'iaa', iaaShare: 0.9, liuliangzhuShare: 0.7, curveA: 0.12, curveB: 0.06, paybackDays: 170, redLineRoi: 1.1, onlineMonth: '2025-10', stage: '测试期', keyGame: false },
    // 塔防
    { id: 'g12', name: '守护塔防', projectId: 'pj5', monetize: 'mix', iaaShare: 0.55, liuliangzhuShare: 0.64, curveA: 0.19, curveB: 0.14, paybackDays: 125, redLineRoi: 1.15, onlineMonth: '2024-08', stage: '成熟期', keyGame: false },
    { id: 'g13', name: '无尽塔防', projectId: 'pj5', monetize: 'iaa', iaaShare: 0.86, liuliangzhuShare: 0.69, curveA: 0.14, curveB: 0.09, paybackDays: 155, redLineRoi: 1.12, onlineMonth: '2025-06', stage: '成长期', keyGame: false },
    // 休闲竞技
    { id: 'g14', name: '疯狂射箭', projectId: 'pj6', monetize: 'iaa', iaaShare: 0.93, liuliangzhuShare: 0.74, curveA: 0.23, curveB: 0.2, paybackDays: 95, redLineRoi: 1.2, onlineMonth: '2024-07', stage: '成熟期', keyGame: true },
    { id: 'g15', name: '跳跳大冒险', projectId: 'pj6', monetize: 'iaa', iaaShare: 0.91, liuliangzhuShare: 0.71, curveA: 0.16, curveB: 0.1, paybackDays: 145, redLineRoi: 1.13, onlineMonth: '2025-05', stage: '成长期', keyGame: false },
    { id: 'g16', name: '成语消消', projectId: 'pj6', monetize: 'iaa', iaaShare: 0.96, liuliangzhuShare: 0.76, curveA: 0.11, curveB: 0.05, paybackDays: 190, redLineRoi: 1.08, onlineMonth: '2026-01', stage: '测试期', keyGame: false },
];

export const GAMES: GameMeta[] = GAME_SPEC.map((g) => ({
    ...g,
    onlineMonth: g.onlineMonth,
}));
export const GAME_MAP = new Map(GAMES.map((g) => [g.id, g]));
export const PLATFORM_GAMES = (platformId: string): GameMeta[] =>
    GAMES.filter((g) => PROJECT_MAP.get(g.projectId)?.platformIds.includes(platformId));

export function gameChildren(projectId: string): GameMeta[] {
    return GAMES.filter((g) => g.projectId === projectId);
}

// ============================================================
// 三、投放组合（投手 × 平台 × 游戏）
// ============================================================
function buildCampaigns(): CampaignMeta[] {
    const rand = mulberry32(88664422);
    const list: CampaignMeta[] = [];
    const pitchers = PITCHERS.slice();

    // 每个「游戏 × 平台」分配 2~3 名投手，保证组织轴与业务轴都有数据
    GAMES.forEach((game) => {
        const proj = PROJECT_MAP.get(game.projectId);
        if (!proj) return;
        proj.platformIds.forEach((platformId) => {
            const n = 2 + Math.floor(rand() * 2);
            const used = new Set<string>();
            for (let i = 0; i < n; i++) {
                let pitcher = pitchers[Math.floor(rand() * pitchers.length)];
                let guard = 0;
                while (used.has(pitcher.id) && guard++ < 40) {
                    pitcher = pitchers[Math.floor(rand() * pitchers.length)];
                }
                if (used.has(pitcher.id)) continue;
                used.add(pitcher.id);
                list.push({
                    id: `cmp_${game.id}_${platformId}_${pitcher.id}`,
                    pitcherId: pitcher.id,
                    groupId: pitcher.parentId as string,
                    platformId,
                    projectId: game.projectId,
                    gameId: game.id,
                    startMonth: game.onlineMonth,
                    endMonth: game.stage === '衰退期' ? '2025-12' : null,
                    intensity: 0.6 + rand() * 1.1,
                });
            }
        });
    });
    return list;
}

export const CAMPAIGNS: CampaignMeta[] = buildCampaigns();
export const CAMPAIGN_MAP = new Map(CAMPAIGNS.map((c) => [c.id, c]));

// ============================================================
// 四、成本参数（管理数据口径）
// ============================================================
/** 各中心人均月薪（元） */
export const CENTER_SALARY: Record<string, number> = {
    c1: 26000, // 研发中心
    c2: 18000, // 发行中心
    c3: 24000, // 中台
    c4: 14000, // 职能中心
};
/** 医社保公司承担比例 */
export const SOCIAL_INSURANCE_RATE = 0.28;
/** 个税占薪资比例（公司代缴现金流口径） */
export const TAX_RATE = 0.06;
/** 管理费用：福利费占人工成本比例 */
export const WELFARE_RATE = 0.045;
/** 管理费用：办公费 = 人头 × 该值（元/人/月） */
export const OFFICE_COST_PER_HEAD = 2600;

// ============================================================
// 五、三类业务演示口径（固定数，不随实际利润浮动）
// ============================================================

/** 自研流水 = 应确认收入 × 该系数，故意不等于 1 */
export const FLOW_GROSS_FACTOR: Record<GameMeta['monetize'], number> = {
    iaa: 1.35,
    iap: 1.22,
    mix: 1.28,
};

/** 每个游戏在全部历史月份上的其他直接成本（元），按选中月数占数据月数分摊 */
export const OTHER_DIRECT_PER_GAME = 2_400_000;

/** 公司可动用现金（元），只挂在公司节点 */
export const AVAILABLE_CASH = 86_000_000;

/** 每月经营利润预算（元）。三类相加等于公司。 */
export const MONTHLY_BUDGET_PROFIT: Record<BusinessType, number> = {
    self_op: 1_600_000,
    sale: 400_000,
    external: 200_000,
};

export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
    self_op: '自研运营',
    sale: '游戏出售',
    external: '外部发行投放',
};

export interface BusinessDeal {
    id: string;
    businessType: 'sale' | 'external';
    gameId: string;
    projectId: string;
    name: string;
    /** 出售为合同额，外部服务为客户预算 */
    contractOrBudget: number;
    /** 确认为收入的比例，小于 1 */
    recognizeRatio: number;
    /** 回款占确认收入的比例，小于 1 */
    collectRatio: number;
    /** 全部历史月份上的研发投入。外部服务为 0 */
    rdInvest: number;
    /** 全部历史月份上的其他直接成本 */
    otherDirect: number;
}

export const BUSINESS_DEALS: BusinessDeal[] = [
    {
        id: 'sale-g1',
        businessType: 'sale',
        gameId: 'g1',
        projectId: 'pj1',
        name: '神域卡牌出售',
        contractOrBudget: 18_000_000,
        recognizeRatio: 0.72,
        collectRatio: 0.64,
        rdInvest: 2_400_000,
        otherDirect: 360_000,
    },
    {
        id: 'sale-g4',
        businessType: 'sale',
        gameId: 'g4',
        projectId: 'pj2',
        name: '糖果消消乐出售',
        contractOrBudget: 9_600_000,
        recognizeRatio: 0.55,
        collectRatio: 0.8,
        rdInvest: 1_200_000,
        otherDirect: 180_000,
    },
    {
        id: 'sale-g7',
        businessType: 'sale',
        gameId: 'g7',
        projectId: 'pj3',
        name: '热血传奇授权',
        contractOrBudget: 15_000_000,
        recognizeRatio: 0.4,
        collectRatio: 0.5,
        rdInvest: 1_800_000,
        otherDirect: 240_000,
    },
    {
        id: 'sale-g12',
        businessType: 'sale',
        gameId: 'g12',
        projectId: 'pj5',
        name: '守护塔防出售',
        contractOrBudget: 3_000_000,
        recognizeRatio: 0.35,
        collectRatio: 0.7,
        rdInvest: 6_000_000,
        otherDirect: 200_000,
    },
    {
        id: 'ext-g2',
        businessType: 'external',
        gameId: 'g2',
        projectId: 'pj1',
        name: '幻境卡牌代投',
        contractOrBudget: 8_000_000,
        recognizeRatio: 0.25,
        collectRatio: 0.6,
        rdInvest: 0,
        otherDirect: 150_000,
    },
    {
        id: 'ext-g6',
        businessType: 'external',
        gameId: 'g6',
        projectId: 'pj2',
        name: '宝石消消乐代投',
        contractOrBudget: 5_000_000,
        recognizeRatio: 0.3,
        collectRatio: 0.45,
        rdInvest: 0,
        otherDirect: 90_000,
    },
    {
        id: 'ext-g10',
        businessType: 'external',
        gameId: 'g10',
        projectId: 'pj4',
        name: '梦想餐厅发行服务',
        contractOrBudget: 6_500_000,
        recognizeRatio: 0.2,
        collectRatio: 0.5,
        rdInvest: 0,
        otherDirect: 120_000,
    },
    {
        id: 'ext-g15',
        businessType: 'external',
        gameId: 'g15',
        projectId: 'pj6',
        name: '跳跳大冒险代投',
        contractOrBudget: 4_200_000,
        recognizeRatio: 0.22,
        collectRatio: 0.4,
        rdInvest: 0,
        otherDirect: 80_000,
    },
];
