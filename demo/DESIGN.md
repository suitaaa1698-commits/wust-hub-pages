---
name: 武科大资源汇总站 · 首页 Demo
description: 依据用户指定学院官网实现的校园资源门户本地预览。首页视觉已于 2026-09-22 获用户认可；是否替换原首页、是否推广到子页面仍未决定。
colors:
  navy: "#033e83"
  blue: "#005ca2"
  ink: "#263849"
  muted: "#52677a"
  line: "#dae4ee"
  pale: "#eaf3fa"
  paper: "#fff"
  subheading: "#526b84"
  focus: "#c37a0d"
typography:
  display:
    fontFamily: "STSong, SimSun, Songti SC, serif"
    fontSize: "43px"
    fontWeight: 600
    lineHeight: 1.55
    letterSpacing: "3px"
  headline:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "1px"
  title:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"
    fontSize: "15px"
    fontWeight: 500
    lineHeight: 1.7
  body:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.7
  navigation:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.7
  action:
    fontFamily: "Microsoft YaHei, PingFang SC, Noto Sans CJK SC, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.7
rounded:
  square: "0px"
  hero: "8px"
  circle: "50%"
spacing:
  compact: "8px"
  small: "12px"
  regular: "16px"
  medium: "20px"
  large: "24px"
  wide: "28px"
  section: "40px"
  column: "48px"
components:
  button-hero:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.navy}"
    typography: "{typography.action}"
    rounded: "{rounded.hero}"
    padding: "8px 19px"
  button-hero-hover:
    backgroundColor: "#dfeef7"
    textColor: "{colors.navy}"
  button-copy:
    backgroundColor: "#f8fafc"
    textColor: "{colors.blue}"
    rounded: "{rounded.square}"
    padding: "4px 10px"
  button-text:
    backgroundColor: "transparent"
    textColor: "{colors.blue}"
  search-input:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 13px"
  navigation-link:
    textColor: "{colors.navy}"
    typography: "{typography.navigation}"
  policy-row:
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    padding: "18px 0"
  policy-callout:
    backgroundColor: "{colors.pale}"
    textColor: "{colors.blue}"
    rounded: "{rounded.square}"
    padding: "19px 15px"
  service-icon:
    backgroundColor: "{colors.blue}"
    textColor: "{colors.paper}"
    rounded: "{rounded.circle}"
    width: "62px"
    height: "62px"
---

# Design System: 武科大资源汇总站 · 首页 Demo

## Overview

**Creative North Star: "校园资源门户"**

这是对 `web/demo/index.html`、`style.css`、`app.js` 当前实现的提取，作用域仅为 `web/demo/`。以上名称是对已实现气质的描述。首页视觉已于 2026-09-22 经用户查看实际页面后认可；本文件仍不代表已批准替换正式首页或统一各子页面，也不继承无关父目录产品的视觉权威。

