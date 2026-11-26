# 关卡手绘蓝本

这里存放关卡设计的手绘格线图，作为 `levels/*.json` 地编的原始依据。

| 文件 | 对应关卡 | 说明 |
| --- | --- | --- |
| [`lv1-blueprint.jpg`](lv1-blueprint.jpg) | `levels/level-1.json` | 基础移动教学：起点平台、下行阶梯、两个跳台与右侧检查点 |
| [`lv2-blueprint.jpg`](lv2-blueprint.jpg) | `levels/level-2.json` | 钥匙与重量：柱子、钥匙、钥匙门、压板与压板门、房间及地面上的集合点 |
| [`lv3-blueprint.jpg`](lv3-blueprint.jpg) | `levels/level-3.json` | 撞门与分工：石屋与撞门、柱子、压板门、两段平台、矮墙、压板、箱子和集合点 |

蓝本只表达大致结构，实际格子坐标以 JSON 为准。读取地编时，一格为 36 px；蓝本上的 P1/P2、`key`、`door`、`压力板`、`check point` 等标注对应 JSON 里的 `spawns`、`keys`、`doors`、`plates` 与 `goal`。

新增关卡时，把新的手绘图放进本目录，并在上表登记；运行画面只读取 `levels/` 里的 JSON，本目录不参与部署。
