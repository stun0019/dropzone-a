# Dropzone

1280 × 720 橫向 Three.js 捕獲射擊原型。開發原始碼已從 HTML 拆為原生 ES modules。

## 啟動

需要 Node.js 20.19+ 或 22.12+ 與 pnpm。

這台電腦已安裝依賴，可直接雙擊 `start.cmd` 啟動並開啟瀏覽器。關閉該命令列視窗會停止伺服器。

```sh
pnpm install
pnpm dev
```

開啟終端機顯示的本機網址。首頁為 `index.html`；`dropzone-lite.html` 保留相容入口。原始碼透過 Vite 解析 Three.js 套件，請勿直接雙擊 HTML 或以不處理套件匯入的靜態伺服器執行原始碼。

```sh
pnpm test
pnpm build
pnpm preview
```

`dist/` 是可放到一般靜態伺服器的部署產物。Three.js 隨打包結果提供，不再於遊玩時向 CDN 匯入。`pnpm-lock.yaml` 固定依賴版本。

## 結構

| 檔案 | 職責 |
| --- | --- |
| `src/main.js` | 應用入口 |
| `src/bootstrap.js` | 初始化共享狀態、綁定輸入與啟動 |
| `src/runtime.js` | 遊戲執行中的可變狀態；模組以明確匯入存取 |
| `src/config.js` | 世界分區、MOB/BOSS、武器射速、倍率與 RTP 設定 |
| `src/economy.js` | 掉落抽選、平均倍率、捕獲機率 |
| `src/session.js` | 開始、結束、換關、生成節奏 |
| `src/world.js` | 地形、建物、樹木、關卡配色 |
| `src/models.js` | 程序化角色、載具及材質 |
| `src/assets.js` | GLTFLoader、模型快取、GLB clone、武器掛載及 fallback |
| `src/animation.js` | AnimationMixer、動作辨識、playAnimation |
| `src/actors.js` | MOB 生成、行為與碰撞 |
| `src/navigation.js` | 尋路、避障及目前共用的回收工具 |
| `src/player.js` | 玩家、隨從、AUTO 選敵、鎖定 |
| `src/input.js` | BET 與搖桿輔助函式 |
| `src/combat.js` | 射擊、命中特效、手榴彈、延遲捕獲結算 |
| `src/events.js` | 空投、隨機裝備、懸賞、感染區 |
| `src/audio.js` | 合成音樂與音效 |
| `src/engine.js` | 更新迴圈、鏡頭、渲染、尺寸 |
| `src/hud.js` | 現有 HUD 資料與訊息更新 |
| `src/ui.js` | WebGL UI、戰術面板及觸控命中區 |
| `styles/game.css` | 頁面及既有相容 UI 樣式 |
| `tests/` | 對實際模組執行的事件、結算與 UI 行為回歸測試 |

## GLB 模型

模型放在 `public/assets/models/`。目前沒有提供任何 GLB 時，所有角色和武器會自動使用既有程序化模型，遊戲仍可啟動。

```text
public/assets/models/
├─ player/player.glb
├─ enemies/zombie.glb, soldier.glb, brute.glb, spitter.glb
├─ bosses/armor-tyrant.glb, toxic-beast.glb, heavy-warlord.glb
├─ vehicles/jeep.glb, tank.glb
└─ weapons/rifle.glb, laser.glb, shotgun.glb, rocket.glb, grenade.glb
```

所有路徑及比例集中在 `src/config.js` 的 `MODEL_CONFIG`。檔名需與設定一致；要新增角色，先在 `MODEL_CONFIG` 新增 key 和 path，再讓 `MOB_TYPES` 或 `BOSS_TYPES` 使用該 key。要新增武器，在 `MODEL_CONFIG` 的 `weapons` 路徑對應 key，`events.js` 會在模型可用時自動掛載，沒有掛點則使用 local mount 設定。

模型可包含 `Idle`、`Walk`、`Run`、`Shoot`、`Hit`、`Death` clip。載入器會忽略大小寫、底線、空白及常見 Mixamo 前綴；每個角色獨立建立 `AnimationMixer`。武器掛點可命名為 `GunMount`、`WeaponMount`、`RightHand` 或 `Hand_R`。

啟動時會先預載入 `MODEL_CONFIG` 中的所有模型並顯示 `Loading Models... n / total`。缺檔或載入錯誤會記錄為 fallback，完成後才解鎖 DEPLOY；同一 GLB 只下載一次，生成時使用快取 clone。GLB clone 不會在角色回收時釋放共享 geometry/material。

## 維護約定

- 調整怪物與武器數值先看 `config.js`。修改機率後執行測試。
- 狀態只透過 `runtime` 修改；不要建立 window 全域變數。模組載入階段不啟動遊戲，統一由入口初始化。
- HTML 不放內嵌遊戲 JavaScript 或樣式。兩個 HTML 入口需同步保留宿主元素。
- 此次整理保持既有玩法及數值；沒有加入前輪評估中的新獎項表、後端結算或感染者增量。
- 目前仍保留隱藏 DOM 作為舊 HUD 的資料橋接，WebGL UI 仍使用 CanvasTexture。這是既有實作的模組化，不代表已換成圖集/SDF UI。
- 目前模組間仍有遊戲流程的循環函式依賴；初始化集中，避免在模組頂層呼叫跨模組函式。後續可逐步引入事件通知與更細的狀態所有權。
- 測試使用真實 Three.js 計算與模擬 DOM；可驗證行為，但不能代替 WebGL 畫面、實機觸控與 FPS 測試。

## 下一輪可獨立處理

1. 將 HUD 資料橋接改為專用 UI 狀態，移除隱藏 DOM 與過時 CSS。
2. 拆出資源池，導入空間索引及 AI 分幀，然後提高感染者數量。
3. 將投注批次與獎項表獨立測試，補充大量統計驗證。
4. 將 AUTO 導航改成明確狀態機，改善卡牆恢復。
