# 前端 Vue 3 重构计划

> 状态：**P0、P1 已完成**，下一步 P2（骨架与状态）；P2–P7 待执行
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

### 5.0 配置形态（已落地）

```yaml
frontend:
  devdir: ../frontend        # 开发期源码目录（无 devproxy 时的兜底静态托管）
  distdir: ../frontend/dist  # npm run build 产物
  devproxy: http://127.0.0.1:5173   # dev 模式把非 /api 请求反代给 Vite dev server（release 忽略）
```

请求落点优先级（`server/route.go: registerStatic`）：

1. dev + `devproxy` 非空 → 整体反代给 Vite（含 HMR websocket 升级），8080 与 5173 同一个应用；
2. 真实文件（`/assets/*`、`/data/*.json`）→ 直发 + 缓存头；
3. `/api`、`/health` 未命中 → JSON 404；
4. 带扩展名但缺失 → 404；
5. 其余 → `index.html`（SPA 兜底）。

`config.Config.StaticDir()` 只在**非 devproxy 或 release** 时决定静态目录：

- `mode: release` → 只认 `distdir`；
- `mode: dev` → `distdir/index.html` 存在就托管产物，否则回落 `devdir`（并触发源码目录白屏保护）。

`config.Config.DevProxy()` 在非 dev 模式恒返回空，生产绝不把请求转给外部进程。

### 5.1 SPA fallback（已实现）

`backend/server/route.go` 的 `NoRoute` 按下面顺序判定：

1. `/api`、`/api/*`、`/health` 未命中 → `404 {"error":"not found"}`（JSON，别把 index.html 当接口响应）；
2. 非 GET/HEAD → 405；
3. 命中真实文件（`/assets/*`、`/data/*.json`、字体…）→ 直接发送，按类型给缓存头（目录穿越已用 `path.Clean` + 前缀校验拦住）；
4. **带扩展名但文件不存在** → 404。漏了这条会把 HTML 喂给 `<script>`/`<link>`，
   报出“Uncaught SyntaxError: Unexpected token '<'”这类极难定位的错误；
5. 其余（`/`、`/archive`、`/record`、`/?focus=x`）→ 回 `index.html`，交给前端路由。

否则 `/archive`、`/record` 直接刷新或分享链接必 404。启动时若 `index.html` 不存在会 `Warn` 提示去 `npm run build`。

### 5.2 托管目录与缓存（已实现）

- `main.go`：不再写死 `../frontend`，改为 `server.New(&cfg.Server, cfg.StaticDir(), …)`，`//todo` 已清掉。
- 缓存头（`cacheControl()`）：
  - `mode: dev` → 所有静态资源 `no-store`（前端改完普通刷新即生效）；
  - `mode: release` → `/assets/*`（带内容 hash）`public, max-age=31536000, immutable`；
    入口 `index.html`（含 `/`、`/archive` 回退）`no-cache`；其余 `/data/*.json` 等 `public, max-age=3600`。
- 可选（后续）：`//go:embed dist` 单二进制部署；Gin gzip 中间件（GeoJSON 体积可观）。

### 5.3 dev 联调（已实现）

`vite.config.ts` 的 `server.proxy` 把 `/api` 与 `/health` 反代到 `VITE_API_PROXY`（默认 `http://127.0.0.1:8080`），
前端 `npm run dev` + 后端 `go run .` 并行；页面代码里统一 `fetch('/api/records')`，不写死 host。

## 6. 分阶段实施计划

> 估时按单人计；每阶段结束都有可验收产物。

### P0 · 脚手架（0.5d）✅ 已完成

- [x] `frontend/` 初始化 Vite + Vue3 + TS + Router + Pinia + maplibre-gl + vitest + eslint/prettier
  （`package.json`、`vite.config.ts`、`tsconfig.json`、`env.d.ts`、`eslint.config.js`、`.prettierrc.json`）
- [x] 旧 `index.html` 被 Vite 入口替换；`app.js` / `app.css` / `data/` **原地保留**作为 P1/P3 移植参照，
  并在 git 历史里留档（替代物理搬到 `frontend-legacy/`，见 §11 实施偏差）
