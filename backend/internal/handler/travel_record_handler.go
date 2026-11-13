package handler

import (
	"errors"
	"net/http"
	"time"

	"github.com/LeoTao777/travil-vault/backend/internal/model"
	"github.com/LeoTao777/travil-vault/backend/internal/service"
	"github.com/gin-gonic/gin"
)

// TravelRecordHandler 旅行记录处理器
type TravelRecordHandler struct {
	travelRecordService service.TravelRecordService
}

// NewTravelRecordHandler 创建旅行记录处理器
func NewTravelRecordHandler(svc service.TravelRecordService) *TravelRecordHandler {
	return &TravelRecordHandler{travelRecordService: svc}
}

// GetTravelRecordList 获取旅行记录列表（GET /api/records）。
// 返回 {records: [...], metadata: {...}}，形状与前端 loadData() 对齐。
func (h *TravelRecordHandler) GetTravelRecordList(c *gin.Context) {
	records, err := h.travelRecordService.GetTravelRecordList()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"records": records,
		"metadata": gin.H{
			"lastUpdated": time.Now().Format("2006-01-02"),
		},
	})
}

// GetTRListByUserName 按旅客名获取旅行记录（GET /api/records/user/:username）。
// 目前记录表还没有独立的用户名字段，先按 traveler 列过滤。
func (h *TravelRecordHandler) GetTRListByUserName(c *gin.Context) {
	username := c.Param("username")
	records, err := h.travelRecordService.GetTRListByUserName(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"records": records})
}

// CreateTravelRecord 创建旅行记录（POST /api/records）。
// 录入面板「加入地图」按钮提交的表单最终走这里。
func (h *TravelRecordHandler) CreateTravelRecord(c *gin.Context) {
	var record model.TravelRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "请求体解析失败：" + err.Error()})
		return
	}

	if err := h.travelRecordService.CreateTravelRecord(&record); err != nil {
		status := http.StatusInternalServerError
		if errors.Is(err, service.ErrInvalidRecord) {
			status = http.StatusBadRequest
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"record": record})
}