用户指定的[武汉科技大学创新创业学院官网](https://cxcy.wust.edu.cn/)决定了校园纹理页头、校标、白底导航、校园摄影与蓝色栏目标题的组合。页面以密度适中的文字列表连接现有资源，保留“学生共建 · 非官方”身份。具体栏目编排属于本次首页方案，不作为所有未来页面的固定模板。

**Key Characteristics:**

- 校园摄影、蓝绿纹理与浅色建筑线描提供地域识别。
- 深蓝标题、功能蓝链接、细分隔线形成清晰层级。
- 文字列表和平面矩形为主，圆形仅用于快捷服务图标。
- 手机保留全部导航入口，并将主体内容改为单列。
- 预览独立、来源可查，现有功能页保留其当前界面。

素材文件及原始网址见 `assets/sources.json`，包括校标、页头纹理、三幅校园照片和建筑背景；本次素材用途是本地设计预览。通知快照及原文链接见 `notices.js`，整理日期为 2026-09-22。产品边界见本目录 `PRODUCT.md`，首页方案见 `../../docs/homepage-redesign-proposal.md`。

## Colors

蓝色承担机构式导航与功能层级，白色和浅蓝承载信息，纹理图片中的蓝绿变化来自指定参考素材。

### Primary

- **校园深蓝（navy）**：站点导航、栏目标题、年份数字和横幅按钮文字。
- **功能蓝（blue）**：正文链接、短下划线、群号操作、服务图标背景。

### Neutral

- **正文墨色（ink）**：长标题与正文，避免所有文字都成为强调色。
- **辅助灰蓝（muted）**：来源、日期、统计说明和搜索反馈；记录的是可读性修正后的最终值。
- **栏目灰蓝（subheading）**：当前栏目英文副标题和快捷服务副标题；这是现有页面用色，不意味着所有未来栏目必须附加英文。
- **浅线蓝（line）**：实线或虚线分隔，主要依靠结构而非色块区分条目。
- **浅蓝底（pale）**：政策提示入口、群号按钮悬停。
- **白纸（paper）**：主内容背景和横幅操作底色。
- **焦点琥珀（focus）**：键盘操作状态的轮廓，属于交互提示色。

颜色值以顶部 token 为准。`../../.impeccable/review/demo-fix-checks.json` 记录的五个修正后文字组合对比度为 4.83–5.53；这只证明已测组合，不是全页面的无障碍认证。

## Typography

**Display Font:** STSong、SimSun、Songti SC、serif。横幅和历史导览使用宋体字形，延续校园出版物气质。

**Body Font:** Microsoft YaHei、PingFang SC、Noto Sans CJK SC、sans-serif。界面和信息正文依赖本机中文字体，不下载外部字体。Arial 用于日期、年份及部分数字；数字使用等宽数字特性，便于纵向扫描。

### Hierarchy

- **Display**：使用顶部 display token；宽屏（至少 1600px）升为 48px，820px 以下为 36px，540px 以下为 29px、行高 1.65、字距 1px。
- **Headline**：栏目主标题采用 headline token；手机降为 22px。
- **Title / Body**：通知与政策标题采用 title token，页面基准采用 body token；手机条目标题降为 14px，通知行高为 1.8。
- **Label**：label token 对应“更多”、来源入口等小型辅助文字；不同元数据在现有页面中使用 10–13px，不能据此把小字号升级为所有正文的默认值。
- **Navigation / Action**：顶部 navigation 与 action tokens 描述桌面导航和横幅操作。导航在 820px 以下为 15px，540px 以下为 14px。

英文栏目副标题的现有 9–11px 字号与字距仅作局部参考实现记录，未建立通用的装饰性标签规范。系统中文字体用于界面，不作为新增展示标题的设计主张。

## Layout

桌面容器为 `min(1240px, calc(100% - 80px))`，内容网格比例为 1.85:1，纵向间隔 54px、列间隔 48px。页头最小高度 136px，导航链接最小高度 62px，横幅高度 418px。列表依靠连续对齐的标题、日期、来源形成阅读顺序；政策标题先于分类和日期。

- **1100px 以下**：容器左右各留 24px，主体列比例变为 1.6:1，列间隔 32px。
- **820px 以下**：主体单列；搜索与工具进入单独一行，搜索结果为两列；导航仍为六列，横幅为 380px。
- **540px 以下**：容器左右各留 18px；导航三列两行，每项至少 47px 高；搜索结果单列；横幅为 350px；快捷服务三列；历史年份两列。
- **1600px 以上**：横幅为 466px，增加摄影展示高度。

当前首页四个内容区的次序是页面方案，不是全站布局约束。桌面与手机截图见 `../../.impeccable/review/demo-1440.png`、`demo-390.png`，搜索状态见 `demo-search-390.png`。`demo-checks.json` 记录了 320–1440px 的无横向溢出检查。

## Elevation & Depth

界面基本平面化，层级来自底色、留白、边线和纹理。横幅用渐变遮罩保证叠加文字清楚，标题和照片说明使用轻微文字阴影。阴影不是所有容器的默认装饰；唯一面板投影用于短暂出现的复制反馈（`0 4px 22px #07284522`）。具体遮罩、文字阴影、焦点轮廓和动效记录在本目录 `.impeccable/design.json`，不进入前置 token schema 不支持的字段。

页面只有颜色转换（横幅按钮 0.16s、服务图标 0.15s）与平滑回到顶部；尊重 `prefers-reduced-motion`，该状态下禁用过渡并使用即时滚动。三幅横幅每 5 秒自动切换并循环，手动选图后重新计时；横幅右下角的暂停按钮可停止或恢复自动轮播，系统开启减少动态效果时默认暂停。

## Shapes

横幅主入口使用 8px 圆角；输入、群号按钮和提示面仍为方角，内容条目没有独立圆角外壳。服务图标底座为正圆，桌面 62px、820px 以下 54px、540px 以下 52px。列表以 1px 细线或虚线分隔，栏目标题下有短蓝线；这些装饰服务于既有学院门户语汇，不应扩张为每段正文的装饰条。

## Components

### Buttons

横幅主入口采用白底深蓝字，8px 圆角，最小高度 44px，箭头由 SVG 表达。文字按钮用于关闭搜索；群号按钮采用浅色背景、细边框和等宽数字。链接与按钮共用 3px 琥珀焦点轮廓，偏移 4px；页头搜索框不使用该轮廓，聚焦时以蓝色边框提示，避免在纹理页头上出现突兀的黄色描边。各组件预览的完整状态 CSS 在 sidecar 中。

### Inputs / Fields

搜索框以浅白色表面放在纹理页头，桌面高 40px、手机高 42px，输入有可访问标签和 100 字限制。提交后显示页面内结果；多个关键词按同时包含匹配，覆盖赛事、政策与群号，最多显示 12 项。清空、关闭与 Escape 均可收起结果；关闭恢复输入焦点。空结果和数据未载入都有说明。

### Navigation

六个文字入口始终可见，当前首页用底部短线标记。手机变为两行，不依赖隐藏菜单或悬停。目的地为现有五个功能模块，跳转后仍是模块原有界面。

### Lists / Containers

通知行将发布日期与标题并列，标题在桌面最多两行、手机最多三行。通知、政策、年份与群条目在悬停或键盘聚焦时整行底色变为浅蓝 `#edf5fa`，主要文字同步转为功能蓝，与顶部导航的悬停反馈一致。政策行先标题、再分类和发布日期、再来源，没有类别装饰竖条。历史入口按有效的记录起始日期统计往年、展示最近四个年份，明确包含待核实记录。资源总数由现有静态数据计算，缺失时使用破折号或说明，不能作为预设视觉数字写死。

政策提示是浅蓝矩形整体链接；快捷服务是圆形线描图标与文字组合。图标使用内联 SVG 路径或当前页面 sprite，装饰图标对读屏隐藏。页面没有独立 chip/tag 组件，分类为普通文字。

### Clipboard Feedback

群号展示负责单位、赛事届次和来源。复制成功以 `role="status"` 提示，约 4.5 秒后收起；剪贴板不可用时显示只读输入并选中群号，支持手动复制。群号条目不宣称当前仍可报名或入群。

## Do's and Don'ts

### Do:

- **Do** 将本文件用于独立首页 Demo 的维护；首页视觉已获用户认可，但替换原首页与推广到子页面仍待决定。
- **Do** 保留校内素材的逐项来源和学生共建、非官方身份说明。
- **Do** 让标题先于元数据，使用可读的辅助灰蓝，保留键盘焦点与手机导航入口。
- **Do** 保留真实数据、原文链接、缺失状态和手动复制后备操作。

### Don't:

- **Don't** 将此预览自动提升为正式站点或父目录项目的设计权威。
- **Don't** 把截图数字、通知快照或群号届次包装成实时状态。
- **Don't** 把本次首页的栏目顺序、英文副标题和图文构图规定为所有未来页面的模板。
- **Don't** 因文档已记录素材而视为已经完成公开部署准备；当前仍保留原始高分辨率照片，发布前的资源压缩尚未实施。
