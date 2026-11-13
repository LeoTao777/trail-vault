package service

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"github.com/LeoTao777/travil-vault/backend/internal/pkgutil"
	"github.com/LeoTao777/travil-vault/backend/internal/repository"
)

// ErrInvalidRecord 表示创建记录时必填校验未通过（handler 据此返回 400）。
var ErrInvalidRecord = errors.New("invalid travel record")

// TravelRecordService 旅游记录服务接口
type TravelRecordService interface {
	GetTravelRecordList() ([]model.TravelRecord, error)
	GetTRListByUserName(username string) ([]model.TravelRecord, error)
	GetTRListByID(id string) (*model.TravelRecord, error)
	CreateTravelRecord(record *model.TravelRecord) error
}

type travelRecordService struct {
	repo repository.TravelRecordRepository
}

// NewTravelRecordService 创建旅游记录服务实例
func NewTravelRecordService(repo repository.TravelRecordRepository) TravelRecordService {
	return &travelRecordService{repo: repo}
}

func (s *travelRecordService) GetTravelRecordList() ([]model.TravelRecord, error) {
	return s.repo.ListAll()
}

func (s *travelRecordService) GetTRListByUserName(username string) ([]model.TravelRecord, error) {
	return s.repo.GetByUsername(username)
}

func (s *travelRecordService) GetTRListByID(id string) (*model.TravelRecord, error) {
	return s.repo.GetByRecordID(id)
}

// CreateTravelRecord 校验必填、补齐前端 normalize() 同款默认值，未带 id 时用雪花算法生成。
func (s *travelRecordService) CreateTravelRecord(record *model.TravelRecord) error {
	if record == nil {
		return fmt.Errorf("%w: record is nil", ErrInvalidRecord)
	}
	if record.StartDate == "" || record.Origin == "" {
		return fmt.Errorf("%w: startDate 与 origin 为必填", ErrInvalidRecord)
	}
	if record.EndDate == "" {
		record.EndDate = record.StartDate
	}
	if record.Destination == "" {
		record.Destination = record.Origin
	}
	if record.Title == "" {
		record.Title = record.Origin
		if record.Destination != record.Origin {
			record.Title = record.Origin + " → " + record.Destination
		}
	}
	if record.Kind == "" {
		record.Kind = "other"
	}
	if record.Confidence == "" {
		record.Confidence = "pending"
	}
	if record.DisplayLayer == "" {
		record.DisplayLayer = "journey"
	}
	if len(record.People) == 0 && record.Traveler != "" {
		record.People = []string{record.Traveler}
	}
	if record.ID == "" {
		id, err := pkgutil.Next()
		if err != nil {
			return fmt.Errorf("生成记录 ID 失败: %w", err)
		}
		record.ID = strconv.FormatInt(id, 10)
	}
	return s.repo.Create(record)
}
