# Web Delta Spec

## Added Requirements

### Requirement: Auth forms require a valid captcha challenge

Web 登录与首次初始化表单必须在提交用户名和密码之外，同时提交一个有效的一次性验证码答案。

#### Scenario: login without captcha

- Given 用户访问登录页
- When 客户端未提交有效 `captchaId` 或 `captchaAnswer`
- Then 服务端拒绝登录请求

#### Scenario: setup without captcha

- Given 实例尚未初始化
- When 用户提交初始化管理员表单但验证码无效
- Then 服务端拒绝注册请求

#### Scenario: captcha refresh after failed submit

- Given 用户提交了错误验证码
- When 前端收到校验失败响应
- Then 前端刷新 challenge，避免重复提交旧验证码

### Requirement: Self-hosted web auth captcha must survive SSR packaging

Web 自部署构建后的 server runtime 必须能够正常签发图形验证码，不能因为 SSR 打包改变 `svg-captcha` 的字体资源相对路径而在启动阶段崩溃。

#### Scenario: dockerized web server starts with captcha enabled

- Given 用户通过 `docker compose up -d --build` 启动 Web 服务
- When server 加载认证验证码服务
- Then 服务能够正常启动并继续签发 captcha challenge，而不是因为缺失 `../fonts/Comismsh.ttf` 报 `ENOENT`
