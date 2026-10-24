# 小程序自动上传开发版 — 配置清单

推送 `miniprogram/` 到 GitHub main 分支后，`.github/workflows/upload-dev.yml` 会自动调
`miniprogram-ci` 把开发版上传到微信小程序后台（mp.weixin.qq.com → 版本管理 → 开发版本），
**不会直接发线上**，线上仍需在后台走「提审 → 发布」手动确认。

## 一次性配置（你来做的部分）

### 1. AppID
- 正式 AppID（mp.weixin.qq.com → 设置 → 基本设置）。测试号 `wx` 开头也可，但正式提审要换成正式 AppID。

### 2. 生成小程序「开发密钥 / 私有号」`private.key`
- 微信开发者工具：详情 → 本地设置 → 生成小程序「上传密钥」
  或 mp.weixin.qq.com → 开发 → 开发管理 → 开发密钥 → 生成
- 生成时会让你设一个 **密钥口令**（4-32 位），记下来 = `MP_KEY_PWD`。

### 3. 仓库设为 private（私有仓库）
- 小程序的 AppID 要和仓库访问权限绑定；用私仓 + 你个人 token 最干净。

### 4. 配置 4 个 GitHub Secrets
仓库 → Settings → Secrets and variables → Actions → 新增：

| Secret | 值 |
|---|---|
| `MP_APPID` | 你的 AppID |
| `MP_KEY_PWD` | 生成密钥时设的口令 |
| `MP_PRIVATE_KEY` | `private.key` 文件内容做 base64：`base64 -w0 private.key`（一行，含换行也能） |
| `MP_UPV` | 上传版本号，如 `0.0.1`（可省，默认 0.0.1） |

> `MP_PRIVATE_KEY` 存 base64 是为了避免多行密钥在 secret 里被截断。CI 里用 `base64 -d` 还原。

### 5. 本地 project.config.json
- `miniprogram/project.config.json` 里把 `appid` 换成你的（CI 用不到，开发者工具本地调试用）。

## 触发方式
- push 到 `main` 自动触发；或 Actions 页手动 `Run workflow`。
- 上传成功后，开发版出现在 mp.weixin.qq.com 后台的「开发版本」里，可预览 / 提审。

## 可选
- `MP_DESC` 可放上传备注（默认 `auto upload dev build`）。
- 想按 tag 发测试版：改 workflow 的 `on.push.tags`。
