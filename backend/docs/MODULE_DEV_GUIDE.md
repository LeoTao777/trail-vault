# 模块开发规范与 HTTP 接口流程

> 以 `user` 模块为例，说明新增业务模块、新增 HTTP 接口的标准流程与文件结构。
> 最后更新：2026-08-27

## 目录

1. [分层架构总览](#1-分层架构总览)
2. [标准文件结构](#2-标准文件结构)
3. [各层职责与约定](#3-各层职责与约定)
4. [新增模块流程（以 user 模块为例）](#4-新增模块流程以-user-模块为例)
5. [新增 HTTP 接口流程](#5-新增-http-接口流程)
6. [请求→响应数据流](#6-请求响应数据流)
7. [命名与编码约定](#7-命名与编码约定)
8. [常见易错点](#8-常见易错点)
9. [新增模块检查清单](#9-新增模块检查清单)

---

## 1. 分层架构总览

后端采用经典四层分层，依赖方向**自上而下、单向**：

```
HTTP 请求
   │
   ▼
 handler   (Gin)        解析请求 / 组织响应，不写业务逻辑
   │
   ▼
 service                业务编排 / 校验 / 跨仓储协作
   │
   ▼
 repository            数据访问（GORM），隔离 SQL 细节
   │
   ▼
 model + database      数据模型（表映射） + 连接
   │
   ▼
 SQLite (.db 文件)
```

**核心装配链**（在 `server.New` 中完成，依赖注入）：

```
database.Init() → *gorm.DB
   └─ repository.NewUserRepository(db)  → UserRepository
        └─ service.NewUserService(repo) → UserService
             └─ handler.NewUserHandler(svc) → *UserHandler
                  └─ registerRoutes() 绑定 URL → handler 方法
```

每一层只依赖**下一层的接口**（不是具体实现），便于替换实现与单测 mock。

---

## 2. 标准文件结构

```
backend/
  main.go                          # 入口：加载配置 → 初始化 DB → 启动 server
  go.mod / go.sum
  config/
    config.go                      # 配置结构体 + Load(path)
    configs/app.yaml               # 运行配置（server/log/database）
  server/
    server.go                      # Server 结构、New() 装配、Run()
    route.go                       # 路由注册（业务 API + 前端静态兜底）
  internal/
    database/sqlite.go             # GORM+SQLite 初始化 + AutoMigrate
    model/<module>.go              # 数据模型（GORM 表映射 + JSON 标签）
    repository/<module>_repo.go    # 数据访问层：接口 + GORM 实现
    service/<module>_service.go    # 业务逻辑层：接口 + 实现
    handler/<module>_handler.go    # HTTP 处理层：Gin handler
```

> 命名约定：`model` 用单数实体名（`user.go`）；`repository`/`service`/`handler` 用 `<module>_repo.go` / `<module>_service.go` / `<module>_handler.go`。
> 一个模块 = `model` + `repository` + `service` + `handler` 四个文件，跨层同名前缀。

---

## 3. 各层职责与约定

| 层 | 文件 | 职责 | 不该做的事 |
|---|---|---|---|
| **model** | `internal/model/user.go` | 定义结构体 + GORM/JSON 标签、`TableName()` | 不写 DB 操作、不写业务 |
| **repository** | `internal/repository/user_repo.go` | 接口 + GORM 实现（CRUD） | 不处理 HTTP、不做业务校验 |
| **service** | `internal/service/user_service.go` | 接口 + 业务实现，依赖 repository 接口 | 不碰 `gin.Context`、不直接用 `*gorm.DB` |
| **handler** | `internal/handler/user_handler.go` | 解析入参、调 service、组装 JSON 响应 | 不直接调 repository、不写 SQL |
| **server** | `server/server.go` + `route.go` | 装配依赖、注册路由、启动 HTTP | 不写业务 |
| **database** | `internal/database/sqlite.go` | 打开连接、AutoMigrate 所有模型 | 不写业务 |
| **config** | `config/config.go` + `app.yaml` | 加载配置 | — |

---

## 4. 新增模块流程（以 user 模块为例）

> 假设要新增一个 `user` 模块。按下面 6 步顺序做，每步对应一个文件。

### Step 1 — 数据模型 `internal/model/user.go`

定义结构体，打 GORM 标签（建表约束）与 JSON 标签（响应字段），敏感字段用 `json:"-"` 隐藏。

```go
package model

import "time"

// User 用户模型
type User struct {
    ID        int64     `gorm:"primaryKey;autoIncrement" json:"id"`
    Username  string    `gorm:"unique;not null" json:"username"`
    Password  string    `gorm:"not null" json:"-"` // 不返回密码
    Email     string    `gorm:"unique;not null" json:"email"`
    CreatedAt time.Time `json:"created_at"`
    UpdatedAt time.Time `json:"updated_at"`
}

// TableName 指定表名
func (User) TableName() string {
    return "users"
}
```

### Step 2 — 数据访问层 `internal/repository/user_repo.go`

**先定义接口**（对外契约），**再写私有 struct 实现**，构造函数返回接口类型。

```go
package repository

import (
    "github.com/LeoTao777/travil-vault/backend/internal/model"
    "gorm.io/gorm"
)

// UserRepository 用户数据访问接口。
type UserRepository interface {
    List() ([]model.User, error)
    GetByUsername(username string) (*model.User, error)
    Create(user *model.User) error
}

type userRepository struct {
    db *gorm.DB
}

// NewUserRepository 创建基于 GORM 的用户仓储实现。
func NewUserRepository(db *gorm.DB) UserRepository {
    return &userRepository{db: db}
}

func (r *userRepository) List() ([]model.User, error) {
    var users []model.User
    if err := r.db.Find(&users).Error; err != nil {
        return nil, err
    }
    return users, nil
}

func (r *userRepository) GetByUsername(username string) (*model.User, error) {
    var user model.User
    if err := r.db.Where("username = ?", username).First(&user).Error; err != nil {
        return nil, err
    }
    return &user, nil
}

func (r *userRepository) Create(user *model.User) error {
    return r.db.Create(user).Error
}
```

### Step 3 — 业务逻辑层 `internal/service/user_service.go`

同样**接口 + 实现**，依赖的是 **repository 的接口**（不是 GORM），构造函数注入 repository。

```go
package service

import (
    "github.com/LeoTao777/travil-vault/backend/internal/model"
    "github.com/LeoTao777/travil-vault/backend/internal/repository"
)

// UserService 用户服务接口
type UserService interface {
    GetUserList() ([]model.User, error)
    GetUserByUsername(username string) (*model.User, error)
    CreateUser(user *model.User) error
}

type userService struct {
    repo repository.UserRepository
}

// NewUserService 创建用户服务实例
func NewUserService(repo repository.UserRepository) UserService {
    return &userService{repo: repo}
}

func (s *userService) GetUserList() ([]model.User, error) {
    return s.repo.List()
}

func (s *userService) GetUserByUsername(username string) (*model.User, error) {
    return s.repo.GetByUsername(username)
}

func (s *userService) CreateUser(user *model.User) error {
    return s.repo.Create(user)
}
```

### Step 4 — HTTP 处理层 `internal/handler/user_handler.go`

持有 **service 接口**，每个公开方法是一个 Gin handler：解析入参 → 调 service → 写 JSON。

```go
package handler

import (
    "net/http"

    "github.com/LeoTao777/travil-vault/backend/internal/service"
    "github.com/gin-gonic/gin"
)

// UserHandler 用户处理器
type UserHandler struct {
    userService service.UserService
}

// NewUserHandler 创建用户处理器
func NewUserHandler(userService service.UserService) *UserHandler {
    return &UserHandler{userService: userService}
}

// GetUserList 获取用户列表
func (h *UserHandler) GetUserList(c *gin.Context) {
    users, err := h.userService.GetUserList()
    if err != nil {
        c.JSON(http.StatusInternalServerError, gin.H{
            "error": err.Error(),
        })
        return
    }

    c.JSON(http.StatusOK, gin.H{
        "users": users,
    })
}
```

### Step 5 — 装配 `server/server.go` + 注册路由 `server/route.go`

在 `server.New` 中按 **repo → service → handler** 顺序注入依赖；在 `route.go` 把 handler 方法绑到 URL。

```go
// server/server.go
func New(srvCfg *config.ServerConfig, frontendDir string, db *gorm.DB) *Server {
    userRepo := repository.NewUserRepository(db)
    userService := service.NewUserService(userRepo)
    userHandler := handler.NewUserHandler(userService)

    return &Server{
        cfg:         srvCfg,
        frontendDir: frontendDir,
        userService: userService,
        userHandler: userHandler,
    }
}
```

```go
// server/route.go
func (s *Server) registerRoutes(r *gin.Engine) {
    r.GET("/health", func(c *gin.Context) {
        c.JSON(200, gin.H{"status": "ok"})
    })

    // API: 获取用户列表
    r.GET("/api/users", s.userHandler.GetUserList)
    // ...
}
```

### Step 6 — 注册迁移 `internal/database/sqlite.go`

把新模型加入 `AutoMigrate`，启动时自动建表/加列。

```go
// internal/database/sqlite.go
func Init(dbPath string) (*gorm.DB, error) {
    // ... 创建目录、打开 gorm ...
    if err := db.AutoMigrate(&model.User{}); err != nil { // ← 新模型加这里
        return nil, fmt.Errorf("auto migrate: %w", err)
    }
    return db, nil
}
```

完成 6 步后 `go build ./...` 应通过，`go run .` 启动即可访问新接口。

---

## 5. 新增 HTTP 接口流程

> 假设 `user` 模块已存在，要再加一个 `GET /api/users/:username` 接口。

1. **repository 加方法**（`user_repo.go` 接口 + 实现）——如已有则跳过。
2. **service 加方法**（`user_service.go` 接口 + 实现，转调 repository）——如已有则跳过。
3. **handler 加方法**（`user_handler.go`），解析 `:username` 路径参数、调 service、写响应：

   ```go
   func (h *UserHandler) GetUserByUsername(c *gin.Context) {
       username := c.Param("username")
       user, err := h.userService.GetUserByUsername(username)
       if err != nil {
           c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
           return
       }
       c.JSON(http.StatusOK, gin.H{"user": user})
   }
   ```

4. **route.go 注册路由**：

   ```go
   r.GET("/api/users/:username", s.userHandler.GetUserByUsername)
   ```

5. `go build ./...` → 启动 → `curl /api/users/leotao` 验证。

> 规则：handler 只做"协议转换"（HTTP ↔ service），业务判断放 service；SQL/查询放 repository。

---

## 6. 请求→响应数据流

以 `GET /api/users` 为例：

```
客户端 GET /api/users
   │
   ▼ Gin 路由匹配
server.route.go:  r.GET("/api/users", s.userHandler.GetUserList)
   │
   ▼
handler.GetUserList(c)
   │  调 h.userService.GetUserList()
   ▼
service.userService.GetUserList()
   │  调 s.repo.List()
   ▼
repository.userRepository.List()
   │  r.db.Find(&users)
   ▼
GORM → SQLite (SELECT * FROM users)
   │
   ▲ 返回 []model.User
   ▲
service 透传 → handler
   │
   ▼ c.JSON(200, gin.H{"users": users})
   ▼ JSON 经 GORM model 的 json 标签序列化（Password 因 json:"-" 不出现）
客户端收到 {"users":[{...}]}
```

---

## 7. 命名与编码约定

- **接口 + 私有实现**：`UserService`（接口，公开）+ `userService`（私有 struct，实现）；构造函数 `NewUserService(repo) UserService`。
- **构造函数返回接口类型**（不是 `*UserService`）——`UserService` 是接口，接口已封装具体值，**不要取指针**（见[常见易错点](#8-常见易错点)）。
- **依赖注入**：上层构造函数接收下层接口（`NewUserService(repo)`、`NewUserHandler(svc)`），在 `server.New` 统一装配。
- **model 标签**：`gorm:` 管表结构约束（`primaryKey`/`unique`/`not null`），`json:` 管响应字段；敏感字段 `json:"-"`。
- **错误处理**：handler 层 `c.JSON(<HTTP状态码>, gin.H{"error": err.Error()})`；service/repository 层只 `return err`，不写 HTTP。
- **包名**：层名即包名（`model`/`repository`/`service`/`handler`），import 路径 `.../internal/<层>`。
- **文件名**：`<module>.go`（model） / `<module>_repo.go` / `<module>_service.go` / `<module>_handler.go`。

---

## 8. 常见易错点

### ❌ 指向接口的指针

```go
// 错：UserService 是接口，*UserService 是"指向接口的指针"，方法调用无法解析
type UserHandler struct {
    userService *service.UserService          // ← 编译期可能不报错，调用时报错
}
func NewUserHandler(svc *service.UserService)  // ← 同上
```

**正确**：接口以值持有即可：

```go
type UserHandler struct {
    userService service.UserService
}
func NewUserHandler(svc service.UserService) *UserHandler
```

> Go 中接口本身已封装具体类型，几乎不需要 `*Interface`。结构体（如 `UserHandler`）才用指针传递。本项目曾因此报错：
> `h.userService.GetUserList undefined (type *service.UserService is pointer to interface, not interface)`。

### ❌ handler 直接操作 repository / GORM

破坏分层。handler 只能依赖 service 接口；业务需求应下沉到 service，数据访问下沉到 repository。

### ❌ 忘记在 AutoMigrate 注册新模型

新 model 不加进 `database.Init` 的 `AutoMigrate`，启动后表不会自动建，查询会报"no such table"。

### ❌ 新模块未在 `server.New` 装配 / 未在 `route.go` 注册

装配链断开或路由没注册，接口 404。按 [Step 5](#step-5--装配-serverservergo--注册路由-serveroutego) 两处都补上。

---

## 9. 新增模块检查清单

新增一个模块时，逐项确认：

- [ ] `internal/model/<module>.go` — 结构体 + GORM/JSON 标签 + `TableName()`
- [ ] `internal/repository/<module>_repo.go` — 接口 + 私有实现 + `New<Module>Repository(db)` 返回接口
- [ ] `internal/service/<module>_service.go` — 接口 + 私有实现 + `New<Module>Service(repo)` 返回接口
- [ ] `internal/handler/<module>_handler.go` — struct 持有 **service 接口**（非指针）+ handler 方法
- [ ] `server/server.go` — `New` 中 `repo→service→handler` 装配 + 存入 `Server` 字段
- [ ] `server/route.go` — 注册路由 `r.<METHOD>("/api/...", s.<module>Handler.<Method>)`
- [ ] `internal/database/sqlite.go` — `AutoMigrate(&model.<Module>{})`
- [ ] `go build ./...` 通过 + `go vet ./...` 通过
- [ ] 启动后 `curl` 新接口返回符合预期
