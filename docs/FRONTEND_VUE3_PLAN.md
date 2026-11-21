# 前端 Vue 3 重构计划

> 状态：计划已确认，待执行（P0）
> 范围：`frontend/`（纯静态 Vanilla JS 单页）→ Vue 3 + TypeScript + Vite 多路由应用
> 关联：`backend/server/route.go`（静态托管 / SPA fallback）、`backend/main.go`（frontendDir）

## 0. 已确认的决策

| 决策项 | 结论 |
|---|---|
| 语言 | **TypeScript**。`src/domain`、`src/api`、`src/stores` 强制类型；MapLibre / Canvas 海报等重移植代码允许先弱类型（`any` 收敛为局部类型），后续逐步收紧 |
| 视觉风格 | **允许调整**，不要求与旧版 100% 一致。保留编辑感/纸感配色语言，但导航与信息层级按三页结构重新组织 |
| 数据操作归属 | 「清空全部数据」「重载资料」挪到**录入页 · 数据工具**；主页只保留「刷新」 |
| 后端编辑/删除记录 | **本次不做**，`PUT/DELETE /api/records/:id` 延后（见 §9 待办） |
| 页面结构 | 主页 = 地图 + 时间线；录入、旅行档案各自独立成页 |
| 框架 | Vue 3 `<script setup>` + Vue Router 4 + Pinia + Vite；不引入 UI 组件库 |

## 1. 现状评估

### 1.1 现有前端

| 项 | 现状 | 重构含义 |
|---|---|---|
| 结构 | `frontend/index.html` 单页，`data-pane`（map / stats / ocr）+ `data-nav` 控制显隐；导航、筛选栏、时间线、明细共 6 个区块 | "拆页面"已有雏形，现在是 DOM `hidden` 切换，拆成路由成本低 |
| 逻辑 | `frontend/app.js` 4111 行单文件，`els.*` 全局 DOM 注册表 + 大量 `innerHTML` 拼串 | 必须改为「状态 → 模板」，不能整体照搬 |
| 样式 | `frontend/app.css` 1818 行，`--paper/--red/--rail/...` 设计令牌齐全 | 按令牌 + 布局 + 组件拆分为多个 CSS，令牌沿用 |
| 资源 | `data/*.js` 以 `window.*` 全局暴露（travel-log / china-map / world-map / water-china / poster-themes / rail-paths）+ 同名 `*.json` | 小配置转 ES 模块；大 GeoJSON 放 `public/data` 运行时按需 fetch |
| 依赖 | MapLibre 走 CDN `<script>` + SRI | 改为 npm 依赖 |
| 数据获取 | 后端 → localStorage 缓存 → 内置 `window.TRAVEL_LOG_DATA` 三级回退；`STORAGE_KEY = journeyatlas_records_v1` | 回退链保留，封装进 `api/client.ts` |
| 偏好 | `journeyatlas_map_skin`、`journeyatlas-metric-vis`、`journeyatlas_user_cities` 等 localStorage key | **key 名字不变**，避免用户丢皮肤 / 自定义城市缓存 |

### 1.2 现有后端接口

| 方法 | 路径 | 用途 | 本次是否改动 |
|---|---|---|---|
| GET | `/health` | 健康检查 | 否 |
| GET | `/api/records` | 全量记录，返回 `{records, metadata:{lastUpdated}}` | 否 |
| GET | `/api/users` | 用户列表（旅客下拉 / 筛选） | 否 |
| GET | `/api/records/user/:username` | 按旅客取记录 | 否 |
| POST | `/api/records` | 录入一条，返回 `{record}` | 否 |
| — | `NoRoute` FileServer | 静态托管 `../frontend` | **是**：加 SPA fallback + 缓存策略 |
| — | `main.go` `frontendDir` | 写死 `"../frontend"` | **是**：dev / release 分开 |

`model.TravelRecord` 字段（id / kind / startDate / endDate / title / origin / destination / transportNo / departTime / arriveTime / durationMinutes / amountCny / invoiceAmountCny / traveler / people / confidence / countsAsAway / countsAsVisited / showInTimeline / displayLayer / evidence / project / notes）已覆盖表单需求，本次不动模型。

