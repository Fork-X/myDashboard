# 个人看板项目实施计划

## 项目概述
创建一个个人知识管理看板系统，包含投资理财、个人思考、职业生涯、待办规划、个人项目五大板块。

## 技术选型
- **前端框架**: React 18 + TypeScript
- **路由**: React Router v6 (HashRouter)
- **样式**: Tailwind CSS
- **图标**: Font Awesome + Lucide React
- **动画**: Framer Motion
- **后端服务**: OneDay Cloud (Supabase)
- **构建工具**: Webpack 5 + webpack-dev-server 4.x

## 核心功能需求

### 1. 投资理财板块
- 投资知识库展示（卡片式）
- 每日复盘记录（时间线形式）
- 每日热点消息（列表形式）
- 数据来源：后续通过 AI 拉取 + 后端处理

### 2. 个人思考板块
- 思考笔记展示（瀑布流/卡片式）
- 分类标签：idea、人生思考、社会学、哲学、传播学等
- 支持搜索和筛选
- 支持富文本内容展示

### 3. 职业生涯板块
- **时间线展示**：每个节点点亮后展示详情
- **信息内容**：岗位、公司、负责项目、工作内容
- **敏感信息**：薪资等需要密码保护
- **权限方案**：密码保护（输入正确密码后才能查看薪资等敏感信息）

### 4. 待办规划板块
- **年度/月度目标**展示
- **TODO List** 管理
- **功能**：
  - 状态切换（打勾完成、打叉取消）
  - 在线编辑（添加、删除、修改）
- **展示形式**：清晰简洁的列表 + 卡片

### 5. 个人项目板块
- 项目卡片展示
- 项目信息：名称、描述、技术栈、截图
- 跳转到 GitHub 链接

## 数据存储方案
- **主要方式**：OneDay Cloud (Supabase) 云端数据库
- **优势**：支持多设备同步、在线编辑、实时更新

## 设计风格
- **主题**：现代简约风格
- **布局**：卡片式布局
- **配色**：浅色背景，清爽简洁
- **响应式**：支持桌面端和移动端

## 路由结构设计

```
/ (首页 - Dashboard)
  ├── /investment (投资理财)
  │   ├── /investment/knowledge (投资知识)
  │   ├── /investment/review (每日复盘)
  │   └── /investment/news (热点消息)
  │
  ├── /thoughts (个人思考)
  │   └── /thoughts/:category (按分类筛选)
  │
  ├── /career (职业生涯)
  │   └── 需要密码验证才能查看敏感信息
  │
  ├── /todos (待办规划)
  │   ├── /todos/goals (年度/月度目标)
  │   └── /todos/list (TODO List)
  │
  └── /projects (个人项目)
```

## 数据库表结构设计

### 1. investment_knowledge (投资知识)
```sql
- id: uuid (主键)
- title: text (标题)
- content: text (内容)
- category: text (分类)
- tags: text[] (标签)
- created_at: timestamp
- updated_at: timestamp
```

### 2. investment_reviews (每日复盘)
```sql
- id: uuid (主键)
- date: date (日期)
- content: text (复盘内容)
- market_summary: text (市场总结)
- created_at: timestamp
```

### 3. hot_news (热点消息)
```sql
- id: uuid (主键)
- title: text (标题)
- content: text (内容)
- source: text (来源)
- url: text (链接)
- published_at: timestamp
- created_at: timestamp
```

### 4. thoughts (个人思考)
```sql
- id: uuid (主键)
- title: text (标题)
- content: text (内容)
- category: text (分类: idea/life/sociology/philosophy/communication)
- tags: text[] (标签)
- created_at: timestamp
- updated_at: timestamp
```

### 5. career_timeline (职业生涯)
```sql
- id: uuid (主键)
- company: text (公司)
- position: text (岗位)
- start_date: date (开始日期)
- end_date: date (结束日期，null 表示至今)
- projects: text[] (负责项目)
- responsibilities: text (工作内容)
- salary: text (薪资 - 加密存储)
- is_current: boolean (是否当前职位)
- created_at: timestamp
```

