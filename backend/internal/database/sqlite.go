package database

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/glebarez/sqlite"
	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"gorm.io/gorm"
)

// Init 打开 SQLite 数据库连接并执行自动迁移。
// dbPath 为数据库文件路径，其所在目录会自动创建。
func Init(dbPath string) (*gorm.DB, error) {
	if dir := filepath.Dir(dbPath); dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create db dir %s: %w", dir, err)
		}
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("open sqlite %s: %w", dbPath, err)
	}

	if err := db.AutoMigrate(&model.User{}); err != nil {
		return nil, fmt.Errorf("auto migrate: %w", err)
	}

	// 临时插入默认用户 leotao（已存在则跳过）
	var exist model.User
	if err := db.Where("username = ?", "leotao").First(&exist).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			if err := db.Create(&model.User{
				Username: "leotao",
				Password: "leotao123456",
				Email:    "leotao@trail-vault.dev",
			}).Error; err != nil {
				return nil, fmt.Errorf("seed default user: %w", err)
			}
		} else {
			return nil, fmt.Errorf("query default user: %w", err)
		}
	}
	return db, nil
}
