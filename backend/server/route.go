package server

import (
	"fmt"
	"html"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/LeoTao777/travil-vault/backend/config"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// registerRoutes 注册所有 HTTP 路由：业务 API + 前端（dev 反代 / 产物托管 / SPA 兜底）。
// 随着接口增多，可在此按模块拆分（如 api.Group("/v1")）。
func (s *Server) registerRoutes(r *gin.Engine) {
	// --- 业务 API ---
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// API: 获取用户列表
	r.GET("/api/users", s.userHandler.GetUserList)

	// API: 获取旅行记录数据
	r.GET("/api/records", s.travelRecordHandler.GetTravelRecordList)

	// API: 根据用户名获取旅行记录数据
	r.GET("/api/records/user/:username", s.travelRecordHandler.GetTRListByUserName)

	// API: 创建旅行记录（录入页「加入地图」按钮 → POST /api/records）
	r.POST("/api/records", s.travelRecordHandler.CreateTravelRecord)

	// API: 更新 / 删除旅行记录（待实现，见 docs/FRONTEND_VUE3_PLAN.md §10）
	// r.PUT("/api/records/:id", s.travelRecordHandler.UpdateTravelRecord)
	// r.DELETE("/api/records/:id", s.travelRecordHandler.DeleteTravelRecord)

	// --- 前端 ---
	s.registerStatic(r)
}

// registerStatic 决定 `/` 这类非接口请求由谁响应，优先级：
//
//  1. dev 模式且配置了 frontend.devproxy → 整体反代给 Vite dev server（含 HMR 的 websocket 升级），
//     这样开发期打开 8080 和打开 5173 看到的是同一个应用，不用记两个端口。
//     Vite 没起时不会白屏，返回一页「dev server 未启动」的说明。
//  2. 命中前端目录里的真实文件（/assets/*、/data/*.json…）→ 直接发送并给缓存头。
//  3. 未命中的 /api/*、/health → JSON 404（绝不能把 index.html 当接口返回值）。
//  4. 带扩展名但文件不存在（丢失的 assets/xxx.js）→ 404，避免把 HTML 喂给 <script>。
//  5. 其余路径（/、/archive、/record、/?focus=x）→ 回 index.html，交给前端路由，
//     这是深链能直接刷新、能被分享的前提。
func (s *Server) registerStatic(r *gin.Engine) {
	root, err := filepath.Abs(s.frontendDir)
	if err != nil {
		root = s.frontendDir
	}
	indexFile := filepath.Join(root, "index.html")

	if _, statErr := os.Stat(indexFile); statErr != nil {
		s.log.Warn("前端入口未找到，静态托管不可用（开发时请用 Vite dev server）",
			zap.String("root", root),
			zap.String("hint", "cd frontend && npm run build"),
		)
	}

	// 托管的是 Vite「源码目录」而不是构建产物时，浏览器无法执行 /src/main.ts（TypeScript），
	// 页面必然白屏。不静默：启动日志报错，必要时返回可执行的修复指引页。
	sourceOnly := isViteSourceRoot(indexFile)

	devProxy := s.newDevProxy(root)
	if devProxy != nil {
		s.log.Info("前端请求将反代到 Vite dev server",
			zap.String("devproxy", s.cfg.DevProxy()),
			zap.String("note", "npm run dev 起前端后，8080 与 5173 看到的是同一个应用"),
		)
	} else if sourceOnly {
		s.log.Error("当前托管的是 Vite 源码目录，页面会白屏（浏览器无法执行 /src/*.ts）",
			zap.String("root", root),
			zap.String("fix_dev", "cd frontend && npm run dev 后重启后端（或配置 frontend.devproxy）"),
			zap.String("fix_static", "cd frontend && npm run build 后重启后端"),
		)
	}

	r.NoRoute(func(c *gin.Context) {
		reqPath := c.Request.URL.Path

		if isAPIPath(reqPath) {
			c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
			return
		}
		if c.Request.Method != http.MethodGet && c.Request.Method != http.MethodHead {
			c.Status(http.StatusMethodNotAllowed)
			return
		}

		// 1) 开发期：交给 Vite dev server（HMR 直连，8080 也能实时更新）
		if devProxy != nil {
			devProxy.ServeHTTP(c.Writer, c.Request)
			return
		}

		// 2) 真实文件
		if file, ok := staticFile(root, reqPath); ok {
			c.Header("Cache-Control", cacheControl(file, s.cfg.Server.Mode))
			c.File(file)
			return
		}

		// 3) 像是静态文件却找不到 → 404
		if path.Ext(path.Clean(reqPath)) != "" {
			c.Status(http.StatusNotFound)
			return
		}

		if _, statErr := os.Stat(indexFile); statErr != nil {
			c.String(http.StatusNotFound, "frontend build not found: %s", indexFile)
			return
		}

		// 4) 源码目录 + 未构建：回 index.html 只会白屏，改回一页说明
		if sourceOnly {
			c.Header("Content-Type", "text/html; charset=utf-8")
			c.String(http.StatusOK, diagnosticPage(root, "", nil))
			return
		}

		// 入口 HTML 必须每次协商，否则发新版后用户会一直跑旧壳子
		c.Header("Cache-Control", "no-cache")
		c.File(indexFile)
	})
}

// newDevProxy 按配置构造指向 Vite dev server 的反代；不该反代时返回 nil。
//
// 注意：dev 模式下一旦配置了 frontend.devproxy，就以 devproxy 为准（即使 dist 已构建），
// 因为此时你要的是热更新。想在 8080 上看构建产物：注释掉 devproxy，或把 mode 改成 release。
// dev server 没起时不会白屏 —— ErrorHandler 会返回一页说明，起好 Vite 后刷新即可，无需重启后端。
func (s *Server) newDevProxy(root string) *httputil.ReverseProxy {
	target := s.cfg.DevProxy()
	if target == "" {
		return nil
	}

	u, err := url.Parse(target)
	if err != nil || u.Scheme == "" || u.Host == "" {
		s.log.Warn("frontend.devproxy 无法解析，已忽略",
			zap.String("devproxy", target),
			zap.Error(err),
		)
		return nil
	}

	proxy := httputil.NewSingleHostReverseProxy(u)
	// 默认 Director 不改写 Host：Vite 会对 Host 做校验，改成目标 host 更稳。
	setDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		setDirector(req)
		req.Host = u.Host
	}
	proxy.ErrorHandler = func(w http.ResponseWriter, req *http.Request, proxyErr error) {
		if req.URL.Path == "/" {
			s.log.Warn("Vite dev server 不可达，请确认 npm run dev 已启动",
				zap.String("devproxy", target),
				zap.Error(proxyErr),
			)
		}
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.WriteHeader(http.StatusBadGateway)
		_, _ = w.Write([]byte(diagnosticPage(root, target, proxyErr)))
	}
	return proxy
}