## 2. 目标信息架构

| 路由 | 页面 | 内容 |
|---|---|---|
| `/` | **HomeView · 地图 + 时间线**（默认） | 地图舞台（播放 / 岁月 / 中国·世界切换 / 沉浸 / 行旅海报 / 街道海报 / 标题与皮肤 / 图例 / 指标条 / 播放浮标）+ 时间线列表 + 当前一段详情。共享筛选栏，右上角「刷新」 |
| `/record` | **RecordView · 录入** | 路线 / 票据 / 归属三段表单、地点联想输入、旅客下拉（懒加载 `/api/users`）、票据文本试填、**数据工具**（JSON/CSV 导入导出、清空全部数据、重载资料） |
| `/archive` | **ArchiveView · 旅行档案** | 5 个 Hero 指标 + 6 个榜单（城市停留 / 高频路线 / 国家 / 年度 / 出行方式 / 口径标签）+ 资料明细表 + 表内搜索高亮。共享筛选栏 |

要点：

1. **筛选条件（年 / 旅客 / 类型 / 证据）进 URL query**，如 `/archive?year=2024&traveler=self&kind=rail`。主页筛选后跳档案页口径一致、可收藏、可浏览器回退。
2. 导航从底部 deck 提到页头，三入口：`地图 · 时间线` / `录入` / `旅行档案`。
3. 主页与档案页共用 `FilterBar`（单组件、单 store，杜绝旧版靠同一组 `<select>` 才碰巧同步的问题）。
4. 详情面板（当前一段）留在主页；档案页的可点行跳回主页并高亮该段（`/?focus=<id>`）。

## 3. 技术选型

| 关注点 | 选择 | 理由 |
|---|---|---|
| 框架 | Vue 3 + `<script setup>` | 模板转义替代 `escapeHtml` 拼串；三页切换天然契合 |
| 构建 | Vite | 路由级懒加载分包、dev proxy `/api` → Gin |
| 类型 | TypeScript | 与 Go 后端字段对齐，`normalize()` 脏数据兜底有类型约束 |
| 路由 | Vue Router 4 | 3 条路由 + `ArchiveView` 懒加载 |
| 状态 | Pinia | `useRecordsStore` / `usePrefsStore` / `useToastStore` |
| 地图 | maplibre-gl（npm） | 去 CDN，版本可控、可离线自托管 |
| 单测 | Vitest（仅 `src/domain` + `src/api`） | 用旧版数字做快照，保证重构"只换壳不换数" |
| 代码规范 | ESLint + Prettier | 与 Go 侧 gofmt 对齐的提交规范 |
| UI 库 | 不引入 | 现有手写 CSS 是产品特征；重写视觉仍用自有组件层 |

## 4. 目录结构

