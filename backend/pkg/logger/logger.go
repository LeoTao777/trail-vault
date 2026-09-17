package logger

import (
	"os"
	"path/filepath"
	"time"

	"github.com/LeoTao777/travil-vault/backend/config"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

// New 创建日志实例
func New(cfg config.LogConfig) (*zap.Logger, error) {
	if cfg.LogDir == "" {
		cfg.LogDir = "logs"
	}
	if cfg.FileName == "" {
		cfg.FileName = "app.log"
	}
	if cfg.Level == "" {
		cfg.Level = "info"
	}
	if cfg.MaxSize <= 0 {
		cfg.MaxSize = 100
	}
	if cfg.MaxBackups <= 0 {
		cfg.MaxBackups = 10
	}
	if cfg.MaxAge <= 0 {
		cfg.MaxAge = 30
	}

	if err := os.MkdirAll(cfg.LogDir, 0755); err != nil {
		return nil, err
	}

	// 日志级别
	var level zapcore.Level
	if err := level.UnmarshalText([]byte(cfg.Level)); err != nil {
		return nil, err
	}

	// 时间格式
	encoderConfig := zap.NewProductionEncoderConfig()
	encoderConfig.EncodeTime = func(
		t time.Time,
		enc zapcore.PrimitiveArrayEncoder,
	) {
		enc.AppendString(t.Format("2006-01-02 15:04:05"))
	}

	// 输出格式：时间 + 级别 + 文件名:行号 + 消息
	encoderConfig.EncodeLevel = zapcore.CapitalLevelEncoder
	encoderConfig.EncodeCaller = zapcore.ShortCallerEncoder

	encoder := zapcore.NewConsoleEncoder(encoderConfig)

	// 日志文件输出
	fileWriter := zapcore.AddSync(&lumberjack.Logger{
		Filename:   filepath.Join(cfg.LogDir, cfg.FileName),
		MaxSize:    cfg.MaxSize,
		MaxBackups: cfg.MaxBackups,
		MaxAge:     cfg.MaxAge,
		Compress:   cfg.Compress,
		LocalTime:  true,
	})

	var core zapcore.Core

	if cfg.Console {
		consoleWriter := zapcore.AddSync(os.Stdout)
		writer := zapcore.NewMultiWriteSyncer(fileWriter, consoleWriter)
		core = zapcore.NewCore(encoder, writer, level)
	} else {
		core = zapcore.NewCore(encoder, fileWriter, level)
	}

	// AddCaller：记录调用日志的文件和行号
	logger := zap.New(
		core,
		zap.AddCaller(),
	)

	return logger, nil
}
