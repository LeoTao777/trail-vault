package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Log      LogConfig      `yaml:"log"`
	Database DatabaseConfig `yaml:"database"`
	Frontend FrontendConfig `yaml:"frontend"`
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

// FrontendConfig 前端配置。
//   - DevDir   ：开发期 Vite 源码目录（兜底静态托管时也能用）；
//   - DistDir  ：`npm run build` 产物目录（生产模式只托管它）；
//   - DevProxy ：开发期把非 /api 请求整体反代给 Vite dev server（如 http://127.0.0.1:5173），
//     让 8080 和 5173 看到同一个应用；生产模式忽略。
type FrontendConfig struct {
	DevDir   string `yaml:"devdir"`
	DistDir  string `yaml:"distdir"`
	DevProxy string `yaml:"devproxy"`
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

// DevProxy 返回开发期反代目标；非 dev 模式一律为空（生产绝不把请求转给外部进程）。
func (c *Config) DevProxy() string {
	if c.Server.Mode != Dev {
		return ""
	}
	return strings.TrimSpace(c.Frontend.DevProxy)
}

// StaticDir 决定 Gin 托管哪个前端目录。
//   - release：只认构建产物 DistDir（缺失时回落到 DevDir，仅作开发兜底）；
//   - dev：产物已构建（dist/index.html 存在）就优先托管产物，
//     这样 `go run .` 也能直接验证 SPA 兜底；否则回落到源码目录。
func (c *Config) StaticDir() string {
	if c.Server.Mode == Release {
		if c.Frontend.DistDir != "" {
			return c.Frontend.DistDir
		}
		return c.Frontend.DevDir
	}

	if c.Frontend.DistDir != "" {
		if info, err := os.Stat(filepath.Join(c.Frontend.DistDir, "index.html")); err == nil && !info.IsDir() {
			return c.Frontend.DistDir
		}
	}
	if c.Frontend.DevDir != "" {
		return c.Frontend.DevDir
	}
	return c.Frontend.DistDir
}
