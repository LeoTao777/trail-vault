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

	// API: 获取用户列表
	r.GET("/api/users", s.userHandler.GetUserList)

	// API: 获取旅行记录数据
	r.GET("/api/records", func(c *gin.Context) {
		// 在实际应用中，这里应该从数据库或文件系统读取数据
		// 这里我们模拟返回一些示例数据
		c.JSON(200, gin.H{
			"records": []interface{}{}, // 空数组，实际应用中应该返回真实数据
			"meta": gin.H{
				"total":       0,
				"lastUpdated": "2023-01-01T00:00:00Z",
			},
		})
	})

	// --- 前端静态资源兜底 ---
	// 未匹配的路由（首页 / 及 app.css、app.js、data/*.js 等）交由 FileServer 托管，
	// 不影响 /health 等已注册路由。调试指向源文件目录，部署指向打包产物目录。
	//后期修改为监听/ 跳转到首页
	fileServer := http.FileServer(http.Dir(s.frontendDir))
	r.NoRoute(func(c *gin.Context) {
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
}
