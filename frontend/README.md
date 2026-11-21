# TrailVault 前端（Vue 3 + TypeScript + Vite）

三页结构：

| 路由       | 视图                    | 内容                             |
| ---------- | ----------------------- | -------------------------------- |
| `/`        | `views/HomeView.vue`    | 主页：地图 + 时间线（默认页）    |
| `/record`  | `views/RecordView.vue`  | 录入：表单 + 地点联想 + 数据工具 |
| `/archive` | `views/ArchiveView.vue` | 旅行档案：统计榜 + 资料明细      |

重构计划与阶段验收标准见 **[`../docs/FRONTEND_VUE3_PLAN.md`](../docs/FRONTEND_VUE3_PLAN.md)**。
当前进度：**P0（脚手架）+ P1（domain 纯逻辑 / api 三层回退 / Vitest 数字口径）+ P2（骨架与状态）已完成**，
三个页面仍是「状态联调」占位视图（P3/P4/P5 换成地图、榜单、表单）。

## P1 交付了什么

- `src/domain/*`：城市坐标/别名/大洲、Photon 地理编码、大圆距离与取景框、`normalize()` 脏数据兜底、筛选与搜索联想、
  同日链式排序与断点计算、5 个指标 + 6 个榜单（含城市夜数与主城互补口径）、CSV、票据文本解析、海报配色。
  全部零 Vue 依赖、可单测；签名与原 `app.js` 尽量一致。
- `src/api/client.ts`：唯一 fetch 出口 + **三级回退**（后端 `/api/records` → localStorage
  `journeyatlas_records_v1` → 内置演示数据），`fetch` / `storage` 可注入，便于单测。
- `src/data/fallbackRecords.ts`：内置演示数据（构建期 `import` 旧版 `data/travel-log.json`）。
- 测试：`npm run test`。其中 `domain/legacy-parity.spec.ts` 把旧版算法（日期枚举改用 UTC 算法）**独立重写**成参考实现，
  再拿真实演示数据集做差分比对 —— 这就是「只换壳不换数」的护栏；任何口径改动都会立刻炸。

## P2 交付了什么

- `src/stores/records.ts`：全站唯一的数据 / 筛选 / 选中态。`ensureLoaded()` 走 `api/client.ts` 的三级回退，
  `refresh()` 只认后端（后端没连上就保留上一次资料），`filteredRecords` = P1 的 `domain/filteredRecords`
  （`confidence=pending` 时注入动态缺口），另有 `ledgerRecords` / `metrics` / `options` / `scopeLabel` / `selectedRecord`。
  选中段被筛掉时按旧版 `render()` 语义自动落到当前可见的第一段。
- `src/stores/prefs.ts`：皮肤 / 指标可见性 / 展示模式 / 标题显隐 / 自定义标题，**localStorage key 全部沿用旧版名字**；
  坏缓存静默回默认。DOM 层面的 `data-skin` / body class / `document.title` 由 `applyDocument()` 统一写。
- `src/domain/query.ts` + `src/composables/filterQuery.ts`：筛选 ↔ URL query 双向同步。
  `/`、`/archive` 共用；深链（含 query）URL 说了算，无 query 时 store 说了算并 `router.replace` 写回，
  所以三页切换后筛选仍一致、链接可收藏、浏览器前进后退可用；默认口径不写参数。
  `/?focus=<id>` 会在资料加载后高亮对应的一段（P4 的档案页跳回主页会用）。
- `src/layout/FilterBar.vue`：四个下拉 + 重置 + 主页「刷新资料」+ 口径 / 条数 / 来源状态行，
  选项全部由 `filterOptions()` 从数据推导；`src/components/common/HelpDialog.vue` 把旧版 `HELP_HTML` 模板化，
  去掉 `v-html`，支持 Esc / 遮罩 / 焦点陷阱。
- `src/styles/layout.css`：三页共享的表单、按钮、筛选栏与状态面板原语；`main.ts` 引入。
- 测试：`domain/query.spec.ts`、`domain/prefs.spec.ts`、`stores/records.spec.ts`（纯逻辑 + Pinia，不依赖 DOM / 网络）。

### P2 手工验收清单

1. `/`、`/record`、`/archive` 三页互相切换，页头导航高亮正确；主页/档案页显示同一个 `FilterBar`。
2. 在 `/` 选 `年份=2024`、`旅客=全部旅客` → 地址栏变成 `/?year=2024&traveler=all`；
   点「旅行档案」→ `/archive?year=2024&traveler=all`，筛选和「可见 / 全部」条数保持一致。
3. 直接刷新 `/archive?year=2024&kind=rail`、另开标签页打开该链接，筛选与统计数字都还原。
4. 浏览器前进/后退在三页之间往返，筛选不丢、不白屏；点「重置筛选」后地址栏里的四个筛选键消失
   （若当前有 `?focus=<id>` 会保留，它表示选中段而不是筛选条件）。
5. `/?focus=<已存在的记录 id>` 刷新后「当前一段」显示该段；若该段被当前筛选挡住，自动清掉筛选再定位。
6. 页头「使用说明」可打开弹层，Esc / 点遮罩 / 关闭按钮都能关，焦点回到触发按钮。
7. 断网（后端未启动）时首屏仍显示内置/缓存资料，主页「刷新资料」提示后端未连接且不清空现有资料。

## 环境要求

