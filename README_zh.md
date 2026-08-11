<div align="center">

# Tiny Bubbles

[English](./README.md) | 中文

**把脑子里的事都倒出来。** Tiny Bubbles 是一款免费、开源的待办应用，基于 GTD（Getting Things
Done）方法：几秒钟就能记下每一个任务和想法，然后告诉你下一步该做什么。无需账号，无需订阅，
数据留在你自己的设备上。

[![GitHub license](https://img.shields.io/badge/license-AGPL--3.0-brightgreen)](LICENSE)

</div>

---

> ### 🫧 这是一个 Fork
>
> Tiny Bubbles 是 **[Mindwtr](https://github.com/dongdongbh/Mindwtr)**（作者 dongdongbh 及
> Mindwtr 贡献者）的修改版本，依据 AGPL-3.0 许可证使用，fork 自提交
> [`08b1822`](https://github.com/dongdongbh/Mindwtr/commit/08b18222d8eaf5403d2b05b9a0be39a30008d5d2)。
> 原始设计与实现的全部功劳归上游作者所有。
>
> **如果你想要成熟、持续发布、已上架各大应用商店的产品，请使用
> [Mindwtr](https://github.com/dongdongbh/Mindwtr)，而不是本项目。** 本 fork 旨在朝不同方向
> 发展，并不是上游的替代品。
>
> 完整的署名、许可证义务与变更说明见 [`NOTICE.md`](NOTICE.md)。

> ### ⚠️ 当前状态：早期
>
> Tiny Bubbles 尚未发布任何构建产物。App Store、Google Play、Flathub、F-Droid、Snap、
> Microsoft Store 上都没有本项目的上架条目，也没有可下载的安装包。要试用必须从源码构建。
> 目前唯一完成的工作是对上游的品牌替换 —— 下列功能均继承自 Mindwtr，行为与上游一致。

---
## 这些场景，是不是很熟悉？

- **「这事我记得住。」其实记不住。** 一个快捷键，敲下来，就能放心忘掉。这就是收集。
- **清单上躺着 80 件事，你干脆不打开它。** 「聚焦」只显示你现在能做的那几件。
- **「筹备妈妈的生日」卡了好几周。** 把它拆成一小步一小步的项目，下一步永远清清楚楚。
- **拜托同事的事，你俩都忘了。** 放进「等待中」，到时候记得去催。
- **「有空学吉他」一直在清单里让你内疚。** 放进「将来/也许」：留着，但不再烦你。
- **周日晚上，感觉一切都失控了。** 跟着每周回顾走一遍，重新掌控局面。

## 怎么用

大脑是用来产生想法的，不是用来存放它们的（David Allen 说的，GTD 这本书就是他写的）。存放的活儿，交给 Tiny Bubbles：

1. **先记下来。** 任务、想法、惦记的事：打字或说话，直接进收件箱。桌面端有全局快捷键，手机上有小组件和系统分享。
2. **理一理。** 跟着向导快速过一遍收件箱：两分钟能做完？现在就做。有日期？排上日程。在等别人？记入等待清单。只是个念头？放进「将来/也许」。
3. **去做。** 打开「聚焦」，只看现在能做的几件事，其他一概不出现。
4. **每周清一次。** 每周回顾向导帮你收拾漏网的事，让清单一直可信、脑子一直清爽。

熟悉 GTD 的话：这就是完整的收集、澄清、组织、执行、回顾。不熟悉也没关系：Tiny Bubbles 每一步都有引导，想深入了解可以读读 [15 分钟入门 GTD](https://hamberg.no/gtd)。

## 理念

**我只是想骑车，不要给我驾驶舱。**

Tiny Bubbles 默认简单，需要时也足够强大：

- 高级选项在需要时才出现。
- 更少字段、更少按钮、更少干扰。
- 清爽胜过堆料，坚决不做功能膨胀。

## 功能

- 完整的 GTD 流程，全程有引导：记下来、理一理、去做、每周回顾。
- 聚焦视图把今天的日程和下一步行动放在同一屏。
- 数据保存在你自己的设备上。同步是可选的，存哪儿你说了算：Apple 设备上的 iCloud、Dropbox、共享文件夹、自己的服务器，或 WebDAV。
- 项目支持分区、领域与手动排序，适合更复杂的多步骤规划。
- 从 Obsidian 笔记导入任务，并可链接回源笔记（桌面端）。
- 可选 AI 助手：接入你自己的 OpenAI、Gemini 或 Claude 账号，或在自己电脑上运行本地模型。默认关闭。
- 提供 Windows、macOS、Linux、iPhone、Android 应用，另有可离线使用的网页版。
- 面向开发者：本地 REST API、CLI，以及让 AI 助手管理任务的 MCP 服务器（由本仓库 `apps/mcp-server/` 构建）。


<details>
<summary>查看完整功能列表</summary>

### GTD 工作流
- **收集** - 随时快速添加任务（全局快捷键弹窗、托盘、分享、语音）
- **澄清** - 2 分钟法则引导的收件箱处理
- **组织** - 项目、分区、情境与状态清单
- **回顾** - 带提醒的每周回顾向导
- **执行** - 基于情境筛选的下一步行动
- **AI 辅助（可选）** - 用你自己的 AI 账号（OpenAI、Gemini、Claude）或本地/自托管的 OpenAI 兼容模型，完成澄清、拆解与回顾

### 视图
- 📥 **收件箱** - 任务收集区与处理向导
- 🎯 **聚焦** - 日程（时间维度）+ 下一步行动合并视图
- 📁 **项目** - 支持分区、领域与手动任务排序的多步骤成果
- 🏷️ **情境** - 按在哪儿、用什么做来给任务打标签；嵌套情境（如 @work/meetings）也会匹配上级 @work
- ⏳ **等待中** - 委派事项
- 💭 **将来/也许** - 延后想法
- 📅 **日历** - 基于时间的规划，移动端周视图密度可调
- 📋 **看板** - 看板式拖拽
- 📝 **回顾** - 每日 + 每周回顾流程
- 📦 **归档** - 隐藏历史，按需搜索

### 生产力功能
- 🔍 **全局搜索** - 全领域搜索，并支持搜索操作符（`status:`、`context:`、`assigned:`、`location:`、`where:`、`id:`、`-id:`、`due:<=7d`）
- 📦 **批量操作** - 多选、批量移动/打标签/删除
- 📎 **附件** - 任务支持文件与链接
- ✏️ **Markdown 备注** - 富文本描述与预览
- 🗂️ **项目状态** - 进行中、等待中、将来/也许、归档
- ♾️ **流动重复** - 下次日期按完成时间计算
- ♻️ **可复用清单** - 复制任务或重置清单
- ✅ **清单模式** - 清单任务快速勾选
- ✅ **语音收集** - 语音快速记录、自动转写并创建任务
- 🧭 **Copilot 建议** - 可选的情境/标签/时间提示
- 🍅 **番茄专注（可选）** - 在聚焦视图使用 15/3、25/5、50/10 番茄钟面板，并可添加一个自定义预设
- 🔔 **通知** - 开始提醒与截止提醒分开设置，并支持稍后提醒
- 📊 **每日摘要** - 早间简报 + 晚间回顾
- 📅 **每周回顾** - 可定制的每周提醒

### 数据与同步
- 🔄 **同步选项** - 支持后端与配置方式请见 [数据与同步文档](https://docs.mindwtr.app/data-sync/)
- 🍎 **iCloud 同步** - 在受支持的 iPhone、iPad 与 macOS 构建中内置（CloudKit）
- ☁️ **Dropbox 同步（可选）** - 登录 Dropbox 后通过专属应用文件夹同步（商店版提供，FOSS 构建不含）
- 📤 **导出/备份** - 导出 JSON 数据
- ♻️ **从备份恢复** - 先创建恢复快照，再用已验证的 Tiny Bubbles 备份替换本地数据
- 📥 **TickTick + Todoist + DGT GTD + OmniFocus + Apple Reminders + CSV 导入** - 将 TickTick CSV/ZIP、Todoist CSV/ZIP、DGT GTD JSON/ZIP、OmniFocus 导出、未完成的 Apple Reminders，或任何应用的数据（通过有文档说明的通用 CSV 格式）导入到 Tiny Bubbles
- 🔗 **Obsidian 集成** - 桌面端导入 Vault 中的任务，并可深度链接回源笔记
- 🗓️ **外部日历（系统日历 + ICS）** - 移动端读取系统日历并推送带日期的任务；macOS 桌面端可读取 Apple Calendar 并推送带日期的任务；桌面/Web 也支持 ICS 订阅与从事件创建任务

### 自动化
- 🔌 **CLI** - 仓库辅助工具，可从终端添加/列出/完成/搜索
- 🌐 **REST API** - 桌面端本地 API，使用设置中生成的 bearer token 进行脚本化访问
- 🌍 **网页应用** - 在浏览器中运行，支持离线使用（PWA）
- 🧠 **MCP 服务器** - 让 AI 助手读取和管理你的任务（本地 Model Context Protocol 服务），由本仓库 `apps/mcp-server/` 构建

桌面端可在 **设置 -> 高级** 启动本地 REST API，默认监听 `127.0.0.1:3456` 并使用生成的 bearer token。CLI 仍是仓库辅助工具；stdio MCP 服务器需从本仓库源码构建。

### 跨平台
- 🖥️ **桌面端** - Tauri v2（macOS、Linux、Windows）
- 📱 **移动端** - React Native/Expo（iOS 通过 App Store/TestFlight、Android），内置手势与应用快捷方式提示
- 📲 **Android 小部件** - 桌面焦点/下一步小组件
- ⌨️ **键盘快捷键** - 标准（Gmail 风格）、Vim 与 Emacs 预设
- 🎨 **主题** - 明亮、暗色、OLED、Nord、Sepia、电子墨水与 Material 3
- 🌍 **国际化** - 英文、越南语、简体中文、繁體中文、西班牙语、印地语、阿拉伯语、德语、俄语、日语、法语、葡萄牙语、波兰语、韩语、捷克语、意大利语、土耳其语、荷兰语、波斯语、瑞典语
- 🐳 **Docker** - 使用 Docker 运行 PWA + 自托管同步服务

</details>


## 安装

**Tiny Bubbles 目前没有发布任何构建产物。** 请从源码构建：

```bash
bun install
bun run dev
```

继承自上游的构建与部署指南见 [`docs/`](docs/)，Docker 相关说明见
[`docker/README.md`](docker/README.md)。

如果你现在就想要一个开箱即用的 GTD 应用，请安装
[Mindwtr](https://github.com/dongdongbh/Mindwtr) —— 它已在各大应用商店和包管理器上架。

## 贡献

请先阅读 [CONTRIBUTING.md](docs/CONTRIBUTING.md)。

- **报告缺陷与提出需求：** [GitHub Issues](https://github.com/tinybubbles-app/tinybubbles/issues)
- **协助翻译：** [`packages/core/src/i18n/locales/`](packages/core/src/i18n/locales/)
- **贡献代码/文档：** 提交 Pull Request，并遵循贡献指南与提交信息规范。

如果缺陷同样存在于上游，也欢迎向
[Mindwtr](https://github.com/dongdongbh/Mindwtr/issues) 反馈，让上游用户一并受益。

## 文档

- 📚 [本仓库文档](docs/)
- 📝 [发布说明索引](docs/release-notes/README.md)
- 🔒 [安全策略](SECURITY.md)
- ⚖️ [署名、许可证与变更说明](NOTICE.md)

上游 Mindwtr 的在线文档 <https://docs.mindwtr.app/> 对共有功能有更详细的说明。请注意它描述的是
上游项目而非本 fork，凡是 Tiny Bubbles 改动过的地方都会有出入。

## 许可证

Tiny Bubbles 采用 **GNU Affero 通用公共许可证第 3 版（AGPL-3.0-only）**，继承自上游
Mindwtr。完整条款见 [`LICENSE`](LICENSE)。

请注意 AGPL 第 13 条对网络使用的要求：如果你部署了 `apps/cloud/` 中的可选同步服务并供他人使用，
你必须向这些用户提供你所修改版本的完整对应源码。详见 [`NOTICE.md`](NOTICE.md)。

*「Mindwtr」是上游项目的名称，本 fork 不主张对该名称的任何权利。*
