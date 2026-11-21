# 运行时静态资源（不打包进 JS bundle）

`vite build` 会把本目录原样复制到 `dist/data/`，后端按 `/data/*` 直接托管。

P3（地图舞台）会把旧版 `frontend/data/` 里的大文件迁到这里，并按视图按需 `fetch`：

| 文件 | 用途 | 加载时机 |
| --- | --- | --- |
| `china-100000-full.json` | 中国省级行政区 GeoJSON | 切到「中国」视图 |
| `world-110m.json` | 世界国家边界拓扑 | 切到「世界」视图 |
| `water-china.json` | 中国水域底图 | 中国视图首次可见时 |
| `rail-paths.json` | 预计算的真实铁路轨迹 | 含铁路段时 |

约定：

- 这些资源**不要** `import` 进 `src`，否则会被打进 bundle（单文件可达数 MB）。
- 小配置（配色主题 / 色板 / 演示数据）仍放 `src/domain` 或 `src/data`，走 ES 模块。
- 迁移期旧文件仍在 `frontend/data/`，P3 完成后删除。
