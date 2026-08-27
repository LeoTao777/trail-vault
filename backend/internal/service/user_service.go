package service

import (
	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"github.com/LeoTao777/travil-vault/backend/internal/repository"
)

// UserService 用户服务接口
type UserService interface {
	GetUserList() ([]model.User, error)
	GetUserByUsername(username string) (*model.User, error)
	CreateUser(user *model.User) error
}

type userService struct {
	repo repository.UserRepository
}

// NewUserService 创建用户服务实例
func NewUserService(repo repository.UserRepository) UserService {
	return &userService{repo: repo}
}

func (s *userService) GetUserList() ([]model.User, error) {
	return s.repo.List()
}

func (s *userService) GetUserByUsername(username string) (*model.User, error) {
	return s.repo.GetByUsername(username)
}

func (s *userService) CreateUser(user *model.User) error {
	return s.repo.Create(user)
}
