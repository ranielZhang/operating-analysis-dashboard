<template>
    <section class="panel" :class="{ 'panel--plain': plain }">
        <header v-if="title || $slots.actions || $slots.title" class="panel__head">
            <div class="panel__title-wrap">
                <h3 v-if="title" class="panel__title">{{ title }}</h3>
                <slot name="title" />
                <span v-if="subtitle" class="panel__sub">{{ subtitle }}</span>
            </div>
            <div class="panel__actions">
                <slot name="actions" />
            </div>
        </header>
        <div class="panel__body" :class="bodyClass">
            <slot />
        </div>
    </section>
</template>

<script setup lang="ts">
    /** 统一面板容器：标题 + 副标题 + 右侧操作区 + 内容区 */
    defineOptions({ name: 'PanelCard' });

    withDefaults(
        defineProps<{
            title?: string;
            subtitle?: string;
            /** 去掉内容区内边距（表格/图表铺满时用） */
            plain?: boolean;
            bodyClass?: string;
        }>(),
        { title: '', subtitle: '', plain: false, bodyClass: '' },
    );
</script>

<style scoped lang="scss">
    .panel {
        display: flex;
        flex-direction: column;
        min-height: 0;
        background: var(--oa-card);
        border: 1px solid var(--oa-border);
        border-radius: var(--oa-radius);
        box-shadow: var(--oa-shadow);
    }

    .panel__head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        border-bottom: 1px solid var(--oa-border-light);
        flex: 0 0 auto;
    }

    .panel__title-wrap {
        display: flex;
        align-items: baseline;
        gap: 8px;
        min-width: 0;
    }

    .panel__title {
        position: relative;
        margin: 0;
        padding-left: 10px;
        font-size: var(--oa-fs-base);
        font-weight: 600;
        color: var(--oa-text-1);
        white-space: nowrap;

        &::before {
            content: '';
            position: absolute;
            left: 0;
            top: 50%;
            transform: translateY(-50%);
            width: 3px;
            height: 13px;
            border-radius: 2px;
            background: var(--oa-primary);
        }
    }

    .panel__sub {
        font-size: var(--oa-fs-xs);
        color: var(--oa-text-4);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .panel__actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex: 0 0 auto;
    }

    .panel__body {
        flex: 1 1 auto;
        min-height: 0;
        padding: 14px;
    }

    .panel--plain .panel__body {
        padding: 0;
    }
</style>
