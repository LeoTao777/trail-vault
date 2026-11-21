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

// Server 封装 Gin 引擎、业务依赖与前端托管配置。
type Server struct {
	cfg                 *config.Config
	frontendDir         string // 前端托管目录：dev 可能是 Vite 源码目录，release 是 dist
	userService         service.UserService
	userHandler         *handler.UserHandler
	travelRecordService service.TravelRecordService
	travelRecordHandler *handler.TravelRecordHandler
	log                 *zap.Logger
}

func New(cfg *config.Config, db *gorm.DB, log *zap.Logger) *Server {
	userRepo := repository.NewUserRepository(db)
	userService := service.NewUserService(userRepo)
	userHandler := handler.NewUserHandler(userService)

	travelRecordRepo := repository.NewTravelRecordRepository(db)
	travelRecordService := service.NewTravelRecordService(travelRecordRepo)
	travelRecordHandler := handler.NewTravelRecordHandler(travelRecordService)

	return &Server{
		cfg:                 cfg,
		frontendDir:         cfg.StaticDir(),
		userService:         userService,
		userHandler:         userHandler,
		travelRecordService: travelRecordService,
		travelRecordHandler: travelRecordHandler,
		log:                 log,
	}
}

// Run 根据 host:port 启动 HTTP 服务。
func (s *Server) Run() error {
	gin.SetMode(toGinMode(s.cfg.Server.Mode))

	r := gin.Default()
	s.registerRoutes(r) // 路由注册见 route.go

	addr := fmt.Sprintf("%s:%d", s.cfg.Server.Host, s.cfg.Server.Port)
	s.log.Info("listening on",
		zap.String("addr", addr),
		zap.String("frontend", s.frontendDir),
		zap.String("mode", string(s.cfg.Server.Mode)),
		zap.String("devproxy", s.cfg.DevProxy()),
	)
	return r.Run(addr)
}

// toGinMode 将配置中的 dev/release 映射为 Gin 的 debug/release 模式。
func toGinMode(mode config.Devmode) string {
	switch mode {
	case config.Release:
		return gin.ReleaseMode
	default:
		return gin.DebugMode
	}
}
