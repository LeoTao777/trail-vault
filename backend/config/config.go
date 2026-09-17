package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Log      LogConfig      `yaml:"log"`
	Database DatabaseConfig `yaml:"database"`
}

type LogConfig struct {
	Level      string `yaml:"level"`
	LogDir     string `yaml:"logdir"`
	FileName   string `yaml:"filename"`
	Console    bool   `yaml:"console"`
	MaxSize    int    `yaml:"maxsize"`    // 单个日志文件最大容量，单位 MB
	MaxBackups int    `yaml:"maxbackups"` // 最大保留文件数
	MaxAge     int    `yaml:"maxage"`     // 日志保留天数
	Compress   bool   `yaml:"compress"`   // 是否压缩旧日志
}

type DatabaseConfig struct {
	Path string `yaml:"path"` // SQLite 数据库文件路径
}

type ServerConfig struct {
	Port int     `yaml:"port"`
	Host string  `yaml:"host"`
	Mode Devmode `yaml:"mode"`
}

type Devmode string

const (
	Dev     Devmode = "dev"
	Release Devmode = "release"
)

// Load 读取并解析指定路径的 yaml 配置文件，返回配置对象。
func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}
	var c Config
	if err := yaml.Unmarshal(data, &c); err != nil {
		return nil, fmt.Errorf("parse config %s: %w", path, err)
	}
	return &c, nil
}
