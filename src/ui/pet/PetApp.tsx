import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { PetReaction, PetState } from "../shared/contracts";
import { useArtwork } from "../shared/useArtwork";
import { ArtworkPlayer } from "../shared/ArtworkPlayer";
import { reactionMessage } from "./reactions";
import "./pet.css";

function focusLabel(focusEndsAt: number) {
  const seconds = Math.max(0, Math.ceil((focusEndsAt - Date.now()) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const rest = String(seconds % 60).padStart(2, "0");
  return "专注 " + minutes + ":" + rest;
}

function artworkId(characterId: string | undefined, reaction: PetReaction | null,
  motion: "idle" | "walk") {
  if (characterId !== "gugugaga-idle") return characterId ?? null;
  if (reaction === "double") return "gugugaga-happy";
  if (reaction === "feed" || reaction === "play") return "gugugaga-worker";
  if (reaction === "praise") return "gugugaga-prayer";
  if (reaction === "look") return "gugugaga-daydream";
  if (reaction === "nap") return "gugugaga-pajamas";
  if (reaction === "long") return "gugugaga-cat";
  if (reaction === "tap") return "gugugaga-overalls";
  if (motion === "walk") return "gugugaga-beanie";
  return "gugugaga-idle";
}

export function PetApp() {
  const [state, setState] = useState<PetState | null>(null);
  const [bubble, setBubble] = useState("");
  const [motion, setMotion] = useState<"idle" | "walk">("idle");
  const [reaction, setReaction] = useState<{ kind: PetReaction | null; version: number }>({
    kind: null, version: 0,
  });
  const [focusText, setFocusText] = useState("");
  const [hintHidden, setHintHidden] = useState(false);
  const [idleCycle, setIdleCycle] = useState(0);
  const [visible, setVisible] = useState(!document.hidden);
  const activeArtworkId = artworkId(state?.characterId, reaction.kind, motion);
  const artwork = useArtwork(activeArtworkId, window.taoqiPet.getArtworkSource);

  const characterId = useRef("caramel");
  const quietMode = useRef(false);
  const motionRef = useRef<"idle" | "walk">("idle");
  const tapIndex = useRef(0);
  const lastTapAt = useRef(0);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const moved = useRef(false);
  const longPressed = useRef(false);
  const bubbleTimer = useRef<number | undefined>(undefined);
  const reactionTimer = useRef<number | undefined>(undefined);
  const pressTimer = useRef<number | undefined>(undefined);

  const showBubble = useCallback((message: string) => {
    setBubble(message);
    clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(""), 2600);
  }, []);

  const react = useCallback((kind: PetReaction, announce = true) => {
    const message = reactionMessage(characterId.current, kind, tapIndex.current);
    let visualKind = kind;
    if (kind === "tap" && characterId.current === "penguin-idle") {
      const tapMotions: PetReaction[] = ["look", "waddle", "tap"];
      visualKind = tapMotions[tapIndex.current % tapMotions.length];
    } else if (kind === "tap" && characterId.current === "gugugaga-idle") {
      const tapMotions: PetReaction[] = ["look", "tap", "play"];
      visualKind = tapMotions[tapIndex.current % tapMotions.length];
    }
    if (kind === "tap") tapIndex.current++;
    setReaction((previous) => ({ kind: visualKind, version: previous.version + 1 }));
    clearTimeout(reactionTimer.current);
    let duration = 650;
    if (visualKind === "nap") duration = 3500;
    else if (visualKind === "double" || visualKind === "play") duration = 1250;
    else if (visualKind === "look" || visualKind === "slide") duration = 1400;
    else if (visualKind === "waddle") duration = 1800;
    reactionTimer.current = window.setTimeout(() => {
      setReaction((previous) => ({ ...previous, kind: null }));
    }, duration);
    if (announce) showBubble(message);
    setIdleCycle((value) => value + 1);
  }, [showBubble]);

  useEffect(() => {
    const applyState = (next: PetState) => {
      characterId.current = next.characterId;
      quietMode.current = next.quietMode;
      setState(next);
    };
    const offState = window.taoqiPet.onState(applyState);
    const offMotion = window.taoqiPet.onMotion((next) => {
      motionRef.current = next;
      setMotion(next);
    });
    const offAction = window.taoqiPet.onAction(react);
    const offNotice = window.taoqiPet.onNotice((message) => {
      if (!quietMode.current) showBubble(message);
    });
    window.taoqiPet.getState().then(applyState);
    const hintTimer = window.setTimeout(() => setHintHidden(true), 5000);
    return () => {
      offState();
      offMotion();
      offAction();
      offNotice();
      clearTimeout(hintTimer);
      clearTimeout(bubbleTimer.current);
      clearTimeout(reactionTimer.current);
      clearTimeout(pressTimer.current);
    };
  }, [react, showBubble]);

  useEffect(() => {
    const endsAt = state?.focusEndsAt;
    if (endsAt == null) {
      setFocusText("");
      return;
    }
    const tick = () => setFocusText(focusLabel(endsAt));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state?.focusEndsAt]);

  useEffect(() => {
    const onVisibilityChange = () => setVisible(!document.hidden);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!state || state.quietMode || state.focusActive || !visible) return;
    // One idle timer owns spontaneous actions; user interaction restarts it.
    const penguin = characterId.current === "penguin-idle";
    const gugugaga = characterId.current === "gugugaga-idle";
    const timer = window.setTimeout(() => {
      if (motionRef.current === "walk") {
        setIdleCycle((value) => value + 1);
        return;
      }
      const actions: PetReaction[] = penguin
        ? ["look", "waddle", "slide", "look", "waddle", "nap"]
        : gugugaga
          ? ["look", "play", "nap", "look", "tap"]
          : ["nap", "nap", "play"];
      react(actions[Math.floor(Math.random() * actions.length)], false);
    }, penguin
      ? 18000 + Math.random() * 18000
      : gugugaga
        ? 24000 + Math.random() * 18000
        : 45000 + Math.random() * 45000);
    return () => clearTimeout(timer);
  }, [state, visible, idleCycle, react]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    pointerStart.current = { x: event.screenX, y: event.screenY };
    moved.current = false;
    longPressed.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    window.taoqiPet.dragStart();
    pressTimer.current = window.setTimeout(() => {
      longPressed.current = true;
      react("long");
    }, 600);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (!pointerStart.current) return;
    if (Math.abs(event.screenX - pointerStart.current.x) > 4 ||
        Math.abs(event.screenY - pointerStart.current.y) > 4) {
      moved.current = true;
      clearTimeout(pressTimer.current);
    }
    if (moved.current) window.taoqiPet.dragMove();
  }

  function finishPointer(event: PointerEvent<HTMLDivElement>) {
    if (!pointerStart.current) return;
    clearTimeout(pressTimer.current);
    event.currentTarget.releasePointerCapture(event.pointerId);
    window.taoqiPet.dragEnd();
    if (!moved.current && !longPressed.current && event.type === "pointerup") {
      const now = Date.now();
      react(now - lastTapAt.current < 350 ? "double" : "tap");
      lastTapAt.current = now;
    }
    pointerStart.current = null;
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      react("tap");
    }
    if (event.key.toLowerCase() === "m") {
      event.preventDefault();
      window.taoqiPet.openMarket();
    }
    if (event.key.toLowerCase() === "h") {
      event.preventDefault();
      window.taoqiPet.openHome();
    }
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      window.taoqiPet.showMenu();
    }
  }

  const petClass = ["pet", motion === "walk" ? "walking" : "",
    state?.focusActive ? "focused" : "", state?.quietMode ? "quiet" : ""]
    .filter(Boolean).join(" ");
  const scale = state?.scale ?? 1;
  // The pet is scaled around its center while the window also grows. Anchor the bubble
  // to the pet's visual top so larger sizes do not leave a large empty gap.
  const bubbleBottom = 27 + 102.5 * (1 + scale);

  return (
    <main className="stage">
      {state?.focusEndsAt != null && (
        <div id="focus-badge" className="focus-badge" role="timer" aria-live="off">{focusText}</div>
      )}
      <div id="bubble" className={"bubble" + (bubble ? " visible" : "")}
        style={{ bottom: bubbleBottom }} aria-live="polite">{bubble}</div>
      <div id="pet" className={petClass} role="button" tabIndex={0}
        aria-label="淘气桌宠，点击互动，拖动移动，右键打开菜单"
        data-character={state?.characterId} data-decoration={state?.decorationId}
        data-reaction={reaction.kind ?? undefined} style={{ scale }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={finishPointer} onPointerCancel={finishPointer}
        onContextMenu={(event) => { event.preventDefault(); window.taoqiPet.showMenu(); }}
        onKeyDown={onKeyDown}>
        <ArtworkPlayer className="pet-art" playKey={reaction.version} source={artwork}
          loadFallback={window.taoqiPet.getArtwork} />
        <div className="accessory" aria-hidden="true" />
      </div>
      <div className={"hint" + (hintHidden ? " hidden" : "")}>拖动我 · M 市场 · H 小窝</div>
    </main>
  );
}
