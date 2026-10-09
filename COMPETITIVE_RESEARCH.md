# 竞争研究与产品判断

研究日期：2026-10-09。范围：分析师保持 Jupyter 工作流，领域专家阅读已有结果、给出反馈，分析师提交新版后双方核对。不是通用云端 Notebook 编辑器。

## 证据分级

- **已验证**：本次读取的官方功能/价格文档、公开仓库/Issue；本产品代码与自动化实测。
- **合理推测**：基于公开工作流程推断的迁移/操作负担，不等于用户测试。
- **未验证假设**：团队愿意为独立快照审阅迁移、付费或再次使用。
- 尝试在 Chromium 打开 Colab 入门 Notebook、Hex 演示与 ReviewNB 入口。Colab 页面未出现可操作内容；其余部分入口 DNS 失败。通过官方 Hex A/B 测试页面找到真实嵌入应用，但网络读取也未获得可操作内容。未登录竞品、未上传数据、未完成竞品任务。**不提供竞品响应速度、任务成功率或实际操作耗时排名。** 网站加载失败只说明本次研究条件，不证明产品有缺陷。

## 竞品对照（价格为页面所示美元，非报价承诺）

| 产品 | 功能与典型步骤（官方文档） | 比我们好的地方 | 价格/限制 | 与本产品的适用边界 |
| --- | --- | --- | --- | --- |
| [ReviewNB](https://www.reviewnb.com/) | 连接 GitHub/Bitbucket → 打开 Notebook/提交/PR → 单元格或行级讨论 → 关闭讨论；有可视差异与邮件提醒 | 成熟 Git 审阅、代码/Markdown/输出差异、线程与通知；官网展示的渲染界面比原 MVP 清晰 | Team $79/月，最多10位使用者；教育和开源免费；私有库试用后有10个免费PR | 已使用 Git PR 的团队优先用它。我们仅可能降低非 Git 审阅者的账号与流程负担；不能声称教育用户有价格优势 |
| [Deepnote](https://deepnote.com/docs/comments) | 进入项目 → 点击块评论 → Post；侧栏点反馈跳回块，可回复、编辑、关闭与 @ 提醒 | 评论导航、富文本、实时协作、历史与数据展示更完整；[审阅文档](https://deepnote.com/docs/code-reviews)介绍历史、锁定和 nbdime | [Free](https://deepnote.com/pricing)：3编辑者、5项目、7天历史；Team 页面显示 $39/编辑者/月，按年付费；观看者数量不收费，计算/AI另有额度 | 已在 Deepnote 工作的团队没有明显换用理由。我们的潜在优势是只审阅已有 ipynb，无需迁移分析执行环境 |
| [Hex](https://learn.hex.tech/docs/collaborate/comments) | 打开 Notebook/发布应用 → 单元格评论；总评论侧栏可定位、回复、关闭；[Reviews](https://learn.hex.tech/docs/collaborate/reviews)可请求修改或批准发布 | 评论索引、权限层级、通知、审批闭环；发布应用与逻辑视图区分清楚，信息架构成熟 | [价格](https://hex.tech/pricing/)：Community免费，Professional $36/编辑者/月，Team $75/编辑者/月；审批在Team/Enterprise；评论所有方案均有 | 不应重做 Hex 的应用构建/审批平台。现有 Hex 客户宜沿用；我们服务无需应用发布的快照核对 |
| [Google Colab](https://research.google.com/colaboratory/faq.html) | 打开/导入 Notebook → Share → 按 Drive 权限共享；内容、代码、输出和评论一起共享 | 免费、熟悉的共享方式、完整 Notebook 阅读/执行与生态，比当前 MVP 成熟 | 有免费层；运行资源动态限制，付费页面受登录限制，本次未核实地区价格 | 免费替代方案足够强，不能假定审阅必须买工具。我们不运行代码，专注不可变基线与修订复核；是否值得另用一个工具尚未验证 |
| [nbdime](https://nbdime.readthedocs.io/en/latest/) / [开源仓库](https://github.com/jupyter/nbdime) | 安装 → `nbdiff-web old.ipynb new.ipynb` → 阅读结构化差异；支持 Git 和合并冲突处理 | 内容感知匹配、图像差异与合并比我们强。我们保持保守匹配，不猜测无ID的修改单元格 | 免费开源；需要Python/本机服务或集成环境，没有托管邮箱审阅工作区 | 分析师只想核对两份文件时优先用它；只有跨专业评论与复核交接才可能需要我们的产品 |

以上价格包含的服务不同，不能用标价直接证明我们成本更低。我们的软件没有另设订阅收费，但仍有部署、数据库和邮件成本。

## 用户反馈与反证

1. [Jupyter 2026 用户调查](https://blog.jupyter.org/posts/2026/what-you-told-us-results-from-the-2026-jupyter-user/)：542位回答者；版本控制/协作是主题之一，但“审阅和评论”仅有3条相关回答。支持需求存在，**不支持市场很大或愿意付费**。调查提供 Git/Jupytext/nbdime 等现成办法，不能忽略。
2. [nbdime Issue #507](https://github.com/jupyter/nbdime/issues/507)：用户称工具很有用，但不清楚如何在 JupyterLab 中比较不同名字的两份文件。2020年的单个仍开放Issue，是可发现性线索，不证明今天所有集成都无法比较。
3. [Colab Issue #6103](https://github.com/googlecolab/colabtools/issues/6103)：2026-09-17用户报告平板文本选择异常。未复现；不能泛化成Colab普遍不可用，也不是我们的市场证据。启发我们检查窄屏布局、文本阅读与返回上下文。
4. [社区讨论：Google docs for notebooks](https://www.reddit.com/r/Python/comments/1i6tj4d/)：另一个作者也面向非技术协作者，回复指出Colab已有类似能力。这是重要反证：简单共享并非空白市场。社区经历和推广不能视为规模化需求证据。
5. ReviewNB教育免费、Deepnote免费层、Hex现成评论和审批，都会削弱“更便宜”“功能独有”的主张。真正可检验的定位只有：**继续用现有Jupyter，通过轻量快照让非Git伙伴反馈并核对修订**。

## 本轮决定

先修复复核状态无法完成、静态部署路径与登录竞态，再减少反馈查找和上下文往返负担，补齐常用文本阅读与差异。保留现有身份/RLS/不可变基线，不增加AI、仪表盘、实时编辑、通知基础设施或代码执行。

建议开展5个真实团队的比较任务：与他们实际使用的Colab、Deepnote或HTML+共享文档比较反馈定位、核对改动、错位反馈和次周复用。30%反馈定位时间下降及至少3队自愿复用是**预设继续门槛，尚未达到**。如果现有平台已经足够简单，或团队不愿进行快照交接，应停止扩大功能。
