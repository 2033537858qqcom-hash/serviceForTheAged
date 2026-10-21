# 基于 Java 和微信小程序的社区居家养老服务与智能派单系统

本科毕业设计项目全套代码工程与设计交付物。

---

## 一、项目架构与技术栈

| 模块 | 技术选型 | 说明 |
| :--- | :--- | :--- |
| **Java 后端 (`backend/`)** | Java 17/21, Spring Boot 3.3.4, MyBatis-Plus 3.5.7, MySQL 8.0, JWT, BCrypt, Springdoc OpenAPI (Swagger) | 业务流转、并发控制锁协议、多因素智能派单引擎与异常超时恢复定时任务 |
| **微信原生小程序 (`miniprogram/`)** | 原生微信小程序 (WXML/WXSS/JS), AppID: `wxb460b87f30a9791b` | 居民端/家属端服务预约、大字适老化关爱模式、服务人员移动端工作台（接单倒计时/上门签到/履约记录） |
| **管理控制后台 (`admin-web/`)** | Vue 3, Vite, Element Plus, Pinia, Vue Router, ECharts | 数据监控大屏、订单全生命周期追踪、算法评分透明化解释与待人工调度队列、老人及家属审核、人员排班 |
| **数据库 (`sql/`)** | MySQL 8.0+, utf8mb4 | 17 张规范核心业务表与完整演示数据 |

---

## 二、本地测试演示账号

以下账号来自本地演示数据，仅用于开发和答辩。模拟登录接口仅在显式启用 dev/test 环境且设置 `APP_DEV_MODE=true` 时提供；生产环境不注册该接口。正式部署前需重设账号凭据，不能直接使用演示数据库。

| 身份角色 | 登录用户名 | 姓名 | 职责与测试场景 |
| :--- | :--- | :--- | :--- |
| **系统管理员** | `admin` | 系统管理员 | 后台全部权限、大屏看板、待人工协调、改派、人员排班、家属审核 |
| **服务人员 1** | `staff01` | 张玉兰 | 具备居家保洁、助餐烹饪资质；可在小程序工作台接单、签到、提交记录 |
| **服务人员 2** | `staff02` | 李建国 | 具备代买代办、陪同办事、保洁资质 |
| **服务人员 3** | `staff03` | 王秀英 | 具备助餐烹饪、陪同办事、基础护理资质 |
| **老人本人** | `resident01` | 赵德柱 (82岁) | 阳光花园社区老人本人账号，可自主预约、查看订单与评价 |
| **已授权家属** | `family01` | 赵志强 | 赵德柱的儿子，已通过审核授权，可代老人预约、代确认服务 |
| **待审核家属** | `family02` | 孙小美 | 提交了代管孙大爷的绑定申请，用于测试管理员审核流程 |

---

## 三、快速本地启动指南

### 1. 数据库就绪
数据库 `aged_care_db` 已完成建表和基础数据导入：
```bash
# 如需重置数据库：
mysql -u root -p --default-character-set=utf8mb4 < sql/schema.sql
mysql -u root -p --default-character-set=utf8mb4 < sql/data.sql
```

### 2. 启动 Java 后端
```powershell
cd backend
$env:SPRING_PROFILES_ACTIVE = 'dev'
$env:DB_USER = Read-Host '数据库账号'
$databasePassword = Read-Host '数据库密码' -AsSecureString
$env:DB_PASSWORD = [Net.NetworkCredential]::new('', $databasePassword).Password
$env:JWT_SECRET = [Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
mvn spring-boot:run
```
- 默认启动环境为 `prod`，本地 IDEA 运行配置也需显式指定 `dev`。开发模式下 `APP_DEV_MODE` 默认仍为 `false`，正常微信登录无需开启模拟登录。
- 上述临时 JWT 密钥更换后需重新登录。持续联调请在本机安全保存固定的随机密钥。
- 微信本地配置：`backend/config/wechat-local.properties`（已忽略 Git 提交）。开发配置会自动加载此文件；也可通过 `WECHAT_APPID` / `WECHAT_SECRET` 环境变量覆盖。
- 后端服务端口：`http://localhost:8080/api`
- Swagger / OpenAPI 在线接口文档：`http://localhost:8080/api/swagger-ui.html`

### 3. 启动 Web 管理后台
```bash
cd admin-web
npm run dev
```
- 管理后台访问地址：`http://localhost:3000`
- 管理员使用账号密码登录；模拟登录须按上述条件单独启用。

### 4. 运行微信小程序
1. 打开**微信开发者工具**。
2. 点击“导入项目”，选择项目代码中的 `miniprogram` 目录。
3. AppID 已配置为您的专属 AppID：`wxb460b87f30a9791b`。
4. 在开发工具详情设置中勾选“不校验合法域名、web-view（业务域名）、TLS版本以及HTTPS证书”（开发联调专用）。

---

## 四、智能派单算法核心模型

派单评分引擎严格实现方案设计：

$$Score = 0.35 \times D + 0.30 \times Q + 0.25 \times L + 0.10 \times F$$

1. **硬约束筛选（硬门槛）**：
   - 账号正常审核通过，当前非休息状态；
   - 具备订单要求的全部专业技能（如 `CLEANING`, `COOKING`, `ESCORT` 等）；
   - 服务地址属于其常驻服务网格；
   - 订单预约时段必须位于服务人员当日排班班次内，且不与已有有效预留重叠；
   - 前后衔接出行时间可行性检查（首单从站点出发，后续单从前序订单推算，结合巡航速度与安全缓冲时间）。
2. **多因素评分指标**：
   - **$D$（到达便利度）**：$1 - \min(\text{预计到达路程分钟数} / 30, 1)$；
   - **$Q$（服务质量）**：贝叶斯平滑历史均分（先验均分 4.0，先验样本数 5，彻底解决新人员冷启动除零与极值偏差）；
   - **$L$（当日工作量余量）**：$\max(0, 1 - \frac{\text{当日已有预留服务分钟数} + \text{本单分钟数}}{\text{当日可工作分钟数}})$，平衡各服务人员劳动负荷；
   - **$F$（熟悉程度）**：曾为该老人完成服务为 1，否则为 0。
3. **闭环与异常恢复**：
   - 每次向综合最优人员派单，生成 120 秒待接单预留；
   - 超时或拒单自动释放预留，在未尝试候选池中重新计算重派，最多尝试 3 次；
   - 尝试超限或无合格人员转为 `WAIT_MANUAL`（待人工处理），管理员后台提供完整决策原因解释看板与一键改派。