```
frontend/                       # Vite 项目根（原 index.html/app.js/app.css 迁入 legacy/ 或分支留档）
├─ index.html                   # 仅 <div id="app"> + 字体预连接
├─ package.json  vite.config.ts  tsconfig.json  eslint.config.js
├─ public/data/                 # 运行时 fetch 的大资源
│   ├─ china-100000-full.json
│   ├─ world-110m.json
│   ├─ water-china.json
│   └─ rail-paths.json
└─ src/
   ├─ main.ts  App.vue
   ├─ router/index.ts
   ├─ styles/
   │   ├─ tokens.css            # --paper/--ink/--red/--rail/... 设计令牌
   │   ├─ base.css              # reset、字体、纸纹背景
   │   └─ layout.css            # 三页共享栅格
   ├─ layout/
   │   ├─ AppShell.vue          # 页头 + <RouterView/> + ToastHost
   │   ├─ AppNav.vue
   │   ├─ FilterBar.vue
   │   └─ ToastHost.vue
   ├─ domain/                   # 纯逻辑，零 Vue 依赖，可单测
   │   ├─ city.ts               # CITY / CITY_ALIAS / CITY_EN / stripShi / cityLngLat / cityMeta / continentOf
   │   ├─ photon.ts             # photonSearch / resolvePlace / rememberCity / loadUserCities
   │   ├─ geo.ts                # geoArc / greatCircleKm / fitToBounds / dataBounds
   │   ├─ normalize.ts          # normalize / parseOptionalNumber
   │   ├─ filters.ts            # filters / includesTraveler / filteredRecords
   │   ├─ chain.ts              # chainSortSegs / computeContinuityGaps
   │   ├─ stats.ts              # 指标条 + 档案榜（里程/国家/大洲/城市夜数/线路/年度/方式）
   │   ├─ csv.ts                # toCsv / parseCsv
   │   ├─ ticket.ts             # parseTicketText / extractTransportNo / inferKind ...
   │   ├─ theme.ts              # POSTER_THEMES / POSTER_PALETTES / applySkin
   │   └─ poster/travelPoster.ts# 行旅海报 Canvas 绘制
   ├─ api/client.ts             # fetchRecords / fetchUsers / createRecord + 三级回退 + 错误归一
   ├─ stores/{records,prefs,toast}.ts
   ├─ views/{HomeView,ArchiveView,RecordView}.vue
   └─ components/
       ├─ map/{MapCanvas,MapLegend,MapCaption,ViewToggle,PlaybackControls,MapSkinPicker,TitleEditor}.vue
       ├─ timeline/{TimelineList,TimelineItem,RecordDetail}.vue
       ├─ archive/{StatsHero,RankBoard,StatsSection,LedgerTable,LedgerSearch}.vue
       ├─ record/{RecordForm,PlaceInput,TravelerSelect,DataTools}.vue
       ├─ poster/TravelPosterModal.vue
       └─ common/{BaseSelect,ConfirmDialog,HelpDialog,AppIcon}.vue
```

## 5. 后端改动

### 5.1 SPA fallback（必须）

`backend/server/route.go` 的 `NoRoute` 改为：

1. 路径前缀 `/api/` 或 `/health` → `404 {"error":"not found"}`（JSON，别把 index.html 当接口响应）；
2. 静态文件存在 → 正常发送（`app.css`、`/assets/*`、`/data/*`）；
3. 其余（`/`、`/archive`、`/record`、`/?focus=x`）→ 回 `index.html`。

否则 `/archive`、`/record` 直接刷新或分享链接必 404。

### 5.2 托管目录与缓存

- `main.go`：`frontendDir` 由配置决定，dev 指向 Vite dev server 反代场景不使用；release 指向 `../frontend/dist`。清掉 `//todo:部署的时候修改为./dist`。
- 缓存头：`index.html` → `no-store`；`/assets/*`（Vite 带 hash）→ `public, max-age=31536000, immutable`；`/data/*.json` → 中等缓存（可协商 ETag）。
- 可选（后续）：`//go:embed dist` 单二进制部署；Gin gzip 中间件（GeoJSON 体积可观）。

### 5.3 dev 联调

`vite.config.ts` 的 `server.proxy['/api'] → http://localhost:<gin-port>`，前端 `npm run dev` + 后端 `go run .` 并行；Gin 的开发态 `no-store` 只作用于 html。

## 6. 分阶段实施计划

> 估时按单人计；每阶段结束都有可验收产物。

### P0 · 脚手架（0.5d）

- [ ] `frontend/` 初始化 Vite + Vue3 + TS + Router + Pinia + maplibre-gl + vitest + eslint/prettier
- [ ] 旧 `index.html`/`app.js`/`app.css`/`data/` 留档（`frontend-legacy/` 或分支 tag `legacy-frontend`）
- [ ] `vite.config.ts`：`/api` proxy、`base: '/'`、`build.outDir = dist`
- [ ] 后端 SPA fallback + `frontendDir` 配置化 + 缓存头
- [ ] 验收：`npm run dev` 起来，`/`、`/record`、`/archive` 三个空页面都能直接刷新命中，`/api/records` 经 proxy 正常返回

