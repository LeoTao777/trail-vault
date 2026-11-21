# trail-vault

A self‑hosted travel journal for recording journeys, marking map locations and archiving travel photos

## Reference Projects

This project is built upon **[journey‑atlas](https://github.com/NovaKepler513/journey-atlas.git)**.
The original frontend provides map‑centered journey editing purely on client‑side localStorage.
TrailVault extends it with a Go‑based backend to bring persistent storage, user management and photo archiving features.

## 结构

```
backend/    Go (Gin + GORM + SQLite)：/api/records、/api/users，并托管前端产物
frontend/   Vue 3 + TypeScript + Vite：三条路由（地图·时间线 / 录入 / 旅行档案）
docs/       重构计划与设计文档
```

## 快速开始

> dev 模式下 `frontend.devproxy`（默认 `http://127.0.0.1:5173`）会把页面请求反代给 Vite，
> 所以 **5173 和 8080 看到的是同一个应用**。生产（`mode: release`）只托管 `frontend/dist`，
> 未构建时 8080 会给出说明页而不是白屏。

```bash
# 1) 前端（开发，热更新）
cd frontend
npm install
npm run dev            # http://localhost:5173 ，/api 反代到 8080

# 2) 后端（另开终端，提供接口）
cd backend
go run .               # http://127.0.0.1:8080
```

生产/联调一体（前端构建产物由 Gin 托管，含 SPA 兜底）：

```bash
cd frontend && npm run build
cd ../backend && go run .   # 构建后必须重启；或把 frontend.devproxy 置空
# 打开 http://127.0.0.1:8080/ 、 /record 、 /archive 均应正常（可直接刷新）
```

## 页面规划

| 路由 | 页面 |
| --- | --- |
| `/` | 主页：地图 + 时间线（默认） |
| `/record` | 录入（含导入/导出、清空、重载等数据工具） |
| `/archive` | 旅行档案：统计榜 + 资料明细 |

当前进度与验收标准见 **[`docs/FRONTEND_VUE3_PLAN.md`](docs/FRONTEND_VUE3_PLAN.md)**。
前端开发说明见 **[`frontend/README.md`](frontend/README.md)**。
