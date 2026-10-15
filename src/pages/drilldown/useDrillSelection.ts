import { reactive } from 'vue';
import type { DimKey } from '@/domain/types';

/**
 * 逐层下钻页的共享选中状态（跨组件通信）
 * 树表 / 详情侧栏 / 交叉矩阵 都读写这一份状态。
 */
export const drillSelection = reactive({
    /** 当前选中的维度层级 */
    dim: 'company' as DimKey,
    /** 当前选中的节点 id */
    key: 'company',
    /** 展示名 */
    name: '全公司',
});

/** 下钻轴：组织轴（中心→部门→小组→投手） / 业务轴（平台→项目→游戏） */
export const drillAxis = reactive({
    value: 'org' as 'org' | 'biz',
});

/** 组织轴 / 业务轴各自的层级顺序 */
export const AXIS_LEVELS: Record<'org' | 'biz', Array<{ dim: DimKey; label: string }>> = {
    org: [
        { dim: 'company', label: '公司' },
        { dim: 'center', label: '中心' },
        { dim: 'department', label: '部门' },
        { dim: 'group', label: '小组' },
        { dim: 'pitcher', label: '投手' },
    ],
    biz: [
        { dim: 'company', label: '公司' },
        { dim: 'businessType', label: '业务类型' },
        { dim: 'platform', label: '平台' },
        { dim: 'project', label: '项目' },
        { dim: 'game', label: '游戏' },
    ],
};

export function selectNode(dim: DimKey, key: string, name: string) {
    drillSelection.dim = dim;
    drillSelection.key = key;
    drillSelection.name = name;
}

export function selectCompany() {
    selectNode('company', 'company', '全公司');
}