### P1 · 纯逻辑搬家（1.5d，风险最高收益最大）

- [ ] 按 §4 把 `app.js` 中与 DOM 无关的部分搬到 `src/domain/*`，签名尽量保持
- [ ] `normalize()` 脏数据兜底原样保留（`"false"` 字符串、`people` 拆分、非法 kind→`other`、`cancelled` 不进类型筛选）
- [ ] `api/client.ts`：三级回退（后端 → `journeyatlas_records_v1` 缓存 → 内置 fallback records）；内置数据从 `data/travel-log-data.js` 转 `src/data/fallbackRecords.ts`
- [ ] Vitest 用例：
  - 同一批数据在多种 filters 组合下的 5 个指标（在路天数/可见花销/移动小时/点亮城市/待补字段）
  - 6 个榜单的前 N 项与数值、城市夜数（含 HOME_CITY 互补口径）
  - `chainSortSegs` 同日链式排序、`computeContinuityGaps` 缺口条数与跳过规则（深圳↔香港 等口岸）
  - `greatCircleKm`、`parseTicketText` 各分支、`toCsv/parseCsv` 往返
- [ ] 验收：对同一份后端数据，新 domain 输出与旧版页面显示的数字逐项一致（快照测试固化）

### P2 · 骨架与状态（1d）

- [ ] `AppShell` + `AppNav` + `FilterBar` + `ToastHost` + `HelpDialog`
- [ ] `useRecordsStore`：`ensureLoaded()` / `refresh()` / `filteredRecords` / `selectedId`；`usePrefsStore`：皮肤、指标可见性、自定义标题（localStorage key 沿用）；`useToastStore`
- [ ] 筛选状态 ↔ URL query 双向同步（`/` 与 `/archive` 共享）
- [ ] 验收：三路由切换、深链刷新、浏览器前进后退、筛选跨页一致

### P3 · 主页：地图 + 时间线（2d）

- [ ] `MapCanvas`：MapLibre 初始化、样式切换（warm/slate/night）、主题重上色、路线层（航线弧/铁路真实轨迹/停留/地面）/城市点/选中高亮、`ResizeObserver`、断网退化
- [ ] 播放：`播放旅程`（镜头跟随、彗尾、caption 日期·交通·时长·跨时区标注）、`岁月`、重播 ↻、停止 ■、播放速度
- [ ] 地图四角：报头/数据状态、行动区（··· 菜单、行旅海报、街道海报、沉浸）、视图切换中国/世界、底部落款、指标条、图例
- [ ] `TimelineList` + `TimelineItem` + `RecordDetail`（日期/时长/金额/证据 + 街道海报入口）
- [ ] 生命周期：`<KeepAlive include="HomeView">`，`onActivated → map.resize()`；播放定时器/rAF 在 `onDeactivated`/`onUnmounted` 全部清理
- [ ] 验收：与旧版地图观感/播放手感对齐（视觉允许重设计，但图层语义、播放顺序、数值不变）；从 `/archive` 返回不重建、不白屏

### P4 · 旅行档案页（1d）

- [ ] `StatsHero`：总里程、出行次数、到访城市、国家/地区、大洲（含副标题口径）
- [ ] `RankBoard`（通用）+ 6 个榜：城市停留（晚·次）、高频路线（双向合并）、国家足迹、年度足迹、出行方式；跨榜 hover 联动
- [ ] `LedgerTable` + `LedgerSearch`（车次/航班/城市/项目联想、命中高亮、跳主页聚焦）
- [ ] 口径标签（年份 · 旅客 · 类型 · 证据）
- [ ] 验收：数字与旧版一致；榜单联动正常；行可点回主页对应段

### P5 · 录入页（1.5d）

