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

	//todo:部署的时候修改为./dist
	srv := server.New(&cfg.Server, "../frontend", db, log)

	if err := srv.Run(); err != nil {
		log.Error("Server init failed", zap.String("error_info", err.Error()))
		return
	}
}