- [x] `vite.config.ts`：`/api`、`/health` proxy（`VITE_API_PROXY`，默认 `http://127.0.0.1:8080`）、`base: '/'`、`build.outDir = dist`
- [x] 三条路由 + 占位视图 + `AppShell`/`AppNav`/`ToastHost`（`stores/toast.ts`）+ 设计令牌 `styles/tokens.css`、`styles/base.css`
- [x] 后端：`route.go` SPA fallback（`/api` JSON 404 / 真实文件 / 带扩展名缺失 404 / 其余回 `index.html`）+ 缓存头
- [x] 后端：`config.FrontendConfig{devdir,distdir}` + `Config.StaticDir()`，`main.go` 不再写死 `../frontend`
- [x] 验收项（见 `frontend/README.md` 的「构建与联调 SPA 兜底」）：`/`、`/archive`、`/record` 直接刷新可命中；
  `/api/nope` 返回 JSON 404；缺失的 `/assets/*.js` 返回 404 而非 HTML

> 下一步：P2 —— `FilterBar` + `useRecordsStore` / `usePrefsStore`，筛选状态与 URL query 双向同步。

### P1 · 纯逻辑搬家（1.5d，风险最高收益最大）✅ 已完成

- [x] 按 §4 把 `app.js` 中与 DOM 无关的部分搬到 `src/domain/*`，签名尽量保持
      （`city` / `photon` / `geo` / `normalize` / `filters` / `chain` / `stats` / `csv` / `ticket` / `theme`
      + 补充 `format.ts`、`kind.ts`、`types.ts`，见 §11 的 P1 落地清单）
- [x] `normalize()` 脏数据兜底原样保留（`"false"` 字符串、`people` 拆分、非法 kind→`other`、`cancelled` 不进类型筛选）
- [x] `api/client.ts`：三级回退（后端 → `journeyatlas_records_v1` 缓存 → 内置 fallback records）；内置数据从 `data/travel-log-data.js` 转 `src/data/fallbackRecords.ts`
- [x] Vitest 用例：
  - 同一批数据在多种 filters 组合下的 5 个指标（在路天数/可见花销/移动小时/点亮城市/待补字段）
  - 6 个榜单的前 N 项与数值、城市夜数（含 HOME_CITY 互补口径）
  - `chainSortSegs` 同日链式排序、`computeContinuityGaps` 缺口条数与跳过规则（深圳↔香港 等口岸）
  - `greatCircleKm`、`parseTicketText` 各分支、`toCsv/parseCsv` 往返
- [x] 验收：对同一份后端数据，新 domain 输出与旧版页面显示的数字逐项一致
      （做法见 §11：把旧版算法用 UTC 日期枚举**独立重写**成参考实现，对真实演示数据集做差分比对）

### P2 · 骨架与状态（1d）

- [ ] `FilterBar` + `HelpDialog`（`AppShell` / `AppNav` / `ToastHost` 已在 P0 落地）
- [ ] `useRecordsStore`：`ensureLoaded()` / `refresh()` / `filteredRecords` / `selectedId`；`usePrefsStore`：皮肤、指标可见性、自定义标题（localStorage key 沿用）
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

## 11. 实施记录与偏差

### P0 落地清单

| 文件 | 说明 |
| --- | --- |
| `frontend/package.json` | Vue 3.5 / Router 4 / Pinia 2 / maplibre-gl 4 / Vite 5 / vitest 2 / ESLint 9 + Prettier |
| `frontend/vite.config.ts` | `/api`·`/health` proxy、`@` 别名、`outDir: dist`、vitest 配置 |
| `frontend/tsconfig.json` | `strict`、`verbatimModuleSyntax`、`moduleResolution: bundler`、`@/*` 路径映射 |
| `frontend/index.html` | 仅 `#app` + `/src/main.ts`（旧页面入口已被替换） |
| `frontend/src/main.ts`、`App.vue` | Pinia + Router 挂载 |
| `frontend/src/router/index.ts` | `/`、`/record`（懒加载）、`/archive`（懒加载）、未知路径回 `/`；`afterEach` 写 `document.title` |
| `frontend/src/layout/` | `AppShell`（页头 + `AppNav` + `KeepAlive include="HomeView"`）、`ToastHost` |
| `frontend/src/stores/toast.ts` | 全局轻提示（替代旧 `flashToast`） |
| `frontend/src/styles/` | `tokens.css` 沿用旧令牌；`base.css` 纸纹背景、三页共享版式类 |
| `frontend/src/views/` | 三页占位视图 + `components/common/PhaseNotice.vue` 展示阶段进度 |
| `frontend/public/data/README.md` | 约定大 GeoJSON / rail paths 走运行时 fetch，不打进 bundle |
| `backend/config/config.go` | `FrontendConfig` + `Config.StaticDir()` |
| `backend/config/configs/app.yaml` | 新增 `frontend.devdir` / `frontend.distdir` |
| `backend/main.go` | 改用 `cfg.StaticDir()` |
| `backend/server/route.go` | SPA fallback + 目录穿越防护 + 缓存策略 |

