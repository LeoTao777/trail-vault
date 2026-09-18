package service

import (
	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"github.com/LeoTao777/travil-vault/backend/internal/repository"
)

// TravelRecordService 旅游记录服务接口
type TravelRecordService interface {
	GetTravelRecordList() ([]model.TravelRecord, error)
	GetTRListByUserName(username string) ([]model.TravelRecord, error)
	GetTRListByID(id int64) (*model.TravelRecord, error)
	CreateTravelRecord(record *model.TravelRecord) error
}

type travelRecordService struct {
	repo repository.TravelRecordRepository
}

// TravelRecordService 创建旅游记录服务实例
func NewTravelRecordService(repo repository.TravelRecordRepository) TravelRecordService {
	return &travelRecordService{repo: repo}
}

func (s *travelRecordService) GetTravelRecordList() ([]model.TravelRecord, error) {
	return s.repo.ListAll()
}

func (s *travelRecordService) GetTRListByUserName(username string) ([]model.TravelRecord, error) {
	return s.repo.GetByUsername(username)
}

func (s *travelRecordService) GetTRListByID(id int64) (*model.TravelRecord, error) {
	return s.repo.GetByRecordID(id)
}

func (s *travelRecordService) CreateTravelRecord(record *model.TravelRecord) error {
	return s.repo.Create(record)
}
