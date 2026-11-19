# sendhome · 送小鱼回家

二维合作解谜游戏的整合仓库，包含可玩的白模原型、角色设计、动画参考、场景美术与原始设计文档。

**后续开发、提交与协作统一使用：https://github.com/sd5913/sendhome 。默认开发分支为 `main`。**

## 试玩关卡 1

在仓库根目录运行 `python3 -m http.server 8000`，打开 http://localhost:8000/level-1/ 。按 GDD 与手绘蓝本搭建的基础移动教学关，支持三鱼切换、跳跃、跌落复位与全员集合判定。详见 [关卡说明](level-1/README.md)。

## 内容

- [`level-1/`](level-1/)：关卡 1、独立物理模块及路线验证。
- [`game-whitebox/`](game-whitebox/)：原生 HTML Canvas / JavaScript 游戏原型及操作说明。
- [`CHARACTER_DESIGN.md`](CHARACTER_DESIGN.md)：三条鱼的角色属性与设计过程。
- [`assets/characters/`](assets/characters/)：角色设定图及五帧动画参考。
- [`assets/environment/`](assets/environment/)：双语场景设计图。
- [`期末teamwork.docx`](期末teamwork.docx)：原始游戏设计文档。

## 本地运行

在仓库根目录执行：

```sh
python3 -m http.server 8000
```

浏览器打开 http://localhost:8000/game-whitebox/ 。也可直接打开 `game-whitebox/index.html`。

移动：A/D 或方向键；跳跃：W/空格/↑；冲刺：Shift；切换角色：1/2/3 或 Tab；暂停：Esc；重置：长按 R。

## 整合来源

2026-11-19 将 https://github.com/nolaLV999/codesk 的两个分支完整合并至本仓库，保留双方提交历史：

| 来源分支 | 原始提交 | 内容 |
| --- | --- | --- |
| `main` | `94319fe56cdaa2bce51246fe1adc33eeabacde94` | 角色、动画、场景美术与设计文档 |
| `whitebox-playable-test` | `bb6e80b76e55ae5e283a9229694be4c45e9f559b` | 可玩原型与 Pages 工作流 |

美术资料与白模代码已归档到同一个项目；白模仍使用几何图形，尚未接入角色图片。

Pages 工作流保留为手动触发。需要公开网页时，可在新仓库 Actions 中运行 `Deploy whitebox to GitHub Pages`。
