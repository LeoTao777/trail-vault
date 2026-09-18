package repository

import (
	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"gorm.io/gorm"
)

// TravelRecordRepository 旅行记录数据访问接口
type TravelRecordRepository interface {
	ListAll() ([]model.TravelRecord, error)
	GetByUsername(username string) ([]model.TravelRecord, error)
	GetByRecordID(id int64) (*model.TravelRecord, error)
	Create(record *model.TravelRecord) error
}

type travelRecordRepository struct {
	db *gorm.DB
}

func NewTravelRecordRepository(db *gorm.DB) TravelRecordRepository {
	return &travelRecordRepository{db: db}
}

func (r *travelRecordRepository) ListAll() ([]model.TravelRecord, error) {
	var records []model.TravelRecord
	if err := r.db.Find(records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (r *travelRecordRepository) GetByUsername(username string) ([]model.TravelRecord, error) {
	var records []model.TravelRecord
	if err := r.db.
		Where("username = ?", username).
		Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (r *travelRecordRepository) GetByRecordID(id int64) (*model.TravelRecord, error) {
	var record *model.TravelRecord
	if err := r.db.
		Where("id = ?", id).
		First(*record).Error; err != nil {
		return nil, err
	}
	return record, nil
}

func (r *travelRecordRepository) Create(record *model.TravelRecord) error {
	return r.db.Create(record).Error
}
