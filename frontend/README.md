# TrailVault 前端（Vue 3 + TypeScript + Vite）

三页结构：

| 路由 | 视图 | 内容 |
| --- | --- | --- |
| `/` | `views/HomeView.vue` | 主页：地图 + 时间线（默认页） |
| `/record` | `views/RecordView.vue` | 录入：表单 + 地点联想 + 数据工具 |
| `/archive` | `views/ArchiveView.vue` | 旅行档案：统计榜 + 资料明细 |

重构计划与阶段验收标准见 **[`../docs/FRONTEND_VUE3_PLAN.md`](../docs/FRONTEND_VUE3_PLAN.md)**。
当前进度：**P0（脚手架）已完成**，三个页面为占位视图。

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

| 命令 | 作用 |
| --- | --- |
| `npm run dev` | Vite dev server（5173，含 /api 反代） |
| `npm run build` | `vue-tsc --noEmit` 类型检查 + 构建到 `dist/` |
| `npm run typecheck` | 只做类型检查 |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm run test` | Vitest（P1 起放 `src/domain/*.spec.ts`） |

## 目录约定

```
src/
├─ domain/     纯逻辑（无 Vue 依赖，可单测）：城市坐标、Photon 地理编码、归一化、筛选、统计、CSV、票据解析、主题
├─ api/        fetch 封装 + 三级回退（后端 → localStorage 缓存 → 内置数据）
├─ stores/     Pinia：records / prefs / toast
├─ layout/     AppShell / AppNav / FilterBar / ToastHost
├─ views/      HomeView / RecordView / ArchiveView
└─ components/ map / timeline / archive / record / poster / common
public/data/   大 GeoJSON 与铁路轨迹，运行时按需 fetch（不打包）
```

## 旧版前端（迁移期留档）

旧版是纯静态 Vanilla JS（单页 + `data-pane` 切区块，`app.js` 4111 行）。P0 用 Vite 入口替换了
`index.html`，旧文件 **仍在磁盘上、且都在 git 历史里**，作为 P1/P3 的移植参照：

- `app.js`、`app.css`、`data/*`（旧资源，新代码不再引用）
- 旧 `index.html` 内容可用 `git show HEAD:frontend/index.html` 查看

需要把旧版跑起来做对照时（P7 parity QA 前）：

```bash
git log --oneline -- frontend/index.html      # 找到替换前的提交
git worktree add ../trail-vault-legacy <commit>
# ../trail-vault-legacy/frontend 即为可运行的旧版静态站
```

P1（domain 搬迁）与 P3（地图/海报移植）完成后删除 `app.js`、`app.css`、`data/`。
