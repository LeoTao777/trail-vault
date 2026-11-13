package model

import "time"

// TravelRecord 旅行记录模型：字段与前端录入表单 / docs/DATA_SCHEMA.md 对齐。
// 日期、时刻按前端格式（YYYY-MM-DD / HH:MM）直接存字符串，避免 JSON 里
// time.Time 只接受 RFC3339、而前端传的是短格式导致绑定失败。
type TravelRecord struct {
	ID               string    `gorm:"primaryKey;size:64" json:"id"`
	Kind             string    `gorm:"size:32" json:"kind"`
	StartDate        string    `gorm:"size:10;index" json:"startDate"`
	EndDate          string    `gorm:"size:10" json:"endDate"`
	Title            string    `gorm:"size:255" json:"title"`
	Origin           string    `gorm:"size:255" json:"origin"`
	Destination      string    `gorm:"size:255" json:"destination"`
	TransportNo      string    `gorm:"size:64" json:"transportNo"`
	DepartTime       string    `gorm:"size:8" json:"departTime"`
	ArriveTime       string    `gorm:"size:8" json:"arriveTime"`
	DurationMinutes  *int      `json:"durationMinutes"`
	AmountCny        *float64  `json:"amountCny"`
	InvoiceAmountCny *float64  `json:"invoiceAmountCny"`
	Traveler         string    `gorm:"size:128;index" json:"traveler"`
	People           []string  `gorm:"serializer:json" json:"people"`
	Confidence       string    `gorm:"size:32" json:"confidence"`
	CountsAsAway     bool      `json:"countsAsAway"`
	CountsAsVisited  bool      `json:"countsAsVisited"`
	ShowInTimeline   bool      `json:"showInTimeline"`
	DisplayLayer     string    `gorm:"size:32" json:"displayLayer"`
	Evidence         string    `gorm:"size:255" json:"evidence"`
	Project          string    `gorm:"size:255" json:"project"`
	Notes            string    `json:"notes"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (TravelRecord) TableName() string {
	return "travels"
}