- Node **>= 20.19**（Vite 5 / vitest 2）
- Go 后端可选：只有需要真实 `/api/*` 数据时才要起（否则页面可用 mock 数据开发）

## 开发

```bash
cd frontend
npm install
cp .env.example .env.local   # 可选：改 VITE_API_PROXY，默认 http://127.0.0.1:8080
npm run dev                  # http://localhost:5173
```

另开一个终端起后端（提供 `/api/records`、`/api/users`）：

```bash
cd backend
go run .
```

`vite.config.ts` 已把 `/api` 与 `/health` 反代到 `VITE_API_PROXY`，前端代码里直接
`fetch('/api/records')` 即可，无需写死 host。

反方向也通了：`backend/config/configs/app.yaml` 里的 `frontend.devproxy: http://127.0.0.1:5173`
让后端在 dev 模式下把非 `/api` 请求**反代给 Vite dev server**，所以：

- 开发时打开 **5173** 或 **8080** 看到的是同一个应用（都是热更新）；
- 只在 8080 看「构建产物」时，把 `devproxy` 置空即可（见下方联调流程）。

## 构建与联调 SPA 兜底

```bash
cd frontend
npm run build        # 产出 frontend/dist/
cd ../backend
go run .             # dev 模式下检测到 dist/index.html 会优先托管产物
```

验证 SPA fallback（这是 P0 的核心验收项）：

- `http://127.0.0.1:8080/` 正常打开
- `http://127.0.0.1:8080/archive`、`/record` **直接刷新**也能打开（不是 404）
- `http://127.0.0.1:8080/api/nope` 返回 **JSON** `{"error":"not found"}`，而不是 index.html
- `http://127.0.0.1:8080/assets/xxx.js`（不存在的资源）返回 404，而不是 HTML

### 常见问题：8080 打开是空白/说明页

两种情况：

**① dev 模式配了 `frontend.devproxy`，但 Vite 没起**
→ 页面是「反代目标 Vite dev server 没有响应」。起好 `npm run dev` 后刷新即可，**不用重启后端**。

**② 没配 devproxy，且 `dist/` 也没构建**
→ Gin 托管的是 Vite 源码目录，源码 `index.html` 引 `/src/main.ts`（TypeScript，浏览器跑不了）。
日志特征：

```
GET "/"            200/304
GET "/src/main.ts" 200     ← 就是它在白屏
```

两种修法：

```bash
cd frontend && npm run dev      # 开发：开 devproxy 后 8080 也直接可用
# 或
cd frontend && npm run build && cd ../backend && go run .   # 静态：重启后 8080 托管 dist
```

注意：`StaticDir()` 在**启动时**决定托管目录，`npm run build` 之后必须重启后端；
而 `devproxy` 的连接失败是请求时判断的，Vite 起了刷新即可。

## 脚本

| 命令                              | 作用                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                     | Vite dev server（5173，含 /api 反代）                                       |
| `npm run build`                   | `vue-tsc --noEmit` 类型检查 + 构建到 `dist/`                                |
| `npm run typecheck`               | 只做类型检查                                                                |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                           |
| `npm run test`                    | Vitest：`domain/*.spec.ts` 口径锁定 + `api/client.spec.ts` 三级回退 + `stores/records.spec.ts` 筛选/选中态 |

## 目录约定

```
src/
├─ domain/       纯逻辑（无 Vue 依赖，可单测）：城市坐标、Photon 地理编码、归一化、筛选、统计、CSV、票据解析、主题、query、prefs
├─ api/          fetch 封装 + 三级回退（后端 → localStorage 缓存 → 内置数据）
├─ data/          内置演示数据（构建期 import 旧版 data/travel-log.json）
├─ test/          测试辅助（记录工厂），不参与应用构建
├─ stores/        Pinia：records / prefs / toast
├─ composables/   filterQuery（URL query ↔ 筛选状态双向同步）
├─ layout/        AppShell / AppNav / FilterBar / ToastHost
├─ styles/        tokens.css / base.css / layout.css
├─ views/         HomeView / RecordView / ArchiveView
└─ components/    map / timeline / archive / record / poster / common
public/data/     大 GeoJSON 与铁路轨迹，运行时按需 fetch（不打包）
```

## 旧版前端（迁移期留档）

旧版是纯静态 Vanilla JS（单页 + `data-pane` 切区块，`app.js` 4111 行）。P0 用 Vite 入口替换了
`index.html`，旧文件 **仍在磁盘上、且都在 git 历史里**。P1 已经把与 DOM 无关的逻辑全部搬进 `src/domain/*`，
剩下还能当参照的部分：地图舞台（`renderMap` / 播放 / 换肤）、海报 Canvas、以及各处 DOM 模板与样式。

- `app.js`、`app.css`、`data/*`（旧资源，新代码不再引用）
- 旧 `index.html` 内容可用 `git show HEAD:frontend/index.html` 查看

需要把旧版跑起来做对照时（P7 parity QA 前）：

```bash
git log --oneline -- frontend/index.html      # 找到替换前的提交
git worktree add ../trail-vault-legacy <commit>
# ../trail-vault-legacy/frontend 即为可运行的旧版静态站
```

P1（domain 已搬完）、P3（地图/海报移植）完成后删除 `app.js`、`app.css`、`data/`。
注意：`src/data/fallbackRecords.ts` 目前 import 的是 `data/travel-log.json`，删旧目录前要先把它复制到 `src/data/`。
