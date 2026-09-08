package model

import "time"

// User 用户模型
type TravelRecord struct {
	ID             int64     `gorm:"primaryKey" json:"id"`
	Traveler       string    `json:"traveler"`
	Title          string    `json:"title"`
	StartDate      time.Time `json:"start_date"`
	EndDate        time.Time `json:"updated_at"`
	Origin         string    `json:"origin"`
	Destination    string    `json:"destination"`
	DepartTime     time.Time `json:"departTime"`
	ArriveTime     time.Time `json:"arriveTime"`
	ShowInTimeline bool      `json:"showInTimeline"`
	Notes          string    `json:"notes"`
}

// TableName 指定表名
func (TravelRecord) TableName() string {
	return "travels"
}
