package main

import (
	"github.com/LeoTao777/travil-vault/backend/config"
	"github.com/LeoTao777/travil-vault/backend/internal/database"
	"github.com/LeoTao777/travil-vault/backend/internal/pkgutil"
	"github.com/LeoTao777/travil-vault/backend/pkg/logger"
	"github.com/LeoTao777/travil-vault/backend/server"
	"go.uber.org/zap"
)

func main() {
	cfg, err := config.Load("config/configs/app.yaml")
	if err != nil {
		panic(err)
	}

	log, err := logger.New(cfg.Log)
	if err != nil {
		panic(err)
	}
	defer log.Sync()

	db, err := database.Init(cfg.Database.Path)
	if err != nil {
		log.Error("DataBase init failed", zap.String("error_info", err.Error()))
		return
	}
	log.Info("DataBase init successed")

	//初始化雪花算法单例
	if err := pkgutil.Init(1001); err != nil {
		log.Error("SnowFlake init failed", zap.String("error_info", err.Error()))
		return
	}
	log.Info("SnowFlake init successed")

	// 前端静态目录与开发期反代由配置决定：
	//   dev 模式 + frontend.devproxy → 非 /api 请求反代给 Vite dev server（热更新）；
	//   dev 模式（无 devproxy）→ 优先托管已构建的 ../frontend/dist，否则回落源码目录；
	//   release 模式 → 只托管 ../frontend/dist。
	// 见 config.FrontendConfig / config.StaticDir() / config.DevProxy()。
	srv := server.New(cfg, db, log)

	if err := srv.Run(); err != nil {
		log.Error("Server init failed", zap.String("error_info", err.Error()))
		return
	}
}
