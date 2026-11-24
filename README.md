# sendhome · 送小鱼回家

二维合作解谜游戏的整合仓库，包含可玩的原型、从设定稿提取的角色动画与视差背景、角色设计、场景美术与原始设计文档。

**后续开发、提交与协作统一使用：https://github.com/sd5913/sendhome 。默认开发分支为 `main`。**

## 试玩关卡 1

正式游戏入口：[在线试玩](https://sd5913.github.io/sendhome/)（GitHub Pages 部署成功后可访问）。

在仓库根目录运行 `python3 -m http.server 8000`，打开 http://localhost:8000/level-1/ 。按 GDD 与手绘蓝本搭建的基础移动教学关，支持三鱼切换、跳跃、跌落复位与全员集合判定。详见 [关卡说明](level-1/README.md)。

## 代码结构与关卡编辑

所有关卡使用同一套代码：

| 位置 | 职责 |
| --- | --- |
| `game/engine.mjs` | 唯一物理与玩法引擎：角色、碰撞、推鱼、承载、负重、箱子、压板、钥匙、门、通关 |
| `game/app.mjs`、`game/index.html`、`game/style.css` | 共享输入、绘制、镜头、暂停、重置和界面 |
| `levels/level-1.json` | 正式第一关地编 |
| `levels/mechanics-test.json` | 机关测试场地编 |
| `levels/index.json` | 可选关卡目录 |
| `scripts/build_site.py` | 只打包一份引擎与界面，并按内容生成资源版本，防止旧脚本缓存 |

新增关卡仅需添加 JSON 并登记目录；角色尺寸、重量、速度、跳跃、承载公式等全局规则不可在关卡中覆盖。地编可配置平台、出生点、检查点、机关摆放与关联、标签和引导文字。旧的 `level-1/`、`game-whitebox/` URL 保留为跳转入口，不再包含独立实现。

验证：`node --test game/engine.test.mjs level-1/engine.test.mjs`。部署前也会运行这些测试。

## 内容

- [`levels/`](levels/)：所有关卡的纯 JSON 地编。
- [`game/`](game/)：所有关卡共用的运行代码。
- [`game/art/`](game/art/)：从设计稿裁出的角色五帧序列、三层视差背景和终点门（由 `scripts/build_art.py` 生成）。
- [`scripts/build_art.py`](scripts/build_art.py)：把 `assets/` 里的设定图裁成透明背景的游戏素材；需要 Pillow，只在重新生成素材时运行。
- [`level-1/`](level-1/)：第一关入口、说明及路线验证。
- [`game-whitebox/`](game-whitebox/)：机关测试场兼容入口及操作说明。
- [`CHARACTER_DESIGN.md`](CHARACTER_DESIGN.md)：三条鱼的角色属性与设计过程。
- [`assets/characters/`](assets/characters/)：角色设定图及五帧动画参考。
- [`assets/environment/`](assets/environment/)：双语场景设计图。
- [`期末teamwork.docx`](期末teamwork.docx)：原始游戏设计文档。

## 本地运行

在仓库根目录执行：

```sh
python3 -m http.server 8000
```

浏览器打开 http://localhost:8000/game-whitebox/ 。所有场景均需通过本地 HTTP 服务器或在线 Pages 运行（ES 模块和关卡 JSON 不能通过 file:// 读取）。

移动：A/D 或方向键；跳跃：W/空格/↑；冲刺：Shift；切换角色：1/2/3、Tab 或点击画面中的小鱼；暂停：Esc；重置：长按 R。

## 整合来源

2026-11-19 将 https://github.com/nolaLV999/codesk 的两个分支完整合并至本仓库，保留双方提交历史：

| 来源分支 | 原始提交 | 内容 |
| --- | --- | --- |
| `main` | `94319fe56cdaa2bce51246fe1adc33eeabacde94` | 角色、动画、场景美术与设计文档 |
| `whitebox-playable-test` | `bb6e80b76e55ae5e283a9229694be4c45e9f559b` | 可玩原型与 Pages 工作流 |

美术资料与白模代码已归档到同一个项目。角色、三层视差背景和终点门已从设定图裁成透明素材接入运行画面；箱子、压板、钥匙等道具的设定图目前仍是单张插画，尚未做成可拼接的精灵，所以这些道具暂时保持几何绘制。

Pages 在 `main` 上的游戏或部署配置更新后自动发布，也可在 Actions 中手动运行 `Deploy game to GitHub Pages`。站点根入口打开正式关卡 1；旧机关测试关保留在 `/game-whitebox/`。所有关卡统一从 `/game/` 加载，旧入口自动跳转。部署仅包含游戏运行文件，不上传设计文档、测试代码或原始蓝本。