### 6. goals (目标规划)
```sql
- id: uuid (主键)
- title: text (目标标题)
- description: text (描述)
- type: text (year/month)
- target_date: date (目标日期)
- status: text (pending/in_progress/completed/cancelled)
- created_at: timestamp
- updated_at: timestamp
```

### 7. todos (待办事项)
```sql
- id: uuid (主键)
- title: text (标题)
- description: text (描述)
- status: text (pending/completed/cancelled)
- created_at: timestamp
- updated_at: timestamp
- completed_at: timestamp
```

### 8. projects (个人项目)
```sql
- id: uuid (主键)
- name: text (项目名称)
- description: text (项目描述)
- tech_stack: text[] (技术栈)
- github_url: text (GitHub 链接)
- demo_url: text (演示链接)
- image_url: text (项目截图)
- created_at: timestamp
```

## 实施步骤

### Phase 1: 项目初始化
1. ✅ 项目基础结构已存在（package.json, webpack.config.js 等）
2. 安装依赖（npm install）
3. 启用 OneDay Cloud 服务
4. 创建数据库表结构

### Phase 2: 核心组件开发
1. **布局组件**
   - `Layout`: 主布局（侧边栏 + 内容区）
   - `Sidebar`: 侧边导航栏
   - `Header`: 顶部导航栏

2. **通用组件**
   - `Card`: 卡片组件
   - `Modal`: 模态框组件
   - `PasswordProtect`: 密码保护组件
   - `Loading`: 加载状态组件
   - `EmptyState`: 空状态组件

### Phase 3: 功能模块开发

#### 3.1 投资理财模块
- `InvestmentDashboard`: 投资理财主页
- `KnowledgeList`: 投资知识列表
- `ReviewTimeline`: 复盘时间线
- `NewsList`: 热点消息列表

#### 3.2 个人思考模块
- `ThoughtsGrid`: 思考笔记网格
- `ThoughtCard`: 思考卡片
- `ThoughtDetail`: 思考详情
- `CategoryFilter`: 分类筛选器

#### 3.3 职业生涯模块
- `CareerTimeline`: 职业时间线
- `CareerNode`: 时间线节点
- `CareerDetail`: 职业详情（含密码保护）
- `PasswordModal`: 密码验证模态框

#### 3.4 待办规划模块
- `TodosDashboard`: 待办主页
- `GoalsList`: 目标列表
- `TodoList`: 待办列表
- `TodoItem`: 待办项（支持状态切换）
- `AddTodoForm`: 添加待办表单

#### 3.5 个人项目模块
- `ProjectsGrid`: 项目网格
- `ProjectCard`: 项目卡片

### Phase 4: 数据集成
1. 创建 Supabase 客户端配置
2. 实现数据 CRUD 操作
3. 实现实时数据订阅（可选）
4. 添加错误处理和加载状态

### Phase 5: 样式优化
1. 实现响应式布局
2. 添加动画效果（Framer Motion）
3. 优化交互体验
4. 添加过渡效果

### Phase 6: 测试与优化
1. 功能测试
2. 性能优化
3. 构建生产版本
4. 部署准备

## 文件结构

