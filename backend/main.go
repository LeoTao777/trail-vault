package main

import (
	"fmt"
	"log"

	"github.com/LeoTao777/travil-vault/backend/config"
)

func main() {
	fmt.Println("===Init project===")
	cfg, err := config.Load("config/configs/app.yaml")
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(cfg.Server.Host, cfg.Server.Port, cfg.Server.Mode, cfg.Log.Level)
}
