# TrailVault 后端改造计划

> 前后端分离 + 前端嵌入 Go 单二进制 · 分阶段路线图
> 最后更新：2026-08-23

## 目录
1. 背景与现状
2. 目标
3. 总体策略
4. 技术选型（默认，可调整）
5. 阶段 A — 后端脚手架 + 配置 + DB
6. 阶段 B — 旅程管理 API
7. 阶段 C — 前端嵌入 + 托管
8. 阶段 D — 前端数据层切到后端
9. 阶段 E — 界面精简（决策点）
10. 阶段 F — 用户管理（决策点·暂缓）
11. 阶段 G — OCR 识别（决策点）
12. 执行方式与里程碑

---

## 1. 背景与现状（已探索确认）

- 仓库根目前**没有任何 Go 代码**：只有 `frontend/`（未提交）+ `README.md` + `LICENSE` + `.gitignore`（Go 模板）。根 README 里写的"Go-based backend"只是愿景，尚未落地——后端全新搭建。
- 前端 = 开源项目 journey-atlas（"Roamap"）：**纯 vanilla JS**，单文件 `app.js`（~3950 行）+ `index.html` + `app.css` + `data/*`。**无框架、无构建步骤、无 package.json**。MapLibre GL JS 走 CDN。数据全存浏览器 `localStorage`（key `journeyatlas_records_v1`），无后端、无鉴权、无 API 客户端。
- 核心实体只有一个 **`Record`**（旅行一段/停留），23 个字段，见 `frontend/docs/DATA_SCHEMA.md`。另有隐式的"城市坐标缓存"和"铁轨缓存"存在 localStorage。
- **对"前端打进二进制"是利好**：无构建步骤 = 直接 `//go:embed` 整个前端目录，无需配 bundler。
- 死代码（无论如何都清）：内部海报弹窗 `#posterModal` + Overpass 管线（`fetchOverpass`/`drawPoster`/`openCityPoster`）、OCR 粘贴流程（`AI_RECORD_PROMPT`/`tryParseStructuredRecords`/`parseTicketText`）、show-mode（`showMode` 等）。

## 2. 目标

1. 前后端分离：Go 后端提供 REST API，前端改为打 API。
2. 前端包嵌入 Go 二进制：一个 `go build` 产物同时提供前端 + API。
3. 后端能力：旅程管理（CRUD）、用户管理（后期）、OCR 识别（后期）。
4. 简化界面：按需移除不想要的功能模块。
5. 补齐前端 ROADMAP 缺口：行级编辑/删除记录。

## 3. 总体策略

"删哪些功能 / OCR 选型 / 用户体系"均留到后期再定，故采用**分阶段路线图**：
- **阶段 A–D**：无需任何待定决策，现在即可动手——搭后端骨架、旅程 CRUD、嵌入并托管前端、把前端数据层切到后端。
- **阶段 E/F/G**：各以一个**决策点**开头（删哪些功能 / 用户模型 / OCR 引擎），到时确认后再实施。每阶段独立可交付，随时可停。

## 4. 技术选型（默认，可调整）

| 项 | 默认 | 理由 |
|---|---|---|
| 数据库 | SQLite + 纯 Go 驱动 `modernc.org/sqlite` | 无 CGO，Windows 下 `go build` 直接出单文件二进制；DB 就是程序旁一个 `.db` 文件，最贴合自托管单二进制 |
| 路由 | Go 1.22+ 标准库 `net/http`（`METHOD /path` 模式） | 不引框架，依赖最少 |
| 前端嵌入 | `//go:embed` | 无构建步骤，整目录直接嵌 |
| 鉴权（F 阶段） | session cookie + bcrypt | 自托管单二进制比 JWT 更简单安全 |
| OCR（G 阶段） | LLM 视觉 API（自带 key） | 中文票据最准，可复用前端 `parseStructuredRecords` |

---

## 5. 阶段 A — 后端脚手架 + 配置 + DB（无待定决策）

**目标**：一个能跑的 Go 单二进制，连上 SQLite，预留 `/api/v1`。

