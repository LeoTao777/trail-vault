package server

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// registerRoutes 注册所有 HTTP 路由：业务 API + 前端静态资源兜底。
// 随着接口增多，可在此按模块拆分（如 api.Group("/v1")）。
func (s *Server) registerRoutes(r *gin.Engine) {
	// --- 业务 API ---
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// --- 前端静态资源兜底 ---
	// 未匹配的路由（首页 / 及 app.css、app.js、data/*.js 等）交由 FileServer 托管，
	// 不影响 /health 等已注册路由。调试指向源文件目录，部署指向打包产物目录。
	fileServer := http.FileServer(http.Dir(s.frontendDir))
	r.NoRoute(func(c *gin.Context) {
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
}
