# 项目协作规则

- 本项目后续开发、提交和协作以 https://github.com/sd5913/sendhome 为准，默认分支为 main。
- 需要删除文件时，一律先申请用户权限，再移入废纸篓/回收站。
- 如果无法移入废纸篓/回收站，停止操作并询问用户。

## 单一引擎规则

- 所有关卡共用 `game/engine.mjs` 的物理、角色属性、碰撞、承载、负重、机关与通关逻辑。
- 输入、渲染、镜头和界面统一使用 `game/app.mjs`、`game/index.html`、`game/style.css`。
- 新关卡只新增 `levels/<id>.json` 地编数据，并登记 `levels/index.json`；不得复制引擎、按关卡 ID 分支或设置关卡专用物理参数。
- 老入口仅可跳转或重导出，不得重新实现运行逻辑。
- 运行 `node --test game/engine.test.mjs level-1/engine.test.mjs`。Pages 统一使用 `scripts/build_site.py` 打包，自动为共享脚本生成内容哈希版本。