目录布局（仓库根新增 `backend/`，与 `frontend/` 同级，为独立 go module）：
```
backend/
  go.mod                          # module trail-vault/backend
  go.sum
  cmd/trailvault/main.go          # 入口：加载配置、连DB、启HTTP、优雅关停
  internal/
    config/config.go              # 环境变量/默认值
    db/db.go                      # 打开SQLite、跑迁移、连接池
    db/migrations/0001_init.sql   # 建表（B 阶段填 records）
    model/                        # Go struct（B 阶段填）
    handler/                      # HTTP handler（B 阶段填）
    web/embed.go                  # //go:embed 前端（C 阶段填）
```
要点：
- `go mod init trail-vault/backend`；依赖 `modernc.org/sqlite`。
- config：`TV_LISTEN=:8080`、`TV_DB=./data/trailvault.db`、`TV_DEV=true`。
- db.go：`journal_mode(WAL)` + `busy_timeout(5000)`；启动时跑 `migrations/*.sql`。
- main.go：`http.NewServeMux()`；`GET /api/v1/health → {ok:true}`；根路径暂返占位；`signal.Notify` 优雅关停。
- **验收**：`go run ./cmd/trailvault` → `curl :8080/api/v1/health` 通；`.db` 生成。

## 6. 阶段 B — 旅程管理 API（核心 CRUD，单租户、暂无鉴权）

**目标**：后端能存取 Record，同时补齐前端 ROADMAP"不能行级编辑/删除"缺口。

- `internal/model/record.go`：`Record` struct 字段对齐 `DATA_SCHEMA.md`（id, kind, startDate, endDate, title, origin, destination, transportNo, departTime, arriveTime, durationMinutes, amountCny, invoiceAmountCny, traveler, people, confidence, countsAsAway, countsAsVisited, showInTimeline, displayLayer, evidence, notes, project, purpose, reimbursement）+ 服务端 `CreatedAt/UpdatedAt`。`People` 等数组以 JSON 文本存列。
- 迁移 `0001_init.sql`：建 `records` 表（`id TEXT PK`、各列、`created_at/updated_at`），索引 `start_date`、`traveler`；预留可空 `user_id` 列（F 阶段启用）。
- `internal/handler/records.go` REST：
  - `GET    /api/v1/records`        列表（支持 `?year=&traveler=&q=`，对齐前端 filter）
  - `GET    /api/v1/records/{id}`   单条
  - `POST   /api/v1/records`        新增（服务端分配 id、校验必填）
  - `PUT    /api/v1/records/{id}`   整条更新（行级编辑，补缺口）
  - `DELETE /api/v1/records/{id}`   删除（行级删除，补缺口）
  - `POST   /api/v1/records:batch`  批量 upsert（D 阶段导入用）
- JSON 字段名/形状严格匹配前端 `normalize()` 期望（驼峰、null 用真 `null`），前端可零改造直接消费。
- 一次性种子：把 `frontend/data/travel-log.json` 的 records 导入 DB（main 加 `--seed` 标志）。
- **验收**：curl 增删改查全通；列表 JSON 能被前端 `normalize()` 吃下。

## 7. 阶段 C — 前端嵌入 + 托管（满足"前端包进二进制"，开发态顺滑）

**目标**：`go run` 一个命令同时提供前端 + API，单端口、免 CORS。

- 嵌入约束：`//go:embed` 只能嵌指令文件所在子树，不能 `..`。`backend/` 是独立 module，故构建前把 `frontend/` 同步到 `backend/web/dist/`（一行 `xcopy`/脚本；因前端无构建步骤，"产出"就是整目录拷贝），再 `//go:embed all:web/dist`。
- `internal/web/embed.go`：导出 `FS()`；`TV_DEV=true` 时改返回 `os.DirFS("../frontend")`（开发态热刷新、免拷贝），生产态返回 embed.FS。
- main.go：根路径走前端静态服务（含 `index.html`），SPA 回退到 `index.html`；`/api/...` 走 API。
- MapLibre 仍走 CDN（先不动；可选后续把 css/js 也 vendor 进 embed 做完全离线，列为后续可选）。
- **验收**：`go run ./cmd/trailvault` → 浏览器 `:8080` 看到完整原前端在跑（数据仍是 localStorage）。

## 8. 阶段 D — 前端数据层切到后端（真正"前后端分离"落地）

**目标**：前端不再用 localStorage，所有读写打 API。

- 新增 `frontend/api.js`：`fetch` 封装，baseURL `/api/v1`，同源带 cookie（为 F 阶段预留）。
- 改 `frontend/app.js`：
  - `loadData()`（app.js:372）→ `GET /api/v1/records`。
  - 表单提交（app.js:3902）→ `POST /api/v1/records`。
  - 清空（app.js:3799）→ `DELETE /api/v1/records`（清空端点）或批量删。
  - 导入（app.js:3822）→ `POST /api/v1/records:batch`（区分"导入替换"与"AI 粘贴合并"两种语义）。
  - 导出 → 从 `GET /api/v1/records` 拼装下载（或加 `?format=csv` 服务端导出）。