### P1 落地清单

| 文件 | 说明 |
| --- | --- |
| `frontend/src/config.ts` | 品牌/报头/`OWNER_NAME`/`HOME_CITY`、localStorage key（全部沿用旧名）、API 与 `/data/*` 地址、视图经纬度框 |
| `frontend/src/domain/types.ts` | `TravelRecord` / `RawRecord` / `RawUser` / `RecordMetadata` / `LngLat`；`TravelKind`、`ConfidenceKey` 字面量联合 |
| `frontend/src/domain/kind.ts` | `KIND`（标签+语义色）、`CONFIDENCE`、`MOVE_KINDS`、类型筛选白名单（排除 `cancelled`）、`kindLabel/kindColor/confidenceLabel` |
| `frontend/src/domain/city.ts` | `CITY` / `CITY_META` / `CITY_EN` / `COUNTRY_EN` / `CITY_ALIAS`、`cityMeta`、`cityLngLat`、`stripShi`、`cityKey`、`cityLatin`、`titleCase`、`countryLatin`、`continentOf`、`registerCity` |
| `frontend/src/domain/photon.ts` | `photonSearch` / `resolvePlace` / `rememberCity` / `loadUserCities` / `preferReadable` / 行政级别加权；fetch 可注入 |
| `frontend/src/domain/geo.ts` | `greatCircleKm` / `geoArc` / `mercatorXY` / `dataBounds(records, scope)` / `fitToRecords` |
| `frontend/src/domain/normalize.ts` | `normalize` / `parseOptionalNumber`：脏数据兜底 7 条规则（每条都有单测） |
| `frontend/src/domain/format.ts` | `daysBetween` / `dateRange` / `displayTitle` / `money` / `duration` / `stayNights` / `isCrossTimezone` / `tripTimeText` / `formatKm` |
| `frontend/src/domain/filters.ts` | `Filters` / `DEFAULT_FILTERS` / `includesTraveler` / `filterRecords`（不注入缺口）/ `filteredRecords`（pending 注入缺口）/ `filterOptions` / `describeScope` / `buildSuggestions` / `usernameOf` / `routeKey` |
| `frontend/src/domain/chain.ts` | `chainSortSegs` / `computeContinuityGaps`（口岸对与同日假断点跳过） |
| `frontend/src/domain/stats.ts` | `computeMetrics`（5 指标）/ `computeArchiveStats`（Hero + 6 榜 + 城市夜数含主城互补）+ 副标题文案函数 |
| `frontend/src/domain/csv.ts` | `CSV_HEADER` / `toCsv` / `toCsvWithBom` / `parseCsv`（含去 BOM） |
| `frontend/src/domain/ticket.ts` | `parseTicketText` + `extract*` / `inferKind` / `computeDurationMinutes` / AI JSON 抠取 / `AI_RECORD_PROMPT` |
| `frontend/src/domain/theme.ts` | `POSTER_PALETTES`（基础 3 套）、`registerPosterThemes`、`posterIsDark`、`liftLightness`、`hexA`、`POSTER_THEME_CN` |
| `frontend/src/api/client.ts` | `loadRecords` 三级回退、`fetchAllTravelRecords`、`fetchUsers`、`createTravelRecord`、`pushRecordsToBackend`、缓存读写（storage/fetch 可注入） |
| `frontend/src/data/fallbackRecords.ts` | 内置演示数据（构建期 import `data/travel-log.json`） |
| `frontend/src/{domain,api}/**.spec.ts` | 10 个测试文件：normalize / filters / chain / stats / geo / format / csv / ticket / api client / legacy-parity（真实数据集差分） |
| `frontend/src/test/records.ts` | 测试用记录工厂（只写与用例相关的字段，其余交给 `normalize` 默认值） |

