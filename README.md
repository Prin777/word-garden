# Word Garden · 单词小径

一个在本机运行的英语词汇学习网站。当前支持今日词汇、认词和听音配对、词条编辑、多用户独立学习进度，以及基于 FSRS 的复习安排。

## 本地启动

安装 Node.js 22.13 或更高版本，在项目目录中运行：

```sh
npm ci
npm start
```

访问 [localhost:3000](http://localhost:3000)。Windows 也可以双击 `start.cmd`。

本地开发词库已导入 3,610 个雅思词条。仓库只提交源码和文档。新克隆可以启动网站，词库需要自行导入或从自己的备份恢复。导入步骤见[项目讨论与决策](docs/project-notes.md)。学习记录保存在 `data/learning.sqlite`，备份前先停止服务，再复制整个 `data/`。

## 本地发音

在 Windows PowerShell 中执行一次 `powershell -NoProfile -ExecutionPolicy Bypass -File .\setup-piper.ps1`，下载 Piper 和美音模型。安装后可离线使用。

| 模式 | Windows 启动入口 | 地址 |
| --- | --- | --- |
| 原始音频 | `start.cmd` | [localhost:3000](http://localhost:3000) |
| Piper 实时合成 | `start-piper-live.cmd` | [localhost:3001](http://localhost:3001) |
| Piper 批量生成 | `start-piper-batch.cmd` | [localhost:3002](http://localhost:3002) |

批量版首次运行会生成词库 WAV，后续运行补齐缺失文件。两个 Piper 启动入口已接入，实际合成和播放待验证。

## TODO

- 验证 Piper 两种模式，测量实时出声延迟和全量 WAV 实际占用，抽查同形异音词。
- 增加词库切换、PTE 词库和拼写输入练习。
- 本地版本稳定后再处理 NAS 部署和 APK。当前服务默认只监听本机，后台暂无密码。

运行 `npm test` 执行测试。
