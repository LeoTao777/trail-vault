package main

import (
	"fmt"
	"log"

	"github.com/LeoTao777/travil-vault/backend/config"
	"github.com/LeoTao777/travil-vault/backend/internal/database"
	"github.com/LeoTao777/travil-vault/backend/server"
)

func main() {
	fmt.Println("===Init project===")
	cfg, err := config.Load("config/configs/app.yaml")
	if err != nil {
		log.Fatal(err)
	}

	db, err := database.Init(cfg.Database.Path)
	if err != nil {
		log.Fatal(err)
	}

	//todo:部署的时候修改为./dist
	srv := server.New(&cfg.Server, "../frontend", db)

	if err := srv.Run(); err != nil {
		log.Fatal(err)
	}
}