// isAPIPath 判断是否是后端接口前缀（这些路径失败时必须回 JSON，而不是 SPA 页面）。
func isAPIPath(p string) bool {
	return p == "/api" || strings.HasPrefix(p, "/api/") || p == "/health"
}

// staticFile 把 URL 路径解析为前端目录下的真实文件。
// 目录、越出根目录的路径、不存在的文件都返回 false。
func staticFile(root, urlPath string) (string, bool) {
	clean := path.Clean("/" + strings.TrimPrefix(urlPath, "/"))
	if clean == "/" {
		return "", false
	}

	file := filepath.Join(root, filepath.FromSlash(clean))
	if file != root && !strings.HasPrefix(file, root+string(os.PathSeparator)) {
		return "", false // 防目录穿越：/../backend/...
	}

	info, err := os.Stat(file)
	if err != nil || info.IsDir() {
		return "", false
	}
	return file, true
}

// isViteSourceRoot 判断 index.html 是 Vite 的「源码入口」而非构建产物。
// 源码入口里直接写着 /src/main.ts（TS），只有 Vite dev server 能编译它；
// 构建产物一定是 /assets/index-<hash>.js。
func isViteSourceRoot(indexFile string) bool {
	data, err := os.ReadFile(indexFile)
	if err != nil {
		return false
	}
	s := string(data)
	return strings.Contains(s, `src="/src/`) || strings.Contains(s, `src='/src/`)
}

