import { createApp } from 'vue';
import { createRouter, createWebHashHistory, type RouteRecordRaw } from 'vue-router';
import ElementPlus from 'element-plus';
import zhCn from 'element-plus/es/locale/lang/zh-cn';
import 'element-plus/dist/index.css';

import './styles/main.scss';
import App from './App.vue';
import EChart from './components/EChart.vue';

import Overview from './pages/overview/index.vue';
import Drilldown from './pages/drilldown/index.vue';
import Revenue from './pages/revenue/index.vue';
import Cost from './pages/cost/index.vue';
import Pitcher from './pages/pitcher/index.vue';

const routes: RouteRecordRaw[] = [
    { path: '/', redirect: '/drilldown' },
    { path: '/overview', name: 'Overview', component: Overview, meta: { title: '经营总览' } },
    { path: '/drilldown', name: 'Drilldown', component: Drilldown, meta: { title: '经营数据看板' } },
    { path: '/revenue', name: 'Revenue', component: Revenue, meta: { title: '收入分析' } },
    { path: '/cost', name: 'Cost', component: Cost, meta: { title: '成本分析' } },
    { path: '/pitcher', name: 'Pitcher', component: Pitcher, meta: { title: '投手人效' } },
    { path: '/:pathMatch(.*)*', redirect: '/drilldown' },
];

const router = createRouter({ history: createWebHashHistory(), routes });

const app = createApp(App);
app.component('EChart', EChart);
app.config.errorHandler = (err, _i, info) => {
    console.error('[经营分析看板 未捕获错误]', info, err);
};
app.use(ElementPlus, { locale: zhCn }).use(router).mount('#app');
