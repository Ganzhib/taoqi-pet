import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CatalogPet, PetCatalog } from "../shared/contracts";
import { useArtwork } from "../shared/useArtwork";
import { CreatorPanel } from "./CreatorPanel";
import "./market.css";

const categories = ["全部", "学习中", "打工中", "沙雕日常", "我的创作"];

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
  const [category, setCategory] = useState("全部");
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
    return offCatalog;
  }, [refresh]);

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
        setCategory("我的创作");
        setNotice(imported.cutout ? "已自动抠图，只留下宠物主体。" : "没有检测到明显的背景，已按原图导入。");
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
    setCategory("我的创作");
    setCreatorOpen(false);
    await refresh();
    setError("");
  }

  const visible = catalog?.pets.filter((pet) => category === "全部" || pet.category === category) ?? [];
  const status = error || (catalog
    ? "共 " + catalog.pets.length + " 位小伙伴 · 当前陪伴：" +
      catalog.pets.find((pet) => pet.id === catalog.selectedId)!.name
    : "正在加载宠物…");

  return (
    <>
      <header className="hero">
        <div className="hero-copy">
          <span className="eyebrow">TAOQI PET MARKET</span>
          <h1>十三种小伙伴，今天是哪一只？</h1>
          <p>打工猫天团加上五位动物伙伴，也欢迎带自己的图片来。</p>
          <span className="free-badge">全部免费 · 无账号 · 无付费解锁</span>
        </div>
        <div className="hero-actions">
          <button id="open-creator" className="import-button" type="button"
            aria-expanded={creatorOpen} onClick={() => setCreatorOpen((open) => !open)}>
            ✦ 捏一个宠物
          </button>
          <button id="import-pet" className="import-button" type="button"
            disabled={importing} onClick={importPet}>＋ 导入我的宠物</button>
        </div>
      </header>
      <main>
        {creatorOpen && <CreatorPanel onCreated={created} onClose={() => setCreatorOpen(false)} />}
        <nav className="filters" aria-label="宠物分类">
          {categories.map((name) => (
            <button type="button" key={name} data-category={name}
              aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>
          ))}
        </nav>
        <p id="status" className="status" role="status">{status}</p>
        {notice && <p className="notice">{notice}</p>}
        <section id="pet-grid" className="pet-grid" aria-label="宠物列表">
          {visible.map((pet) => (
            <PetCard key={pet.id} pet={pet} active={pet.id === catalog?.selectedId}
              onSelect={select} onRename={rename} onRemove={remove} />
          ))}
          {catalog && visible.length === 0 && (
            <p className="empty">这里还没有宠物。可以捏一个，也可以导入自己的图片。</p>
          )}
        </section>
      </main>
      <footer>导入 PNG、JPG、GIF 或 WebP 图片，单张不超过 5 MB；静态图片导入时自动抠图。图片只保存在这台电脑上。</footer>
    </>
  );
}
