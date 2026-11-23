# 机关测试场

此场景已迁移至共享引擎；旧地址 `/game-whitebox/` 自动跳转到 `/game/?level=mechanics-test`。

在仓库根目录运行 `python3 -m http.server 8000`，打开 http://localhost:8000/game/?level=mechanics-test 。

地编：`levels/mechanics-test.json`；物理与机关：`game/engine.mjs`；输入、界面、渲染、镜头：`game/app.mjs`。与正式关卡共用所有角色规则，包括实体碰撞、鱼背跟随和负重减速。

- A/D 或方向键移动，W/空格/↑ 跳跃，1/2/3、Tab 或点击画面中的小鱼切换，Shift 冲刺，Esc 暂停，长按 R 重置。
- A 无法推箱，B 和 C 可推；箱子受地形、鱼和关闭的门阻挡。
- 更重的鱼可以推开更轻的鱼；推力随背上乘客重量下降，负重过大时推不动。具体公式见 `level-1/README.md`。
- 压板重量达到 4 时开门，叠站乘客重量也计入；移走负重后关门，门内有鱼或箱子时防夹。
- 任意鱼拿钥匙会解锁关联门；冲刺速度达到门的配置值时撞破门。
- 三条鱼须同时进入终点检测框（有任意重叠面积即可）并落地或叠站才通关，到达后仍可移动。

测试：`node --test game/engine.test.mjs level-1/engine.test.mjs`。