- 加行级编辑/删除 UI：账本表格行加"编辑/删除"按钮 → 调 `PUT`/`DELETE`（补 ROADMAP 缺口）。
- 删 localStorage 写入（`STORAGE_KEY` 相关 setItem 全清；城市/铁轨缓存先留前端，后续可选扩展端点托管）。
- **验收**：增删改一条记录 → 刷新仍在（来自 DB）；localStorage 不再变化。

---

## 9. 阶段 E — 界面精简【决策点：到时选删哪些】

到这一步再勾选要删的模块。先无条件清死代码，再按所选去活代码：
- **无条件删**：内部海报弹窗 `#posterModal` + Overpass 管线（`fetchOverpass`/`buildOverpassQuery`/`drawPoster`/`openCityPoster`）+ OCR 粘贴流程（`AI_RECORD_PROMPT`/`tryParseStructuredRecords`/`parseTicketText` 及 `app.js:3835-3871` 控件）+ show-mode（`showMode`/`toggleShowMode`/`applyShowMode`）。
- **候选可删活模块（到时选）**：全部海报 / 动画播放(播放旅程+岁月) / 主题外观(23皮肤+自定义标题+全屏) / 多旅客筛选(有了账号后冗余) / 账本表格 / 统计看板 等。
- 裁 `index.html` 导航 + `app.js` + `app.css`，保持地图/录入/增删改查/导入导出正常。
- **验收**：精简后核心功能仍正常。

## 10. 阶段 F — 用户管理【决策点：到时选用户模型】（当前暂缓）

到时选 单用户自托管 / 邀请制多用户 / 开放注册。默认推荐"单用户自托管"（一个管理员账号、无公开注册），架构仍按 `user_id` 隔离。要点：
- 迁移：`users` 表（id, username, password_hash, role, created_at）；给 `records.user_id` 加非空 + 外键。
- 鉴权：bcrypt 存密码；session cookie（`gorilla/sessions` 或自写 securecookie）；`POST /api/v1/auth/login`、`POST /api/v1/auth/logout`、`GET /api/v1/auth/me`。
- 中间件：`/api/v1/*`（除 login）要求登录；所有 records 查询按当前 `user_id` 过滤。
- 前端：加登录页 + nav 登出；未登录跳登录。
- 首启：按 `TV_ADMIN_USER`/`TV_ADMIN_PASS` 建管理员。
- **验收**：未登录被拦；登录后只见自己的 records。

## 11. 阶段 G — OCR 识别【决策点：到时选 OCR 引擎】

到时选 LLM 视觉 API / 自托管 Tesseract / 云 OCR。默认推荐 LLM 视觉 API。要点：
- 后端 `POST /api/v1/ocr`（multipart 图）→ 调所选引擎 → 返回结构化 record 候选 JSON。
  - LLM 路径：后端把图 + 迁移到后端的 `AI_RECORD_PROMPT`（app.js:219）发给视觉模型 → 取回 JSON。
- 照片存储：上传图存到二进制旁 `./data/uploads/`（文件系统，DB 存路径 + mime），推荐文件系统。
- 前端：重开"录入"面板 OCR 入口：选票图 → 调 `/ocr` → 预览解析出的 record → 表单改 → `POST /records` 入库。
- **验收**：拍/截一张火车票 → 上传 → 自动填好一条行程 → 保存入库。

---

## 12. 执行方式与里程碑

- 批准后从**阶段 A** 开始，A→B→C→D 连续推进（都不依赖待定决策）；D 结束即得到"可用的前后端分离、单二进制、数据落 SQLite"版本。
- 到 E/F/G 在各自开头确认选择后再动手。
- 每阶段均有明确验收标准，可独立交付、随时暂停。

| 里程碑 | 内容 | 是否需决策 |
|---|---|---|
| M1 | 阶段 A 完成：后端可跑、DB 连通、health 通过 | 否 |
| M2 | 阶段 B 完成：旅程 CRUD 可用 | 否 |
| M3 | 阶段 C 完成：单二进制托管前端 | 否 |
| M4 | 阶段 D 完成：前端数据层切后端、行级编辑/删除 | 否 |
| M5 | 阶段 E 完成：界面精简 | 是（删哪些） |
| M6 | 阶段 F 完成：用户管理 | 是（用户模型） |
| M7 | 阶段 G 完成：OCR 识别 | 是（OCR 引擎） |