```
src/
├── App.tsx                          # 主应用组件
├── index.tsx                        # 入口文件
├── styles/
│   └── index.css                    # 全局样式
├── config/
│   └── supabase.ts                  # Supabase 配置
├── types/
│   └── index.ts                     # TypeScript 类型定义
├── hooks/
│   ├── useInvestment.ts             # 投资理财数据钩子
│   ├── useThoughts.ts               # 个人思考数据钩子
│   ├── useCareer.ts                 # 职业生涯数据钩子
│   ├── useTodos.ts                  # 待办数据钩子
│   └── useProjects.ts               # 项目数据钩子
├── components/
│   ├── layout/
│   │   ├── Layout.tsx               # 主布局
│   │   ├── Sidebar.tsx              # 侧边栏
│   │   └── Header.tsx               # 顶部栏
│   ├── common/
│   │   ├── Card.tsx                 # 卡片组件
│   │   ├── Modal.tsx                # 模态框
│   │   ├── PasswordProtect.tsx      # 密码保护
│   │   ├── Loading.tsx              # 加载状态
│   │   └── EmptyState.tsx           # 空状态
│   ├── investment/
│   │   ├── InvestmentDashboard.tsx
│   │   ├── KnowledgeList.tsx
│   │   ├── ReviewTimeline.tsx
│   │   └── NewsList.tsx
│   ├── thoughts/
│   │   ├── ThoughtsGrid.tsx
│   │   ├── ThoughtCard.tsx
│   │   ├── ThoughtDetail.tsx
│   │   └── CategoryFilter.tsx
│   ├── career/
│   │   ├── CareerTimeline.tsx
│   │   ├── CareerNode.tsx
│   │   ├── CareerDetail.tsx
│   │   └── PasswordModal.tsx
│   ├── todos/
│   │   ├── TodosDashboard.tsx
│   │   ├── GoalsList.tsx
│   │   ├── TodoList.tsx
│   │   ├── TodoItem.tsx
│   │   └── AddTodoForm.tsx
│   └── projects/
│       ├── ProjectsGrid.tsx
│       └── ProjectCard.tsx
└── pages/
    ├── Home.tsx                     # 首页
    ├── Investment.tsx               # 投资理财页
    ├── Thoughts.tsx                 # 个人思考页
    ├── Career.tsx                   # 职业生涯页
    ├── Todos.tsx                    # 待办规划页
    └── Projects.tsx                 # 个人项目页
```

## 关键技术实现

### 1. 密码保护实现
```typescript
// 使用 localStorage 存储加密后的密码
// 用户输入密码后，验证通过才显示敏感信息
// 密码验证状态在会话期间保持
```

### 2. 状态管理
```typescript
// 使用 React Hooks (useState, useEffect)
// 自定义 hooks 封装数据逻辑
// Context API 管理全局状态（如密码验证状态）
```

### 3. 数据持久化
```typescript
// Supabase 实时数据库
// 自动同步
// 乐观更新 UI
```

### 4. 路由实现
```typescript
// React Router v6 HashRouter
// 嵌套路由
// 路由守卫（密码保护）
```

## 注意事项

1. **安全性**
   - 敏感信息（薪资）需要密码验证
   - 密码不要硬编码，使用环境变量或配置
   - 数据传输使用 HTTPS

2. **性能优化**
   - 图片懒加载
   - 列表虚拟滚动（如果数据量大）
   - 代码分割（React.lazy）

3. **用户体验**
   - 加载状态提示
   - 错误处理和友好提示
   - 响应式设计
   - 平滑动画过渡

4. **可扩展性**
   - 模块化设计
   - 组件复用
   - 类型安全（TypeScript）
   - 易于添加新板块

## 预期交付物

1. ✅ 完整的 React + TypeScript 应用
2. ✅ 五大功能板块全部实现
3. ✅ OneDay Cloud 数据库集成
4. ✅ 密码保护功能
5. ✅ 响应式设计
6. ✅ 现代简约 UI
7. ✅ 完整的路由系统
8. ✅ 在线编辑功能（待办、思考等）
9. ✅ 构建和部署就绪

## 开发时间估算

- Phase 1: 项目初始化 - 30 分钟
- Phase 2: 核心组件开发 - 1 小时
- Phase 3: 功能模块开发 - 2-3 小时
- Phase 4: 数据集成 - 1 小时
- Phase 5: 样式优化 - 1 小时
- Phase 6: 测试与优化 - 30 分钟

**总计**: 约 6-7 小时

## 后续扩展建议

1. **数据导入导出**：支持 JSON/CSV 导出
2. **搜索功能**：全局搜索
3. **数据统计**：可视化图表
4. **主题切换**：明暗主题
5. **移动端优化**：PWA 支持
6. **AI 集成**：自动生成复盘、热点抓取
7. **分享功能**：生成分享链接
8. **备份恢复**：数据备份和恢复