- [ ] `RecordForm`：路线 / 票据 / 归属三段 fieldset + 校验（必填、日期范围、时长与时刻一致性提示）
- [ ] `PlaceInput`：Photon 联想（行政级别排序、国内/海外标记、同名地点可区分、重复选可改），选中即写入 `journeyatlas_user_cities`
- [ ] `TravelerSelect`：首次展开前拉 `/api/users`（保留"先拦截原生下拉、数据到手后 `showPicker()`"的兜底体验），失败不阻断录入
- [ ] 提交：`POST /api/records` → `router.push('/')` + toast + `store.refresh()`；表单「清空」回默认旅客
- [ ] `DataTools`：导入 JSON/CSV（逐条 POST，失败项统计）、导出 JSON/CSV（CSV 带 BOM）、**清空全部数据**、**重载资料**（移到本页，主页只留刷新）
- [ ] 票据文本试填：`domain/ticket.ts` 解析后填充表单（原 OCR 入口的离线能力保留，文案仍说明不做图像 OCR）
- [ ] 验收：录入一条后，主页地图/时间线/档案三处同时可见

### P6 · 海报、偏好、细节（1.5d）

- [ ] `TravelPosterModal`：Canvas 绘制（标题/尺寸/范围/指标/主题/字体）+ 下载 PNG
- [ ] 街道海报：保留跳转 maptoposter 外链
- [ ] 自定义标题编辑器、皮肤选择器、指标可见性、帮助弹窗
- [ ] 响应式（375 / 768 / 1440）、a11y（`aria-*`、焦点陷阱、Esc 关闭、键盘可操作）、`prefers-reduced-motion`
- [ ] 路由懒加载分包，`ArchiveView` 与海报代码独立 chunk
- [ ] 验收：移动端可用；无 console 报错；首屏体积可控

### P7 · 切换与收尾（1d）

- [ ] 并行对跑旧版做 parity QA 清单（地图图层、播放时长、指标/榜单数字、导入导出、深链）
- [ ] 更新 `README.md`、前端定制说明（原 `CUSTOMIZE.md` 内容）、`docs/DATA_SCHEMA.md` 引用路径
- [ ] 删除 `frontend-legacy/`；后端 `frontendDir` 指向 `dist`；部署说明更新
- [ ] 验收：只保留新前端；`/`、`/record`、`/archive` 与 API 全部正常

合计约 **9–10 人日**（不含后端编辑/删除接口）。若砍掉行旅海报 Canvas、改为外链 maptoposter，可省 1 天。

## 7. 关键设计说明

### 7.1 状态与数据流

```
api/client.ts ──records──▶ useRecordsStore
                             ├─ records / refresh() / loading / error
                             ├─ filters (与 route.query 双向同步)
                             ├─ filteredRecords (computed，含 pending 缺口注入)
                             └─ selectedId / focusId
                                   │
        ┌──────────────────────────┼───────────────────────────┐
   HomeView(地图/时间线)     ArchiveView(统计/明细)        RecordView(表单)
```

- 只有 store 持有 `records` 与 `filters`，页面不再各自 `getElementById` 取值。
- `filters` 是唯一真相，且写回 URL query（`router.replace`，避免污染历史栈）。
- `filters.confidence === 'pending'` 时才注入 `computeContinuityGaps()` 动态缺口（同旧版语义：不写库、不画线、不进统计）。

### 7.2 地图生命周期

- `MapCanvas` 内 `onMounted` 建实例、`onBeforeUnmount` 销毁；配合 `KeepAlive` 时为单例复用。
- 切路由回来后必须 `map.resize()`（容器尺寸变化 + `ResizeObserver` 双保险），否则画布塌陷。
- 播放状态（进度、计时器、镜头）放 `PlaybackControls` 内部或 `usePlayback()` composable，页面失焦即清理，绝不留后台 rAF。

### 7.3 旧代码迁移映射

