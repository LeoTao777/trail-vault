package config

import (
	"fmt"
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server ServerConfig `yaml:"server"`
	Log    LogConfig    `yaml:"log"`
}

type LogConfig struct {
	Level string `yaml:"level"`
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
