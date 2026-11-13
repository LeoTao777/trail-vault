package server

import (
	"net/http"

	"github.com/LeoTao777/travil-vault/backend/config"
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
	r.GET("/api/records", s.travelRecordHandler.GetTravelRecordList)

	// API: 根据用户名获取旅行记录数据
	r.GET("/api/records/user/:username", s.travelRecordHandler.GetTRListByUserName)

	// API: 创建旅行记录（录入面板「加入地图」按钮 → POST /api/records）
	r.POST("/api/records", s.travelRecordHandler.CreateTravelRecord)

	// API: 更新旅行记录
	// r.PUT("/api/records/:id", s.travelRecordHandler.UpdateTravelRecord)

	// --- 前端静态资源兜底 ---
	// 未匹配的路由（首页 / 及 app.css、app.js、data/*.js 等）交由 FileServer 托管，
	// 不影响 /health 等已注册路由。调试指向源文件目录，部署指向打包产物目录。
	//后期修改为监听/ 跳转到首页
	fileServer := http.FileServer(http.Dir(s.frontendDir))
	r.NoRoute(func(c *gin.Context) {
		if s.cfg.Mode == config.Dev {
			// 开发模式禁用静态资源缓存：前端改完普通刷新即生效，不必重启服务或硬刷新
			c.Header("Cache-Control", "no-store, no-cache, must-revalidate")
		}
		fileServer.ServeHTTP(c.Writer, c.Request)
	})
}
