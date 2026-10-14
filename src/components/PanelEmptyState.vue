<template>
    <div class="empty">
        <div class="empty__icon">◍</div>
        <p class="empty__text">{{ text }}</p>
    </div>
</template>

<script setup lang="ts">
    /** 统一空态占位 */
    defineOptions({ name: 'PanelEmptyState' });
    withDefaults(defineProps<{ text?: string }>(), { text: '暂无数据' });
</script>

<style scoped lang="scss">
    .empty {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 8px;
        height: 100%;
        min-height: 120px;
        color: var(--oa-text-4);
    }

    .empty__icon {
        font-size: 26px;
        opacity: 0.5;
    }

    .empty__text {
        margin: 0;
        font-size: var(--oa-fs-xs);
    }
</style>