| 旧位置（`app.js`） | 新位置 |
|---|---|
| `APP_NAME / SITE_TITLE / OWNER_NAME / HOME_CITY` | `src/config.ts`（构建期常量，或后续改为后端配置） |
| `CITY / CITY_ALIAS / CITY_EN`、`stripShi`、`cityLngLat`、`cityMeta`、`continentOf` | `domain/city.ts` |
| `photonSearch / resolvePlace / rememberCity / loadUserCities / preferReadable` | `domain/photon.ts` |
| `geoArc / greatCircleKm / fitToBounds / dataBounds / setMapView` | `domain/geo.ts` + `MapCanvas` |
| `normalize / parseOptionalNumber` | `domain/normalize.ts` |
| `filters / includesTraveler / filteredRecords` | `domain/filters.ts` + store computed |
| `chainSortSegs / computeContinuityGaps` | `domain/chain.ts` |
| `renderStatsPanel / renderStats / wireStatsHover` | `domain/stats.ts` + `archive/*` |
| `renderMap / applySkin / applyMapStyle / 播放相关` | `components/map/*` |
| `renderTimeline / renderDetail / renderLedger` | `components/timeline/*`、`components/archive/*` |
| `setupGeoInput / fillFormFromRecord / bindTravelerSelect / 表单提交` | `components/record/*` |
| `parseTicketText / extract* / inferKind` | `domain/ticket.ts` |
| `toCsv / parseCsv / download` | `domain/csv.ts` + `record/DataTools` |
| `POSTER_THEMES / POSTER_PALETTES / mountSwatchPicker / 行旅海报绘制` | `domain/theme.ts`、`domain/poster/*`、`poster/TravelPosterModal` |
| `HELP_HTML / openHelp` | `common/HelpDialog.vue`（模板化，去掉 `v-html`） |
| `escapeHtml` | 删除（Vue 模板自动转义，仅帮助文案允许 `v-html` 且内容为静态常量） |

## 8. 验收标准

1. `/`、`/record`、`/archive` 三个路由均支持直接访问与刷新（后端 fallback 生效）。
2. 同一份数据、同一组筛选，新前端 5 指标 + 6 榜单 + 明细行数与旧版**数值一致**（快照测试 + 手工对跑）。
3. 地图：中国/世界切换、皮肤切换、图层语义（航线/铁路/停留/地面/费用层）、播放与岁月动画、沉浸模式、断网退化均可用；从档案页返回地图不重建不白屏。
4. 录入：地点联想可选同名地点、旅客下拉懒加载、提交后三处（地图/时间线/档案）同时出现；导入导出与清空/重载可用。
5. 前端类型检查与 lint 通过；`domain` 单测通过；路由级分包生效。
6. 移动端 375px 可用，键盘可完成主要操作，Esc 可关弹层；无 console 报错。
7. 部署后后端仅托管 `dist`，`/api/*` 未命中返回 JSON 404 而非 HTML。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 数字口径漂移（重构最常见事故） | P1 先做纯逻辑 + 快照测试，P3/P4 上线前用旧版对跑同数据集 |
| MapLibre 生命周期 / 容器塌陷 | KeepAlive + `onActivated → resize()` + `ResizeObserver`；播放器资源随组件销毁 |
| 大 GeoJSON 拖慢首屏 | 放 `public/data`，仅当前视图按需 fetch，视图内缓存；后端加 gzip |
| 视觉重写导致信息层级丢失 | 以「四角元素 + 指标条 + 榜单形态」清单逐项对照旧版截图验收，令牌沿用 `--paper/--red/--rail` |
| 脏数据兜底被"顺手清理" | `normalize()` 行为固化为单测（`"false"` 字符串、`people` 拆分、`cancelled` 不进类型筛选） |
| 用户偏好丢失 | localStorage key 不变（`journeyatlas_*`） |
| 深链/分享失效 | SPA fallback + `/api` JSON 404 隔离 + 缓存头区分 |

## 10. 延后事项（本次不做，记录在案）

1. `PUT /api/records/:id`、`DELETE /api/records/:id`，以及档案页的「编辑 / 删除单条」入口（目前只能"清空全部数据"）。
2. `POST /api/records/batch`：现在导入是逐条 POST，批量接口可显著提速并做事务。
3. 票据图像 OCR / AI 识别（仍只保留"粘贴文本试填"）。
4. 用户体系（登录、按用户隔离数据）与 `users` 表联动。
5. 多语言（当前中文优先，地名仍按"可读性"选显示语言）。
6. `go:embed dist` 单二进制分发。
