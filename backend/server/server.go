package server

import (
	"fmt"

	"github.com/LeoTao777/travil-vault/backend/config"
	"github.com/LeoTao777/travil-vault/backend/internal/handler"
	"github.com/LeoTao777/travil-vault/backend/internal/repository"
	"github.com/LeoTao777/travil-vault/backend/internal/service"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Server 封装 Gin 引擎与监听地址。
type Server struct {
	cfg         *config.ServerConfig
	frontendDir string // 调试：前端静态文件目录；部署时改为打包产物目录
	userService service.UserService
	userHandler *handler.UserHandler
	log         *zap.Logger
}

func New(srvCfg *config.ServerConfig, frontendDir string, db *gorm.DB, log *zap.Logger) *Server {
	userRepo := repository.NewUserRepository(db)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	return &Server{
		cfg:         srvCfg,
		frontendDir: frontendDir,
		userService: userService,
		userHandler: userHandler,
		log:         log,
	}
}

// Run 根据 host:port 启动 HTTP 服务。
func (s *Server) Run() error {
	gin.SetMode(toGinMode(s.cfg.Mode))

	r := gin.Default()
	s.registerRoutes(r) // 路由注册见 route.go

	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	s.log.Info("listening on",
		zap.String("addr", addr),
		zap.String("frontend", s.frontendDir),
	)
	return r.Run(addr)
}

// toGinMode 将配置中的 dev/release 映射为 Gin 的 debug/release 模式。
func toGinMode(m config.Devmode) string {
	switch m {
	case config.Release:
		return gin.ReleaseMode
	default:
		return gin.DebugMode
	}
}
