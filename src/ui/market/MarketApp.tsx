import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CatalogPet, PetCatalog } from "../shared/contracts";
import { useArtwork } from "../shared/useArtwork";
import { CreatorPanel } from "./CreatorPanel";
import "./market.css";

type MarketView = "discover" | "create" | "mine";

interface CardProps {
  pet: CatalogPet;
  active: boolean;
  onSelect(id: string): Promise<void>;
  onRename(id: string, name: string): Promise<boolean>;
  onRemove(id: string): Promise<void>;
}

function PetCard({ pet, active, onSelect, onRename, onRemove }: CardProps) {
  const artwork = useArtwork(pet.id, window.petMarket.getArtwork);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(pet.name);
  const [busy, setBusy] = useState(false);

  async function select() {
    setBusy(true);
    try {
      await onSelect(pet.id);
    } finally {
      setBusy(false);
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (await onRename(pet.id, name)) setEditing(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className={"pet-card" + (active ? " active" : "")}>
      <div className="pet-preview">
        <img src={artwork ?? undefined} alt={pet.name + "的插画"} />
      </div>
      <div className="card-meta">
        <h2>{pet.name}</h2>
        <span className="category">{pet.category}</span>
      </div>
      <p className="description">{pet.description}</p>
      {pet.source === "custom" && editing && (
        <form className="name-editor" onSubmit={saveName}>
          <input type="text" maxLength={32} required value={name}
            aria-label={"修改" + pet.name + "的名称"}
            onChange={(event) => setName(event.target.value)} />
          <button className="remove-button" type="submit" disabled={busy}>保存</button>
        </form>
      )}
      <div className="card-actions">
        <button className={"card-action" + (active ? " selected" : "")} type="button"
          disabled={active || busy} onClick={select}>
          {active ? "正在陪伴" : "选它陪伴"}
        </button>
        {pet.source === "custom" && (
          <>
            <button className="remove-button" type="button"
              onClick={() => setEditing((value) => !value)}>改名</button>
            <button className="remove-button" type="button"
              aria-label={"删除" + pet.name} onClick={() => onRemove(pet.id)}>删除</button>
          </>
        )}
      </div>
    </article>
  );
}

export function MarketApp() {
  const [catalog, setCatalog] = useState<PetCatalog | null>(null);
  const [view, setView] = useState<MarketView>(
    new URLSearchParams(window.location.search).get("view") === "create" ? "create" : "discover",
  );
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const refreshVersion = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++refreshVersion.current;
    const next = await window.petMarket.getCatalog();
    if (version === refreshVersion.current) setCatalog(next);
  }, []);

  useEffect(() => {
    const offCatalog = window.petMarket.onCatalog((next) => {
      refreshVersion.current++;
      setCatalog(next);
    });
    refresh().catch((failure: Error) => setError(failure.message));
    const offView = window.petMarket.onView((next) => setView(next));
    return () => {
      offCatalog();
      offView();
    };
  }, [refresh]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  async function select(id: string) {
    try {
      await window.petMarket.select(id);
      await refresh();
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  async function rename(id: string, name: string) {
    try {
      const saved = await window.petMarket.renamePet(id, name);
      if (saved) {
        await refresh();
        setError("");
      } else {
        setError("请输入宠物名称。");
      }
      return saved;
    } catch (failure) {
      setError((failure as Error).message);
      return false;
    }
  }

  async function remove(id: string) {
    try {
      if (await window.petMarket.removePet(id)) await refresh();
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    }
  }

  async function importPet() {
    setImporting(true);
    try {
      const imported = await window.petMarket.importPet();
      if (imported) {
        setView("mine");
        if (imported.animated) {
          setNotice("已保留素材原有动画，可以直接作为桌宠使用。");
        } else if (imported.cutout) {
          setNotice("已自动抠图，只留下宠物主体。");
        } else {
          setNotice("没有检测到明显的背景，已按原图导入。");
        }
        await refresh();
      }
      setError("");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setImporting(false);
    }
  }

  async function created() {
    setView("mine");
    setCreatorOpen(false);
    await refresh();
    setError("");
  }

  const visible = catalog?.pets.filter((pet) =>
    view === "mine" ? pet.source === "custom" : pet.source !== "custom") ?? [];
  const status = error || (catalog
    ? "共 " + catalog.pets.length + " 位小伙伴 · 当前陪伴：" +
      catalog.pets.find((pet) => pet.id === catalog.selectedId)!.name
    : "正在加载宠物…");

  return (
    <>
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">TAOQI PET STUDIO</span>
          <h1>{view === "create" ? "制作你的桌面伙伴" :
            view === "mine" ? "我的宠物" : "发现会陪伴的伙伴"}</h1>
          <p>{view === "create"
            ? "从模板捏一只，或把自己的图片和动图带到桌面。"
            : view === "mine"
              ? "已保存的作品都在这里，点一下就能切换陪伴。"
              : "咕咕嘎嘎、企鹅和六位动物伙伴，全部免费陪伴。"}</p>
          <span className="free-badge">全部免费 · 无账号 · 无付费解锁</span>
        </div>
      </header>
      <main>
        <nav className="filters" aria-label="宠物工坊">
          <button type="button" aria-pressed={view === "discover"}
            onClick={() => setView("discover")}>发现伙伴</button>
          <button type="button" aria-pressed={view === "create"}
            onClick={() => setView("create")}>制作宠物</button>
          <button type="button" aria-pressed={view === "mine"}
            onClick={() => setView("mine")}>我的宠物</button>
        </nav>
        {view === "create" ? (
          <section className="studio" aria-label="制作宠物">
            <div className="studio-options">
              <article className="studio-option">
                <span className="studio-icon" aria-hidden="true">✦</span>
                <h2>从模板开始</h2>
                <p>挑选小猫、小龙或团子，调整颜色和表情。保存后立即成为桌宠。</p>
                <button id="open-creator" className="import-button" type="button"
                  aria-expanded={creatorOpen} onClick={() => setCreatorOpen((open) => !open)}>
                  捏一个宠物
                </button>
              </article>
              <article className="studio-option">
                <span className="studio-icon" aria-hidden="true">▣</span>
                <h2>导入自己的素材</h2>
                <p>支持单张 PNG、JPG、WebP，或 GIF、APNG、动态 WebP。现成动图保留原动画。</p>
                <button id="import-pet" className="import-button" type="button"
                  disabled={importing} onClick={importPet}>导入图片或动图</button>
              </article>
            </div>
            {creatorOpen && <CreatorPanel onCreated={created} onClose={() => setCreatorOpen(false)} />}
            <p className="studio-roadmap">多张连续帧和视频导入还在制作中，当前版本暂不支持。</p>
          </section>
        ) : (
          <>
            <p id="status" className="status" role="status">{status}</p>
            {notice && <p className="notice">{notice}</p>}
            <section id="pet-grid" className="pet-grid" aria-label="宠物列表">
              {visible.map((pet) => (
                <PetCard key={pet.id} pet={pet} active={pet.id === catalog?.selectedId}
                  onSelect={select} onRename={rename} onRemove={remove} />
              ))}
              {catalog && visible.length === 0 && (
                <p className="empty">这里还没有宠物。到“制作宠物”捏一个，或导入自己的图片。</p>
              )}
            </section>
          </>
        )}
      </main>
      <footer>图片单张不超过 5 MB；动图保留原动画，静态图自动抠图。作品只保存在这台电脑上。</footer>
    </>
  );
}