// cacheControl 按文件类型给缓存策略：
//   - 开发模式一律禁缓存，前端改完普通刷新即生效；
//   - 生产：Vite 的 /assets/* 带内容 hash → 长缓存 immutable；
//     入口 HTML → no-cache（每次协商，保证发版后立刻拿到新壳）；
//     其余（/data/*.json 等）→ 1 小时。
func cacheControl(file string, mode config.Devmode) string {
	if mode == config.Dev {
		return "no-store, no-cache, must-revalidate"
	}

	slash := filepath.ToSlash(file)
	switch {
	case strings.Contains(slash, "/assets/"):
		return "public, max-age=31536000, immutable"
	case strings.HasPrefix(path.Base(slash), "index."):
		return "no-cache"
	default:
		return "public, max-age=3600"
	}
}

// diagnosticPage 是前端没跑起来时的说明页，用来替代白屏。
// devProxy 非空表示「配了反代但连不上 Vite」，否则表示「托管了未构建的源码目录」。
func diagnosticPage(root, devProxy string, dialErr error) string {
	var reason, detail string
	if devProxy != "" {
		errText := "连接被拒绝"
		if dialErr != nil {
			errText = dialErr.Error()
		}
		reason = "反代目标 Vite dev server 没有响应"
		detail = fmt.Sprintf(
			`<p>后端已配置把页面请求反代到 <code>%s</code>，但连接失败：<code>%s</code>。</p>
      <p>多半是前端开发服务器还没启动，或者端口不是 5173。</p>`,
			html.EscapeString(devProxy), html.EscapeString(errText),
		)
	} else {
		reason = "前端还没构建"
		detail = fmt.Sprintf(
			`<p class="warn">当前 Gin 托管的是 <b>Vite 源码目录</b>：<code>%s</code></p>
      <p>它的 <code>index.html</code> 直接引用了 <code>/src/main.ts</code>（TypeScript），
      只有 Vite 开发服务器能编译；交给浏览器只会报模块错误并白屏。</p>`,
			html.EscapeString(root),
		)
	}

	return fmt.Sprintf(`<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><title>前端未就绪 · TrailVault</title>
<style>
  body{margin:0;min-height:100vh;display:grid;place-items:center;background:#fbfaf4;color:#141414;
    font-family:Georgia,"Songti SC",serif;padding:32px}
  .card{max-width:680px;border:1px solid #d8d0c1;border-radius:10px;padding:28px 30px;background:#fff}
  h1{margin:0 0 6px;font-size:22px}
  .kicker{margin:0 0 18px;font-family:system-ui,sans-serif;font-size:11px;letter-spacing:.22em;color:#777064}
  p{margin:0 0 12px;line-height:1.75;font-size:15px;color:#3f3c36}
  code,pre{font-family:Menlo,Consolas,monospace;font-size:13px}
  .warn{border-left:3px solid #b84232;padding-left:12px;color:#b84232}
  ol{padding-left:22px;line-height:2}
  .tip{color:#777064;font-size:13px}
</style></head>
<body><div class="card">
  <p class="kicker">TRAILVAULT · FRONTEND NOT READY</p>
  <h1>%s</h1>
  %s
  <p><b>开发（热更新，推荐）</b></p>
  <ol>
    <li><code>cd frontend</code></li>
    <li><code>npm install</code>（首次）</li>
    <li><code>npm run dev</code> → 打开 <b>http://localhost:5173</b>，或直接刷新本页</li>
  </ol>
  <p><b>或者：构建产物交给后端托管</b></p>
  <ol>
    <li><code>cd frontend &amp;&amp; npm run build</code></li>
    <li>重启后端（<code>go run .</code>）后刷新本页</li>
  </ol>
  <p class="tip">后端接口不受影响，可直接访问 <a href="/api/records">/api/records</a>。
  提示：dev 模式下配了 <code>frontend.devproxy</code> 时，dev server 一起好，本页刷新即恢复，不必重启后端。</p>
</div></body></html>`, html.EscapeString(reason), detail)
}
