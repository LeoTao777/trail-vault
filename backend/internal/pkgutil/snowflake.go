package pkgutil

import (
	"errors"
	"sync"
	"time"
)

const (
	epoch        = int64(1704067200000) // 2024‑01‑01 00:00:00 毫秒
	workerBits   = uint(10)
	sequenceBits = uint(12)

	workerMax   = int64(1<<workerBits - 1)
	sequenceMax = int64(1<<sequenceBits - 1)

	workerShift    = sequenceBits
	timestampShift = sequenceBits + workerBits
)

type Snowflake struct {
	mu        sync.Mutex
	timestamp int64
	workerID  int64
	sequence  int64
}

var (
	instance *Snowflake
	once     sync.Once
)

// Init 初始化雪花单例，程序启动调用一次，workerId:0‑1023
func Init(workerID int64) error {
	if workerID < 0 || workerID > workerMax {
		return errors.New("worker id out of range [0,1023]")
	}
	var err error
	once.Do(func() {
		instance = &Snowflake{
			timestamp: 0,
			workerID:  workerID,
			sequence:  0,
		}
	})
	// 防止重复传入不同 workerID
	if instance.workerID != workerID {
		return errors.New("snowflake already initialized with another workerId")
	}
	return err
}

// Next 全局生成ID
func Next() (int64, error) {
	if instance == nil {
		return 0, errors.New("snowflake not init, call snowflake.Init() first")
	}
	return instance.Next()
}

func (s *Snowflake) Next() (int64, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now().UnixMilli()
	if now < s.timestamp {
		return 0, errors.New("clock moved backwards, refuse generate id")
	}

	if now == s.timestamp {
		s.sequence = (s.sequence + 1) & sequenceMax
		if s.sequence == 0 {
			for now <= s.timestamp {
				now = time.Now().UnixMilli()
			}
		}
	} else {
		s.sequence = 0
	}

	s.timestamp = now
	id := ((now - epoch) << timestampShift) | (s.workerID << workerShift) | s.sequence
	return id, nil
}

// Parse 解析雪花ID: timestamp(ms), workerId, sequence
func Parse(id int64) (timestamp int64, workerID int64, sequence int64) {
	timestamp = (id >> timestampShift) + epoch
	workerID = (id >> workerShift) & workerMax
	sequence = id & sequenceMax
	return
}