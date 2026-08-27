package repository

import (
	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"gorm.io/gorm"
)

// UserRepository 用户数据访问接口。
type UserRepository interface {
	List() ([]model.User, error)
	GetByUsername(username string) (*model.User, error)
	Create(user *model.User) error
}

type userRepository struct {
	db *gorm.DB
}

// NewUserRepository 创建基于 GORM 的用户仓储实现。
func NewUserRepository(db *gorm.DB) UserRepository {
	return &userRepository{db: db}
}

func (r *userRepository) List() ([]model.User, error) {
	var users []model.User
	if err := r.db.Find(&users).Error; err != nil {
		return nil, err
	}
	return users, nil
}

func (r *userRepository) GetByUsername(username string) (*model.User, error) {
	var user model.User
	if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *userRepository) Create(user *model.User) error {
	return r.db.Create(user).Error
}
