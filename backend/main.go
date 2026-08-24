package main

import (
	"fmt"
	"log"

	"github.com/LeoTao777/travil-vault/backend/config"
	"github.com/LeoTao777/travil-vault/backend/server"
)

func main() {
	fmt.Println("===Init project===")
	cfg, err := config.Load("config/configs/app.yaml")
	if err != nil {
		log.Fatal(err)
	}
	srv := server.New(&cfg.Server, "../frontend")

	if err := srv.Run(); err != nil {
		log.Fatal(err)
	}
}
