import { useEffect, useRef, useState } from "react";
import type { HomeState } from "../shared/contracts";
import { useArtwork } from "../shared/useArtwork";
import "./home.css";

const themes = [
  { id: "sunny", label: "☀ 晴日" },
  { id: "night", label: "☾ 星夜" },
  { id: "candy", label: "✿ 糖果" },
];
const furnitureOptions = [
  { id: "cushion", label: "软软坐垫" },
  { id: "box", label: "秘密纸箱" },
  { id: "cloud", label: "云朵沙发" },
];
const reactions = {
  hug: "抱紧一点，再待一会儿～",
  dance: "来跳一支小舞！",
  nap: "呼……在小窝睡一会儿。",
};
type HomeReaction = keyof typeof reactions;

export function HomeApp() {
  const [state, setState] = useState<HomeState | null>(null);
  const [reaction, setReaction] = useState<HomeReaction | null>(null);
  const [score, setScore] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [fishPosition, setFishPosition] = useState({ x: 10, y: 10 });
  const artwork = useArtwork(state?.characterId ?? null, window.taoqiHome.getArtwork);

  const room = useRef<HTMLDivElement>(null);
  const fish = useRef<HTMLButtonElement>(null);
  const reactionTimer = useRef<number | undefined>(undefined);
  const gameTimer = useRef<number | undefined>(undefined);
  const gameEndsAt = useRef(0);
  const scoreRef = useRef(0);

  useEffect(() => {
    const offState = window.taoqiHome.onState(setState);
    window.taoqiHome.getState().then(setState);
    return () => {
      offState();
      clearTimeout(reactionTimer.current);
      clearInterval(gameTimer.current);
    };
  }, []);

  function showReaction(action: HomeReaction) {
    setReaction(action);
    clearTimeout(reactionTimer.current);
    reactionTimer.current = window.setTimeout(
      () => setReaction(null), action === "nap" ? 3500 : 1900
    );
  }

  function placeFish() {
    const x = 10 + Math.random() * Math.max(0, room.current!.clientWidth - 74);
    const y = 10 + Math.random() * Math.max(0, room.current!.clientHeight - 74);
    setFishPosition({ x: Math.round(x), y: Math.round(y) });
  }

  function finishGame() {
    if (gameTimer.current === undefined) return;
    clearInterval(gameTimer.current);
    gameTimer.current = undefined;
    setSecondsLeft(null);
    void window.taoqiHome.saveScore(scoreRef.current);
  }

  function startGame() {
    if (gameTimer.current !== undefined) return;
    scoreRef.current = 0;
    setScore(0);
    gameEndsAt.current = Date.now() + 20000;
    setSecondsLeft(20);
    placeFish();
    // The round owns this interval; both timeout and "结束本局" call finishGame.
    gameTimer.current = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((gameEndsAt.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) finishGame();
    }, 200);
    window.setTimeout(() => fish.current?.focus(), 0);
  }

  function catchFish() {
    scoreRef.current++;
    setScore(scoreRef.current);
    placeFish();
  }

  const playing = secondsLeft !== null;

  return (
    <>
      <header>
        <div>
          <span className="eyebrow">TAOQI LITTLE HOME</span>
          <h1>欢迎回小窝</h1>
          <p>给伙伴换个房间，玩一会儿，再一起回到桌面。</p>
        </div>
        <span className="free-badge">免费 · 离线 · 无需登录</span>
      </header>
      <main>
        <section className="room-panel" aria-label="宠物的小窝">
          <div id="room" ref={room} className="room" data-theme={state?.themeId ?? "sunny"}>
            <div className="room-window" aria-hidden="true" />
            <div className="room-shelf" aria-hidden="true"><span>✦</span><span>✿</span><span>✦</span></div>
            <div className="room-floor" aria-hidden="true" />
            <div id="furniture" className="furniture"
              data-furniture={state?.furnitureId ?? "cushion"} aria-hidden="true" />
            <div id="room-pet" className="room-pet"
              data-decoration={state?.decorationId ?? "none"}
              data-reaction={reaction ?? undefined}>
              <img id="room-pet-art" src={artwork ?? undefined} alt="" draggable={false} />
              <span className="room-accessory" aria-hidden="true" />
            </div>
            <button id="fish-target" ref={fish} className="fish-target" type="button"
              aria-label="抓住小鱼" hidden={!playing}
              style={{ left: fishPosition.x, top: fishPosition.y }}
              onClick={catchFish}>🐟</button>
            <p id="reaction" className="reaction" role="status" aria-live="polite">
              {reaction ? reactions[reaction] : ""}
            </p>
          </div>
          <div className="room-caption">
            <strong id="pet-name">{state?.characterName ?? "小伙伴"}</strong>
            <span>你布置的小窝会保存在本机</span>
          </div>
        </section>
        <aside className="controls">
          <section>
            <h2>换个天气</h2>
            <div className="choice-list" id="theme-options" aria-label="小窝场景">
              {themes.map((theme) => (
                <button key={theme.id} type="button" data-theme={theme.id}
                  aria-pressed={state?.themeId === theme.id}
                  onClick={() => window.taoqiHome.setTheme(theme.id)}>{theme.label}</button>
              ))}
            </div>
          </section>
          <section>
            <h2>摆点家具</h2>
            <div className="choice-list" id="furniture-options" aria-label="小窝家具">
              {furnitureOptions.map((choice) => (
                <button key={choice.id} type="button" data-furniture={choice.id}
                  aria-pressed={state?.furnitureId === choice.id}
                  onClick={() => window.taoqiHome.setFurniture(choice.id)}>{choice.label}</button>
              ))}
            </div>
          </section>
          <section>
            <h2>陪它一下</h2>
            <div className="choice-list actions">
              <button type="button" onClick={() => showReaction("hug")}>抱抱</button>
              <button type="button" onClick={() => showReaction("dance")}>跳舞</button>
              <button type="button" onClick={() => showReaction("nap")}>打盹</button>
            </div>
          </section>
          <section className="game-card">
            <h2>抓小鱼 · 20 秒</h2>
            <p>点中游走的小鱼，看看今天能抓到几条。没有奖励门槛，随时可以结束。</p>
            <div className="game-stats">
              <span id="game-score">本局 {score} 条</span>
              <span id="game-time">
                {playing ? "剩余 " + secondsLeft + " 秒" : "准备好了就开始"}
              </span>
            </div>
            <div className="game-stats">
              <span id="best-score">最佳 {state?.bestCatch ?? 0} 条</span>
            </div>
            <div className="game-buttons">
              <button id="start-game" className="primary-button" type="button"
                disabled={playing} onClick={startGame}>开始抓鱼</button>
              <button id="finish-game" type="button" hidden={!playing}
                onClick={finishGame}>结束本局</button>
            </div>
          </section>
        </aside>
      </main>
    </>
  );
}