### 偏差

1. **旧的 `app.js` / `app.css` / `data/` 没有物理移动到 `frontend-legacy/`**：本次执行环境没有可用 shell，
   大文件（GeoJSON）无法搬运。改为「原地保留 + git 历史留档 + `frontend/README.md` 写清取回命令」，
   效果等价（旧版可随时用 `git worktree` 检出），并在 P1/P3 完成后随迁移一起删除。
   若坚持要独立目录，执行：
   ```bash
   mkdir -p frontend-legacy
   git mv frontend/app.js frontend/app.css frontend/data frontend-legacy/
   git show HEAD:frontend/index.html > frontend-legacy/index.html   # 注意替换前提交
   ```
2. `frontend/README.md` 被替换为新前端开发说明；旧版 README（journey-atlas 定制指南）仍在 git 历史里，
   P1 移植 `CITY` / `POSTER_THEMES` 时可 `git show HEAD~1:frontend/README.md` 查阅。
3. 三页视图是占位实现（阶段进度卡片），真实内容按 P3/P4/P5 逐步替换；`KeepAlive` 已就位，等 `MapCanvas` 接入。
4. **白屏防护 + dev 反代（P0 后补）**：
   - dev 模式新增 `frontend.devproxy`（默认 `http://127.0.0.1:5173`），非 `/api` 请求整体反代给 Vite，
     **8080 与 5173 是同一个应用**（含 HMR websocket）；Vite 未起时返回说明页（502），起好后刷新即可、无需重启后端。
   - 反代不可用时 `ErrorHandler` 不走默认的空白 502 页，而是 `diagnosticPage()`。
   - 无 devproxy、且 `dist/` 未构建时托管 Vite 源码目录会白屏（`/src/main.ts` 浏览器跑不了）：
     启动 `isViteSourceRoot()` 命中即 `ERROR` 日志，SPA 兜底返回诊断页而不是源码 `index.html`。
   - 已知限制：`StaticDir()` 在启动时选定，`npm run build` 后需重启后端（devproxy 路径不受此限制）。
5. **P1 的几个接口签名为了可单测做了小改动**（行为不变）：
   - `dataBounds(scope)` → `dataBounds(records, scope)`（旧版读全局 `filteredRecords()`）；
   - `filteredRecords()` → `filteredRecords(records, filters)`；
   - `parseTicketText(text)` 多了可选的 `traveler` 参数（默认 `OWNER_NAME`）；
   - `money/duration` 的 `showMode` 由全局变量改成显式参数（P2 交给 `usePrefsStore`）；
   - `applySkin` 未搬：它直接操作 `documentElement.dataset.skin` 与 MapLibre 实例，归到 P3 的 `MapSkinPicker`/`usePrefsStore`。
6. **内置数据没有复制**：`src/data/fallbackRecords.ts` 直接 `import '../../data/travel-log.json'`（构建期并入 bundle，效果等价）。
   P7 删除旧版 `data/` 时要把这份 JSON 挪到 `src/data/`，否则该 import 会断。
7. **海报 Canvas 与街道海报未搬**（`app.js` 里的 `renderTravelPoster` / `drawPoster` / Overpass 取数）：属于 P6，
   且需要先确定 `TravelPosterModal` 的 props 形态；P1 只搬了共用的配色表与颜色小工具（`domain/theme.ts`）。
8. **`POSTER_THEMES` 未找到独立数据文件**：旧版是 `data/*.js` 挂在 `window.POSTER_THEMES`。
   `domain/theme.ts` 已提供 `registerPosterThemes()`，并在模块加载时自动并入 `globalThis.POSTER_THEMES`；
   P6 把 20 套主题搬成 `src/data/posterThemes.ts` 后调用一次即可（届时色板套数才会从 3 变成 23）。
9. **本阶段没有可用 shell**：`npm run typecheck / lint / test` 需要在有 Node 的环境里跑一次确认（见 `frontend/README.md` 的脚本表）。
